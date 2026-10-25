# Katalog ve Scraper Rehberi

## 1. Katalog dosyalari

`store.config.json` icindeki `catalogFiles` sirasiyla okunur; ayni `id` ile
karsilasilan ilk kayit kazanir.

| Dosya | Amaci | Git'e girer mi? |
|---|---|---|
| `catalog/apps.json` | Surdurulen, dogrulanmis homebrew/arac kayitlari | Evet |
| `catalog/games.json` | Manuel eklenen oyun/ek paket kayitlari | Evet |
| `catalog/scraped.json` | Scraper ciktisi | Hayir (`.gitignore`) |

## 2. Kayit semasi

```jsonc
{
  "id": "benzersiz-kisa-kimlik",   // zorunlu, slug formatinda
  "title": "Gorunen ad",           // zorunlu
  "developer": "Yapimci",
  "category": "game",              // zorunlu: homebrew | game | tool | payload | theme
  "type": "pkg",                   // pkg | payload | homebrew | desktop
  "version": "1.00",
  "firmware": "9.00+",
  "region": "EUR",                 // GLOBAL, EUR, USA, JPN...
  "size": 1073741824,              // bayt cinsinden (null olabilir)
  "sizeLabel": "1 GB",             // elle etiket; bossa size'tan uretilir
  "titleId": "IV0000-HENBX00002",  // RPI kontrolu icin opsiyonel
  "description": "Kisa aciklama",
  "covers": [                      // bos birakilirsa arayuz SVG kapak uretir
    "https://site/kapak.jpg"
  ],
  "packages": [                    // RPI'nin kuracagi direkt http(s) .pkg linkleri
    "http://192.168.1.50:8080/oyun.pkg"
  ],
  "homepage": "https://...",       // packages bossa homepage zorunludur
  "source": "manual",              // manual | github | mcpsp | dlpsgame | superpsx | import
  "updatedAt": "2026-10-25"        // YYYY-MM-DD
}
```

Kurallar:

- `id`, `title`, `category` her zaman zorunludur.
- Kayitta ya dolu bir `packages` dizisi ya da bir `homepage` bulunmali.
- `packages` icindeki her adres `http://` veya `https://` ile baslamali.
- Dogrulama icin: `npm run catalog:check` (hata varsa cikis kodu 1 doner).

## 3. Toplu aktarma

Kendi JSON listenizi hazirlayip tek komutla ekleyin:

```bash
node scrapers/importJson.js benim-listem.json --target games
```

- Eksik alanlar (`id`, `sizeLabel`, tarihler vb.) otomatik doldurulur.
- Gecersiz kayitlar hata mesajiyla atlanir, digerleri islenir.
- Ayni `id` tekrar gonderilirse kayit guncellenir.

## 4. Scraper mimarisi

```
scrapers/
├── index.js              # CLI: --site, --limit, --dry-run
├── importJson.js
├── catalogCheck.js
├── lib/catalog.js        # normalizeEntry, mergeScraped, validateEntry
└── adapters/
    ├── BaseAdapter.js    # axios + cheerio tabanli ortak iskelet
    ├── mcpsp.js
    ├── dlpsgame.js
    └── superpsx.js
```

Akis:

1. Adapter, `listPaths` altindaki liste sayfalarini ceker.
2. `selectors.list` ile kartlari (baslik, detay linki, kapak) toplar.
3. Her kartin detay sayfasini ceker; `selectors.detail` ile surum, boyut,
   aciklama ve indirme linklerini ayiklar.
4. `normalizeEntry` ciktiyi katalog semasina cevirir.
5. `index.js` sonucu `catalog/scraped.json` icine birlestirir (id bazli).

Komutlar:

```bash
npm run scrape:dry -- --site mcpsp --limit 3   # dosyaya yazmadan dene
npm run scrape -- --site mcpsp,dlpsgame         # secili adapterler
npm run scrape                                  # tum adapterler
```

## 5. Secicileri (selector) guncelleme

Siteler zamanla tasarim degistirir. Adapter'ler bu yuzden tek bir `selectors`
nesnesiyle yapilandirilir. Ornek:

```js
selectors: {
  list: {
    item: 'article.post',                 // her karti temsil eden kapsayici
    title: 'h2.entry-title a',            // baslik (item icinde)
    link: 'h2.entry-title a',             // detay linki (href)
    cover: '.post-thumbnail img'          // kapak (src veya data-src)
  },
  detail: {
    title: 'h1.entry-title',
    firmware: '.entry-content li:contains("Firmware")',
    size: '.entry-content li:contains("Size")',
    description: '.entry-content p',
    covers: '.entry-content img',
    downloadLinks: '.btn-download a'      // birden fazla olabilir, hepsi toplanir
  }
}
```

Duzeltme dongusu:

1. `npm run scrape:dry -- --site mcpsp --limit 2` calistir.
2. Kart sayisi `0` ise `selectors.list`, detay bos geliyorsa `selectors.detail`
   secicilerini tarayicinin gelistirici araclariyla (F12 → Inspector) bul.
3. Adapter dosyasini duzeltip tekrar dry-run yap.
4. Sonuç dogruysa `npm run scrape -- --site mcpsp` ile kaydet.

Ozel durumlarda adapter icindeki `parseDetail($, pageUrl, listItem)` metodu
override edilebilir (mevcut adapterlerdeki firmware regex'i ornegine bakin).

## 6. Yeni bir site adapter'i yazma

1. `scrapers/adapters/` altina `yenisite.js` acin:

   ```js
   const { BaseAdapter } = require('./BaseAdapter');

   class YeniSiteAdapter extends BaseAdapter {
     constructor() {
       super({
         name: 'yenisite',
         baseUrl: 'https://example.com/',
         listPaths: ['ps4/'],
         delay: 1500,
         selectors: { list: { /* ... */ }, detail: { /* ... */ } }
       });
     }
   }
   module.exports = YeniSiteAdapter;
   ```

2. `scrapers/index.js` icindeki `ADAPTERS` nesnesine ekleyin:

   ```js
   const YeniSiteAdapter = require('./adapters/yenisite');
   const ADAPTERS = { /* ... */, yenisite: YeniSiteAdapter };
   ```

3. `npm run scrape:dry -- --site yenisite` ile test edin.

## 7. Indirme linkleriyle ilgili kritik not

RPI, PS4'un dogrudan erisebildigi HTTP(S) `.pkg` baglantisi ister:

- ✅ Yerel agdaki `serve`/`http.server` linkleri
- ✅ Kimlik dogrulamasi istemeyen direkt internet linkleri
- ❌ Reklamli ara sayfalar, captcha veya token isteyen filehost linkleri
- ❌ `ftp://`, magnet veya premium hesap gerektiren baglantilar

Bu nedenle scraper ciktisindaki `packages` listesini gozden gecirin; gerekiyorsa
kaydi elle duzenleyip dogrudan linki yazin. Ayrica sadece dagitim hakkiniz olan
icerikleri kataloga ekleyin.
