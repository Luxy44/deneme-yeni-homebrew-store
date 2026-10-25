# HENBOX Store — GoldHEN PS4 Homebrew Magazasi

Black Box tarzi, tamamen ozellesebilir PS4 homebrew magazasi. Web tabanli
koyu+altin temali arayuz, JSON tabanli katalog, sitelerden icerik toplamaya
yarayan scraper altyapisi ve **Remote Package Installer (RPI)** ile PS4'e
kablosuz PKG gonderimi tek repoda.

> Hedef kurulum: GoldHEN calisan PS4 (magaza ayarlarinda hedef surum `13.52`
> olarak isaretlidir; `store.config.json` icinden degistirilebilir).

## Ozellikler

- 🎮 **PS4/Black Box estetigi** — koyu zemin, altin vurgu, kapak kartlari,
  kategori pill'leri, arama ve siralama
- 📡 **Cift kurulum yontemi** — her paket iki sekilde kurulabilir:
  - **Uzaktan (RPI):** flatz'in [Remote Package Installer](https://github.com/flatz/ps4_remote_pkg_installer)
    protokoluyle (`http://<PS4_IP>:12800/api/install`) tek tikla gonderim
  - **USB:** "PKG Indir" butonuyla dosyayi bilgisayara kaydet, exFAT USB'nin
    kokune at, PS4'te GoldHEN → Package Installer ile kur
  - Cok parcali paketlerde her parcanin ayri indirme linki olur
- 🗂️ **JSON katalog** — kod bilmeden `catalog/` altina dosya ekleyerek icerik yonetimi
- 🕷️ **Scraper altyapisi** — `mcpsp`, `dlpsgame`, `superpsx` adapterleri ile
  secici tabanli (cheerio) kazima; yeni site eklemek tek dosya
- 🧩 **Statik calisma** — Node sunucusu olmadan GitHub Pages uzerinde de calisir
- 🎯 **Klavye + gamepad navigasyonu** — D-Pad ile gezinme, × ile acma, ○ ile kapama
- ✅ **Katalog dogrulayici** — sema hatasi ve cift id kontrolu (`npm run catalog:check`)

## Hizli baslangic

```bash
npm install
npm start
# Tarayici (ve PS4 tarayicisi): http://<BILGISAYAR-IP>:3000
```

Gelistirme (dosya degisikliklerinde otomatik yeniden baslama):

```bash
npm run dev
```

## Proje yapisi

```
├── server.js                  # Express + RPI proxy uclari (/api/send, /api/check)
├── store.config.json          # Magaza adi, hedef FW, kategori ve RPI ayarlari
├── catalog/
│   ├── apps.json              # Hazir dogrulanmis homebrew katalogu (gercek GitHub linkleri)
│   ├── games.json             # Oyun/ek paket kayitlari (ornek + sizin ekledikleriniz)
│   ├── scraped.json           # Scraper ciktisi (.gitignore'lu, otomatik uretilir)
│   └── scraped.example.json   # scraped.json format ornegi
├── public/                    # Saf HTML/CSS/JS arayuz (statik olarak da yayınlanabilir)
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── assets/logo.png
├── scrapers/
│   ├── index.js               # Scraper CLI
│   ├── importJson.js          # Harici JSON aktarici
│   ├── catalogCheck.js        # Katalog dogrulayici
│   ├── lib/catalog.js         # Sema, normalize ve birlestirme mantigi
│   └── adapters/
│       ├── BaseAdapter.js     # Ortak kazima iskeleti (axios + cheerio)
│       ├── mcpsp.js
│       ├── dlpsgame.js
│       └── superpsx.js
└── docs/
    ├── PS4-KURULUM.md         # GoldHEN + RPI kurulum ve kullanim kilavuzu
    └── KATALOG-REHBERI.md     # Icerik ekleme, scraper ve adapter yazma rehberi
```

## Kataloga icerik ekleme

En basit yol `catalog/games.json` dosyasina bir nesne eklemek:

```json
{
  "id": "benim-oyunum",
  "title": "Benim Oyunum",
  "developer": "Gelistirici Adi",
  "category": "game",
  "type": "pkg",
  "version": "1.00",
  "firmware": "9.00+",
  "region": "EUR",
  "size": 1073741824,
  "sizeLabel": "1 GB",
  "titleId": "IV0000-HENBX00002",
  "description": "Kisa aciklama...",
  "covers": ["https://site/kapak.jpg"],
  "packages": ["http://192.168.1.50:8080/benim-oyun.pkg"],
  "homepage": "https://github.com/kullanici/repo",
  "source": "manual",
  "updatedAt": "2026-10-25"
}
```

Zorunlu alanlar: `id`, `title`, `category` ve (`packages` dolu ya da `homepage`
baglantisi olan) bir kaynaktir. Detaylar icin [docs/KATALOG-REHBERI.md](docs/KATALOG-REHBERI.md).

Harici bir JSON listesini toplu aktarma:

```bash
node scrapers/importJson.js benim-listem.json --target games
npm run catalog:check
```

## Scraper kullanimi

```bash
# Once kuru calistirip secicilerin tuttugunu dogrula (dosya degistirmez)
npm run scrape:dry -- --site mcpsp --limit 3

# Gercek calistirma -> catalog/scraped.json
npm run scrape -- --site mcpsp,dlpsgame

# Tum adapterler
npm run scrape
```

> **Ag/secici notu:** Adapterlerdeki CSS secicileri sitelerin bilinen WordPress
> yapisina gore yazilmis baslangic sablonlaridir. Site tasarimi degistiyse
> ilgili `scrapers/adapters/*.js` dosyasindaki secicileri guncelleyin. Ayrica
> bu sitelerin indirme akislari genelde ara sayfa/filehost kullandigindan
> `packages` listesini RPI oncesi mutlaka gozden gecirin; RPI dogrudan
> erisilebilir HTTP(S) `.pkg` linki ister.

## GitHub Pages ile yayinlama

1. Repo → **Settings → Pages** → kaynagi dalinizin kok dizini (`/`) secin.
2. Yayinlanan adresi PS4 tarayicisinda acin.
3. Statik modda `/api/send` ucu olmadigindan uygulama once dogrudan RPI'ye
   baglanmayi dener; tarayici CORS engellerse ekranda hazir `curl` komutunu
   verir (komut panoya kopyalanir). Tam deneyim icin `npm start` ile Node
   sunucusunu yerel agda calistirin.

## Yasal uyari

HENBOX bir arayuz ve altyapi projesidir; herhangi bir telifli icerik barindirmaz.
Katalogda hazir gelen tum paketler acik kaynak/homebrew projelerinin resmi
GitHub surumleridir. Scraper ile topladiginiz veya elle eklediginiz iceriklerin
dagitim hakki size ait olmalidir. Kullanım sorumlulugu tamamen kullaniciya aittir.

## Lisans

MIT
