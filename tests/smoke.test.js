/**
 * Arayuz duman testi (jsdom)
 * --------------------------
 * public/index.html + public/app.js ikilisini gercek bir DOM'da calistirir;
 * sahte fetch ile katalogu yukler, kartlari ve detay modalini dogrular.
 *
 * Calistirma: npm test
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'store.config.json'), 'utf8'));

const catalogItems = [
  ...JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog', 'apps.json'), 'utf8')),
  ...JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog', 'games.json'), 'utf8'))
];

const dom = new JSDOM(html, {
  url: 'http://localhost:3000/',
  runScripts: 'dangerously',
  pretendToBeVisual: true
});
const { window } = dom;

// Sahte fetch: /api/config ve /api/catalog ucunu taklit et
window.fetch = async (url) => {
  const u = String(url);
  let body;
  if (u.includes('/api/config')) {
    body = {
      storeName: config.storeName,
      tagline: config.tagline,
      targetFirmware: config.targetFirmware,
      categories: config.categories,
      rpiPort: config.rpi.port,
      catalogFiles: config.catalogFiles
    };
  } else if (u.includes('/api/catalog')) {
    body = { store: config.storeName, total: catalogItems.length, counts: {}, items: catalogItems };
  } else {
    throw new Error('beklenmeyen fetch: ' + u);
  }
  return { ok: true, status: 200, json: async () => body };
};

// app.js'i pencere baglaminda calistir
vm.runInContext(appJs, dom.getInternalVMContext());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function assert(cond, msg) {
  if (cond) {
    console.log('  ✓ ' + msg);
  } else {
    failures++;
    console.error('  ✗ ' + msg);
  }
}

(async () => {
  // Katalogun render olmasini bekle
  for (let i = 0; i < 30; i++) {
    if (window.document.querySelectorAll('.card').length === catalogItems.length) break;
    await sleep(50);
  }

  console.log('\n[Katalog render]');
  assert(window.document.querySelectorAll('.card').length === catalogItems.length,
    `${catalogItems.length} kartin tamami render edildi`);
  assert(window.document.getElementById('targetFw').textContent === '13.52', 'hedef FW rozeti 13.52');

  console.log('\n[Paketli kayit — cift kurulum]');
  const withPkg = catalogItems.find((i) => i.packages && i.packages.length > 0 && i.type === 'pkg');
  const card = [...window.document.querySelectorAll('.card')].find((c) => c.dataset.id === withPkg.id);
  assert(!!card, `${withPkg.title} karti bulundu`);
  card.dispatchClick?.();
  card.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(30);

  const modal = window.document.getElementById('modalBackdrop');
  assert(modal.hidden === false, 'detay modali acildi');
  const dlBtn = window.document.getElementById('downloadBtn');
  assert(dlBtn.getAttribute('href') === withPkg.packages[0], 'PKG Indir butonu ilk pakete bagli');
  assert(dlBtn.hasAttribute('download'), 'indirme butonunda download ozelligi var');
  assert(window.document.getElementById('installMethods').hidden === false, 'kurulum yontemleri blogu gorunur');
  assert(window.document.querySelectorAll('.pkg-dl').length === withPkg.packages.length,
    'her paket parcasi icin ayri Indir linki var');
  assert(window.document.getElementById('sendBtn').disabled === false, 'RPI gonder butonu aktif');
  assert(window.document.querySelector('#modalMeta').textContent.includes('RPI · USB'), 'meta satirinda RPI · USB etiketi');

  console.log('\n[Paketsiz kayit — yalnizca kaynak sayfa]');
  window.document.getElementById('modalClose').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const noPkg = catalogItems.find((i) => !i.packages || i.packages.length === 0);
  const card2 = [...window.document.querySelectorAll('.card')].find((c) => c.dataset.id === noPkg.id);
  card2.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await sleep(30);
  const dlBtn2 = window.document.getElementById('downloadBtn');
  assert(!dlBtn2.getAttribute('href'), 'paketsiz kayitta indirme butonunun hrefi yok');
  assert(dlBtn2.style.pointerEvents === 'none', 'indirme butonu pasiflestirildi');
  assert(window.document.getElementById('installMethods').hidden === true, 'kurulum yontemleri blogu gizli');
  assert(window.document.getElementById('sendBtn').disabled === true, 'RPI butonu pasif (pkg degil)');

  console.log('\n[Arama filtresi]');
  window.document.getElementById('modalClose').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  const input = window.document.getElementById('searchInput');
  input.value = 'GoldHEN';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(20);
  const visible = window.document.querySelectorAll('.card').length;
  assert(visible >= 1 && visible < catalogItems.length, `arama sonucu filtrelendi (${visible} kart)`);

  console.log(`\n${failures ? 'BASARISIZ' : 'TUM TESTLER GECTI'} (${failures} hata)`);
  process.exit(failures ? 1 : 0);
})().catch((err) => {
  console.error('Test patladi:', err);
  process.exit(1);
});
