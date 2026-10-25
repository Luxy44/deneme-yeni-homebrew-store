/**
 * HENBOX Store - PS4 Homebrew Store sunucusu
 * - Statik web arayuzunu sunar (public/)
 * - Katalog dosyalarini birlestirip /api/catalog olarak dondurur
 * - Remote Package Installer (flatz RPI) protokoluyle PS4'e PKG gonderir
 *
 * RPI protokol referansi: https://github.com/flatz/ps4_remote_pkg_installer
 *   POST http://<PS4_IP>:12800/api/install
 *   {"type":"direct","packages":["http://.../dosya.pkg"]}
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const config = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'store.config.json'), 'utf8')
);

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(ROOT, 'public'), { extensions: ['html'] }));

/* ---------------- Yardimci islevler ---------------- */

function readCatalogFile(relativePath) {
  const full = path.join(ROOT, relativePath);
  if (!fs.existsSync(full)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(full, 'utf8'));
    if (!Array.isArray(data)) {
      console.warn(`[uyari] ${relativePath} bir dizi icermiyor, atlandi.`);
      return [];
    }
    return data;
  } catch (err) {
    console.warn(`[uyari] ${relativePath} okunamadi: ${err.message}`);
    return [];
  }
}

function mergeCatalog() {
  const seen = new Set();
  const merged = [];
  for (const file of config.catalogFiles) {
    for (const entry of readCatalogFile(file)) {
      if (!entry || !entry.id) continue;
      if (seen.has(entry.id)) continue; // ilk kayit kazanir (oncelik config sirasi)
      seen.add(entry.id);
      merged.push(entry);
    }
  }
  return merged;
}

/** PS4 tarafina HTTP POST atar (RPI sade JSON bekler). */
async function postToRpi(ps4Host, apiPath, body, timeoutMs) {
  const url = `http://${ps4Host}:${config.rpi.port}${apiPath}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      data: text.length > 2000 ? text.slice(0, 2000) + '...' : text
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Host/IP formatina kaba dogrulama (SSRF'i sinirla). */
function isValidHost(host) {
  if (typeof host !== 'string' || !host || host.length > 253) return false;
  const ipV4 = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
  const hostname = /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/;
  return ipV4.test(host) || hostname.test(host);
}

/* ---------------- API uclari ---------------- */

app.get('/api/health', (req, res) => {
  res.json({ ok: true, store: config.storeName, time: new Date().toISOString() });
});

app.get('/api/config', (req, res) => {
  res.json({
    storeName: config.storeName,
    tagline: config.tagline,
    targetFirmware: config.targetFirmware,
    categories: config.categories,
    rpiPort: config.rpi.port
  });
});

app.get('/api/catalog', (req, res) => {
  const catalog = mergeCatalog();
  const counts = catalog.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});
  res.json({
    store: config.storeName,
    targetFirmware: config.targetFirmware,
    total: catalog.length,
    counts,
    items: catalog
  });
});

/**
 * PS4 Remote Package Installer'a paket gonderir.
 * Body: { ps4Ip: "192.168.1.20", packages: ["http://.../a.pkg"], title?: string }
 */
app.post('/api/send', async (req, res) => {
  const { ps4Ip, packages, title } = req.body || {};

  if (!isValidHost(ps4Ip)) {
    return res.status(400).json({ ok: false, error: 'Gecersiz PS4 IP/host adresi.' });
  }
  if (!Array.isArray(packages) || packages.length === 0) {
    return res.status(400).json({ ok: false, error: 'En az bir paket URL\'si gonderin.' });
  }
  if (!packages.every((u) => typeof u === 'string' && /^https?:\/\//i.test(u))) {
    return res.status(400).json({ ok: false, error: 'Paket URL\'leri http:// veya https:// ile baslamali.' });
  }

  try {
    const result = await postToRpi(
      ps4Ip,
      config.rpi.installPath,
      { type: 'direct', packages, title: title || undefined },
      config.rpi.timeoutMs
    );
    res.json({
      ok: result.ok,
      message: result.ok
        ? 'Komut PS4 Remote Package Installer\'a ulaştı. Konsoldaki bildirimleri kontrol edin.'
        : `PS4 hata dondu (HTTP ${result.status}). RPI uygulamasinin acik ve odakta oldugundan emin olun.`,
      rpiResponse: result
    });
  } catch (err) {
    const reason = err.name === 'AbortError' ? 'Zaman asimi (PS4 cevap vermedi).' : err.message;
    res.status(502).json({
      ok: false,
      error: `PS4'e baglanilamadi: ${reason}`,
      hint: 'Konsol ile ayni agda olun, PS4 IP\'sini kontrol edin ve Remote Package Installer uygulamasinin acik oldugundan emin olun.'
    });
  }
});

/** RPI uzerinden bir Title ID'nin konsolda kurulu olup olmadigini kontrol eder. */
app.post('/api/check', async (req, res) => {
  const { ps4Ip, titleId } = req.body || {};
  if (!isValidHost(ps4Ip)) {
    return res.status(400).json({ ok: false, error: 'Gecersiz PS4 IP/host adresi.' });
  }
  if (!titleId || !/^[A-Z]{4}\d{5}$/.test(titleId)) {
    return res.status(400).json({ ok: false, error: 'Title ID ornegi: CUSA01234 formatinda olmali.' });
  }
  try {
    const result = await postToRpi(
      ps4Ip,
      config.rpi.isExistsPath,
      { title_id: titleId },
      config.rpi.timeoutMs
    );
    res.json({ ok: result.ok, rpiResponse: result });
  } catch (err) {
    const reason = err.name === 'AbortError' ? 'Zaman asimi.' : err.message;
    res.status(502).json({ ok: false, error: `PS4'e baglanilamadi: ${reason}` });
  }
});

/* SPA olmayan basit 404 */
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Sayfa bulunamadi.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  HENBOX Store ayakta:`);
  console.log(`  > Yerel:   http://localhost:${PORT}`);
  console.log(`  > Ag:      http://0.0.0.0:${PORT} (PS4 tarayicisi icin)`);
  console.log(`  > Katalog: ${config.catalogFiles.join(', ')}\n`);
});
