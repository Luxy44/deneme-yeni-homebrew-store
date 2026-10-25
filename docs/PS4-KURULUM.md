# PS4 Kurulum ve Kullanim Kilavuzu

Bu dokuman HENBOX Store'un GoldHEN'li bir PS4 uzerinde kullanilmasini,
Remote Package Installer (RPI) ile kablosuz kurulumu ve USB alternatifini
anlatir.

## 1. On kosullar

- Jailbreakli (GoldHEN aktif) bir PS4
- PS4 ve magazayi calistiran cihaz (bilgisayar/Raspberry Pi) **ayni agda**
- Magaza sunucusu: `npm install && npm start` (varsayilan port 3000)
- PS4 tarafinda **Remote Package Installer** homebrew'i
  - Kaynak: <https://github.com/flatz/ps4_remote_pkg_installer>
  - Alternatif gonderim protokolleri (GoldHEN Payload Server, etaHEN DPIv2)
    icin bkz. <https://github.com/marcussacana/DirectPackageInstaller>

> HENBOX `store.config.json` icinde hedef firmware `13.52` olarak etiketlenir.
> Bu sadece bir rozettir; calistirdiginiz GoldHEN/payload surumunun konsolunuzdaki
> resmi surumle uyumlu oldugunu mutlaka kendi kaynaklarinizdan dogrulayin.

## 2. Magazayi yerel agda yayinlama

```bash
npm install
npm start
```

Cikti ornegi:

```
HENBOX Store ayakta:
  Yerel:   http://localhost:3000
  Ag:      http://0.0.0.0:3000
```

Bilgisayarinizin yerel IP'sini ogrenin:

- Windows: `ipconfig` → IPv4 adresi (orn. `192.168.1.50`)
- Linux/macOS: `ip a` veya `ifconfig`

PS4 tarayicisindan su adresi acin:

```
http://192.168.1.50:3000
```

İsterseniz kalici hale getirmek icin surekli calisan bir cihaza
(Raspberry Pi, NAS, ev sunucusu) kurabilir veya GitHub Pages uzerine
yayinlayabilirsiniz (README'deki bolume bakin).

## 3. PS4 IP'sini tanimlama

1. PS4: **Ayarlar → Ag → Baglanti durumunu görüntüle**
2. IP adresini not alin (orn. `192.168.1.20`)
3. HENBOX'ta **⚙ PS4 Baglantisi** butonuna basin, IP'yi yazip kaydedin.
   Deger tarayicinin localStorage'inda tutulur.

## 4. RPI ile PKG gonderme

1. PS4'te **Remote Package Installer** uygulamasini acin ve ekranda birakin
   (uygulama arka plana alinirsa ag baglantisi askiya alinir).
2. HENBOX'ta istediginiz paketi acin, **📡 PS4'e Gonder (RPI)** butonuna basin.
3. Sunucu su istegi konsola iletir:

   ```http
   POST http://192.168.1.20:12800/api/install
   Content-Type: application/json

   {"type":"direct","packages":["http://192.168.1.50:8080/oyun.pkg"]}
   ```

4. PS4 bildirimlerinden indirme/kurulum durumunu izleyin. Kurulum basladiktan
   sonra RPI uygulamasini kapatabilirsiniz; indirme arka planda surer.

### Cok parcali paketler

Bir oyunun ana paketi + parcali guncellemesi varsa `packages` dizisine hepsini
**sirayla** yazin; HENBOX dizinin tamamini tek istekte gonderir:

```json
"packages": [
  "http://192.168.1.50:8080/ana.pkg",
  "http://192.168.1.50:8080/guncelleme_0.pkg",
  "http://192.168.1.50:8080/guncelleme_1.pkg"
]
```

### Title ID kontrolu

`titleId` alani dolu kayitlarda modalda **✓ Konsolda Kontrol Et** butonu cikar.
Bu, RPI'nin `/api/is_exists` ucuna sorgu atar ve oyunun kurulu olup olmadigini
doner.

## 5. PKG dosyalarini yerel agda sunma

RPI, linkin PS4 tarafindan erisilebilir olmasini ister. Kendi bilgisayarinizdaki
klasoru yayınlamak icin:

```bash
# Node ile
npx serve -p 8080 /home/kullanici/pkg-klasoru

# veya Python ile
python3 -m http.server 8080 --directory /home/kullanici/pkg-klasoru
```

Ardindan katalogdaki `packages` linkini gerçek URL ile eslestirin:

```
http://192.168.1.50:8080/oyun-adi.pkg
```

İnternetteki dogrudan linkler de calisir; ancak kimlik dogrulamasi isteyen
filehost linkleri RPI ile calismaz. Linki once tarayicida gizli sekmede test edin.

## 6. USB ile kurulum (alternatif)

RPI kullanmak istemiyorsaniz HENBOX modalindaki **⬇ PKG Indir (USB)** butonu
(veya her paket satirindaki kucuk "Indir" linki) ile dosyayi bilgisayara kaydedin:

1. İndirilen `.pkg` dosyasini exFAT/FAT32 bicimli USB bellegin **kokune** kopyalayin
   (alt klasore degil; PS4 Package Installer kok dizini tarar)
2. USB bellegi PS4'e takin
3. GoldHEN aktifken **Ayarlar → GoldHEN → Package Installer** (veya debug
   Settings → Game → Package Installer) ekranini acin
4. Paketi secip kurun; cok parcali kurulumda once ana paketi, sonra
   guncelleme/parca dosyalarini ayni sirayla kurun

**🔗 Linki Kopyala** butonu linki baska bir indiriciye (orn. IDM, wget)
vermek icin de kullanilabilir:

```bash
wget -O oyun.pkg "kopyalanan-link"
```

> Tarayici bazi sitelerde `download` ozelligini yok sayip linki yeni sekmede
> acabilir; bu durumda acilan sayfada sag tik → "Farkli kaydet" ile `.pkg`
> dosyasini alin. GitHub release linkleri dosyayi dogrudan indirir.

## 7. Payload ve 7z dosyalari

Katalogdaki `GoldHEN` ve `PPPwn Stage2` gibi kayitlar PKG degil, payload/arsiv
icerir; bu yuzden modalda RPI butonu pasiftir. Kurulum akisi:

- **PPPwn:** stage2 dosyasini kullandiginiz PPPppwn sunucusunun/ sayfasinin
  bekledigi konuma koyun, PS4'te exploit sayfasini calistirin.
- **GoldHEN guncellemesi:** arsivi acip `goldhen.bin` dosyasini USB bellegin
  kokune yazin ve konsolu yeniden baslatarak payload'i yukleyin.

## 8. Sorun giderme

| Belirti | Cozum |
|---|---|
| `PS4'e baglanilamadi: fetch failed` | IP yanlis olabilir, RPI kapali olabilir veya PS4 baska agdadir |
| CORS hatasi (statik yayin) | `npm start` ile sunucu modunu kullanin veya ekrandaki `curl` komutunu calistirin |
| `the connection to the server has been lost` | RPI'yi tekrar one getirip indirmeyi devam ettirin |
| Kurulum %0'da kaliyor | PKG URL'sini PS4 tarayicisinda da test edin; dosya sunucusu coklu baglanti desteklemeli (`serve` ODTU onerilir) |
| Magaza acilmiyor | Guvenlik duvarinda 3000 portuna izin verin; PS4 ve PC ayni agda olsun |
