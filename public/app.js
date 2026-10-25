/* ============================================================
   HENBOX Store — on yuz uygulamasi (saf JavaScript, bilesen yok)
   Hem Node sunucusuyla (/api/catalog) hem de GitHub Pages gibi
   saf statik hosting ile calisir.
   ============================================================ */

'use strict';

const state = {
  config: null,
  items: [],
  category: 'all',
  query: '',
  sort: 'updated',
  ps4Ip: localStorage.getItem('henbox:ps4Ip') || '',
  current: null,
  cardRefs: []
};

/* ---------------- Yardimcilar ---------------- */

const $ = (sel) => document.querySelector(sel);

function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function toast(message, type = '') {
  const el = $('#toast');
  el.textContent = message;
  el.className = 'toast' + (type ? ' ' + type : '');
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 4200);
}

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return 'Bilinmiyor';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function categoryLabel(id) {
  const found = (state.config?.categories || []).find((c) => c.id === id);
  return found ? found.label : id;
}

/** Basit deterministik renk uretimi (kapak gorseli olmayan kartlar icin). */
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) >>> 0; }
  return h;
}

function coverFallbackSVG(item) {
  const hues = [
    [38, 212, 175, 55], [210, 90, 130, 220], [150, 60, 180, 120],
    [340, 200, 80, 120], [265, 140, 90, 220], [18, 220, 120, 70]
  ];
  const [hue, c1, c2, c3] = hues[hashString(item.id) % hues.length];
  const initials = item.title
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || 'HB';
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="rgb(${c1 * 0.45},${c2 * 0.45},${c3 * 0.45})"/>
        <stop offset="100%" stop-color="rgb(${c1 * 0.12},${c2 * 0.12},${c3 * 0.12})"/>
      </linearGradient>
      <radialGradient id="r" cx="0.8" cy="0.15" r="1">
        <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>
    </defs>
    <rect width="640" height="400" fill="url(#g)"/>
    <rect width="640" height="400" fill="url(#r)"/>
    <circle cx="540" cy="70" r="120" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="2"/>
    <circle cx="540" cy="70" r="80" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
    <text x="56" y="230" font-family="Segoe UI, Arial, sans-serif" font-size="120" font-weight="800" fill="rgba(255,255,255,0.92)">${initials}</text>
    <text x="58" y="285" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="600" fill="rgba(255,255,255,0.55)">HENBOX · ${hue}</text>
  </svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
}

function coverHTML(item, big = false) {
  const fallback = coverFallbackSVG(item);
  const src = item.covers && item.covers[0] ? item.covers[0] : fallback;
  return `<img src="${src}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${fallback}'" />`;
}

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

/* ---------------- Veri yukleme ---------------- */

async function load() {
  try {
    state.config = await fetchJSON('/api/config');
  } catch {
    state.config = await fetchJSON('/store.config.json');
  }

  try {
    const data = await fetchJSON('/api/catalog');
    state.items = data.items;
  } catch {
    // Statik hosting (orn. GitHub Pages): katalog dosyalarini ayri ayri cek.
    const merged = [];
    const seen = new Set();
    for (const file of state.config.catalogFiles) {
      try {
        const rows = await fetchJSON('/' + file);
        for (const row of rows) {
          if (!row.id || seen.has(row.id)) continue;
          seen.add(row.id);
          merged.push(row);
        }
      } catch {
        /* dosya henuz yoksa (orn. scraped.json) sessizce gec */
      }
    }
    state.items = merged;
  }

  $('#storeName').textContent = state.config.storeName;
  $('#storeTagline').textContent = state.config.tagline;
  $('#targetFw').textContent = state.config.targetFirmware;
  document.title = `${state.config.storeName} — PS4 Homebrew Magazasi`;

  renderPills();
  renderStats();
  render();
}

function renderStats() {
  const count = (cat) => state.items.filter((i) => i.category === cat).length;
  $('#statTotal').textContent = state.items.length;
  $('#statHomebrew').textContent = count('homebrew');
  $('#statGames').textContent = count('game');
  $('#statTools').textContent = count('tool');
}

function renderPills() {
  const wrap = $('#categoryPills');
  wrap.innerHTML = '';
  for (const cat of state.config.categories) {
    const btn = document.createElement('button');
    btn.className = 'pill' + (state.category === cat.id ? ' active' : '');
    btn.textContent = cat.label;
    btn.onclick = () => {
      state.category = cat.id;
      renderPills();
      render();
    };
    wrap.appendChild(btn);
  }
}

/* ---------------- Filtre + siralama + render ---------------- */

function visibleItems() {
  const q = state.query.trim().toLocaleLowerCase('tr');
  let list = state.items.filter((item) => {
    const inCat = state.category === 'all' || item.category === state.category;
    if (!inCat) return false;
    if (!q) return true;
    const hay = [item.title, item.developer, item.description, item.version]
      .filter(Boolean).join(' ').toLocaleLowerCase('tr');
    return hay.includes(q);
  });

  list.sort((a, b) => {
    if (state.sort === 'title') return a.title.localeCompare(b.title, 'tr');
    if (state.sort === 'size') return (b.size || 0) - (a.size || 0);
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  });
  return list;
}

function render() {
  const grid = $('#catalogGrid');
  const list = visibleItems();
  $('#emptyState').hidden = list.length > 0;
  grid.innerHTML = '';
  state.cardRefs = [];

  for (const item of list) {
    const card = document.createElement('article');
    card.className = 'card';
    card.tabIndex = 0;
    card.dataset.id = item.id;
    card.innerHTML = `
      <div class="card-cover">
        ${coverHTML(item)}
        <span class="cat-tag">${categoryLabel(item.category)}</span>
      </div>
      <div class="card-body">
        <div class="card-title">${item.title}</div>
        <div class="card-dev">${item.developer || 'Bilinmiyor'}</div>
        <div class="card-meta">
          <span class="fw">FW ${item.firmware || '—'}</span>
          <span>${item.sizeLabel || formatSize(item.size)}</span>
        </div>
      </div>`;
    card.addEventListener('click', () => openModal(item));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(item); }
    });
    grid.appendChild(card);
    state.cardRefs.push(card);
  }
}

/* ---------------- Detay modali ---------------- */

function openModal(item) {
  state.current = item;
  $('#modalCategory').textContent = categoryLabel(item.category);
  $('#modalTitle').textContent = item.title;
  $('#modalDeveloper').textContent = item.developer || 'Bilinmiyor';
  $('#modalCover').innerHTML = coverHTML(item, true);
  $('#modalDesc').textContent = item.description || 'Aciklama girilmemis.';

  const pkgs = item.packages || [];

  const meta = $('#modalMeta');
  meta.innerHTML = `
    <span>Surum: <b>${escapeHTML(item.version || '—')}</b></span>
    <span>Firmware: <b>${escapeHTML(item.firmware || '—')}</b></span>
    <span>Bölge: <b>${escapeHTML(item.region || '—')}</b></span>
    <span>Boyut: <b>${escapeHTML(item.sizeLabel || formatSize(item.size))}</b></span>
    <span>Kaynak: <b>${escapeHTML(item.source || 'manuel')}</b></span>
    ${pkgs.length ? '<span>Kurulum: <b>RPI · USB</b></span>' : ''}`;

  const pkgWrap = $('#modalPackages');
  pkgWrap.innerHTML = pkgs.length
    ? pkgs.map((u, i) => `
      <div class="pkg-row">
        <span class="pkg-ico">📦</span>
        <span class="pkg-url">${pkgs.length > 1 ? `<span class="pkg-part">Parça ${i + 1}:</span>` : ''}${escapeHTML(u)}</span>
        <a class="pkg-dl" href="${escapeHTML(u)}" target="_blank" rel="noopener" download
           title="PKG dosyasini indir (USB ile kurulum)">Indir</a>
      </div>`).join('')
    : '<div class="pkg-row"><span class="pkg-ico">ℹ</span><span class="pkg-url">Bu kayitta direkt paket baglantisi yok. Kaynak sayfayi ziyaret edin.</span></div>';

  const isPkg = item.type === 'pkg' && pkgs.length > 0;
  $('#sendBtn').disabled = !isPkg;
  $('#sendBtn').title = isPkg ? '' : 'RPI yalnizca .pkg paketleri kurabilir';

  // USB akisi: ana "PKG Indir" butonu ilk paketi (cok parcaliysa parca 1'i) indirir
  const dlBtn = $('#downloadBtn');
  if (pkgs.length) {
    dlBtn.href = pkgs[0];
    dlBtn.style.pointerEvents = 'auto';
    dlBtn.style.opacity = '1';
    dlBtn.title = pkgs.length > 1
      ? `Ilk parcayi indirir. Kalan ${pkgs.length - 1} parcayi asagidaki satirlardan indirin.`
      : 'PKG dosyasini bilgisayara indir, USB kokune kopyala';
  } else {
    dlBtn.removeAttribute('href');
    dlBtn.style.pointerEvents = 'none';
    dlBtn.style.opacity = '0.4';
    dlBtn.title = 'Bu kayitta indirilecek paket yok';
  }
  $('#installMethods').hidden = pkgs.length === 0;
  $('#checkBtn').hidden = !item.titleId;
  $('#homepageBtn').href = item.homepage || '#';
  $('#homepageBtn').style.pointerEvents = item.homepage ? 'auto' : 'none';
  $('#homepageBtn').style.opacity = item.homepage ? '1' : '0.4';
  $('#modalHint').textContent = isPkg
    ? 'Uzaktan kurulumda PS4\'te Remote Package Installer acik olmali; paket URL\'si konsolun erisebildigi bir HTTP adresi olmali. İndirdiginiz .pkg dosyasini USB kokune atip GoldHEN Package Installer ile de kurabilirsiniz.'
    : 'Payload/arsiv dosyalari RPI ile kurulmaz; GoldHEN/PPPwn kilavuzunu docs/PS4-KURULUM.md icinde bulabilirsiniz.';

  $('#modalBackdrop').hidden = false;
  $('#modalClose').focus();
}

function closeModal() {
  $('#modalBackdrop').hidden = true;
  state.current = null;
}

/* ---------------- RPI islemleri ---------------- */

function rpiCurl(item, ip) {
  const payload = JSON.stringify({ type: 'direct', packages: item.packages });
  return `curl -v 'http://${ip}:${state.config.rpiPort || 12800}/api/install' --data '${payload}'`;
}

async function sendToPS4() {
  const item = state.current;
  if (!item || !(item.packages || []).length) return;
  const ip = state.ps4Ip;
  if (!ip) {
    toast('Once PS4 IP adresini ayarlayin (⚙ PS4 Baglantisi).', 'error');
    openSettings();
    return;
  }

  toast('PS4\'e komut gonderiliyor...');
  const body = { ps4Ip: ip, packages: item.packages, title: item.title };

  try {
    // 1) Once Node sunucusundaki ucu dene (CORS sorununu ortadan kaldirir)
    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.ok) {
      toast(data.message || 'Paket PS4\'e gonderildi. Konsol bildirimlerini kontrol edin.', 'ok');
    } else {
      toast(data.error || 'Gonderim basarisiz.', 'error');
    }
  } catch {
    // 2) Statik hosting: dogrudan RPI'ye dene; CORS engellerse curl komutunu goster
    try {
      const res = await fetch(`http://${ip}:${state.config.rpiPort || 12800}/api/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'direct', packages: item.packages })
      });
      if (res.ok) toast('Paket PS4\'e gonderildi.', 'ok');
      else throw new Error('RPI hata');
    } catch (err) {
      const cmd = rpiCurl(item, ip);
      $('#modalHint').innerHTML =
        'Tarayicinin CORS guvenligi dogrudan baglantiyi engelledi. Ayni agdaki bir bilgisayardan su komutu calistirin:<br><br>' +
        `<code style="display:block;background:#0a0c12;border:1px solid var(--line);border-radius:8px;padding:10px;word-break:break-all;color:var(--gold-bright)">${cmd.replace(/</g, '&lt;')}</code>`;
      navigator.clipboard?.writeText(cmd).catch(() => {});
      toast('CORS engeli: hazir curl komutu panoya kopyalandi.', 'error');
    }
  }
}

async function checkOnConsole() {
  const item = state.current;
  if (!item?.titleId) return;
  if (!state.ps4Ip) { openSettings(); return; }
  try {
    const res = await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ps4Ip: state.ps4Ip, titleId: item.titleId })
    });
    const data = await res.json();
    toast(data.ok ? `RPI yanit verdi: ${JSON.stringify(data.rpiResponse?.data || '')}` : (data.error || 'Sorgu basarisiz'), data.ok ? 'ok' : 'error');
  } catch {
    toast('Sunucu ucu kullanilamiyor (statik hosting). Ayarlardaki IP ile RPI\'yi dogrudan test edin.', 'error');
  }
}

/* ---------------- Ayarlar ---------------- */

function openSettings() { $('#settingsBackdrop').hidden = false; $('#ps4IpInput').value = state.ps4Ip; $('#ps4IpInput').focus(); }
function closeSettings() { $('#settingsBackdrop').hidden = true; }

function saveSettings() {
  const val = $('#ps4IpInput').value.trim();
  state.ps4Ip = val;
  if (val) localStorage.setItem('henbox:ps4Ip', val);
  else localStorage.removeItem('henbox:ps4Ip');
  closeSettings();
  toast('PS4 IP adresi kaydedildi.', 'ok');
}

/* ---------------- Klavye + gamepad navigasyon ---------------- */

function moveFocus(dir) {
  const cards = state.cardRefs;
  if (!cards.length) return;
  const idx = cards.indexOf(document.activeElement);
  const perRow = Math.max(1, Math.floor(gridWidth() / 245));
  let next = idx;
  if (dir === 'right') next = idx < 0 ? 0 : Math.min(cards.length - 1, idx + 1);
  if (dir === 'left') next = idx < 0 ? 0 : Math.max(0, idx - 1);
  if (dir === 'down') next = idx < 0 ? 0 : Math.min(cards.length - 1, idx + perRow);
  if (dir === 'up') next = idx < 0 ? 0 : Math.max(0, idx - perRow);
  cards[next]?.focus();
}

function gridWidth() {
  return $('#catalogGrid').getBoundingClientRect().width || 1000;
}

document.addEventListener('keydown', (e) => {
  if (!$('#modalBackdrop').hidden) {
    if (e.key === 'Escape') closeModal();
    return;
  }
  if (!$('#settingsBackdrop').hidden) {
    if (e.key === 'Escape') closeSettings();
    return;
  }
  if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
    e.preventDefault();
    moveFocus(e.key.replace('Arrow', '').toLowerCase());
  }
});

/* PS4 tarayicisi icin temel gamepad destegi: D-Pad gezinir, × (0) acar, ○ (1) kapatir */
let lastPadButtons = '';
window.addEventListener('gamepadconnected', () => toast('Gamepad bagli: D-Pad ile gezin, × ile ac, ○ ile kapat.'));
setInterval(() => {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = pads[0];
  if (!pad) return;
  const pressed = pad.buttons.map((b, i) => (b.pressed ? i : -1)).filter((i) => i >= 0).join(',');
  if (pressed === lastPadButtons) return;
  lastPadButtons = pressed;
  const ids = pressed.split(',').filter(Boolean).map(Number);
  if (!ids.length) return;
  if (!$('#modalBackdrop').hidden) {
    if (ids.includes(1)) closeModal();
    if (ids.includes(0)) $('#sendBtn').click();
    return;
  }
  if (ids.includes(14)) moveFocus('left');
  else if (ids.includes(15)) moveFocus('right');
  else if (ids.includes(12)) moveFocus('up');
  else if (ids.includes(13)) moveFocus('down');
  else if (ids.includes(0)) (document.activeElement?.classList.contains('card') ? document.activeElement : state.cardRefs[0])?.click();
}, 120);

/* ---------------- Event baglantilari ---------------- */

$('#searchInput').addEventListener('input', (e) => { state.query = e.target.value; render(); });
$('#sortSelect').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
$('#modalClose').addEventListener('click', closeModal);
$('#modalBackdrop').addEventListener('click', (e) => { if (e.target.id === 'modalBackdrop') closeModal(); });
$('#settingsBtn').addEventListener('click', openSettings);
$('#settingsClose').addEventListener('click', closeSettings);
$('#settingsBackdrop').addEventListener('click', (e) => { if (e.target.id === 'settingsBackdrop') closeSettings(); });
$('#saveSettingsBtn').addEventListener('click', saveSettings);
$('#ps4IpInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveSettings(); });
$('#sendBtn').addEventListener('click', sendToPS4);
$('#checkBtn').addEventListener('click', checkOnConsole);
$('#copyBtn').addEventListener('click', async () => {
  const item = state.current;
  if (!(item.packages || []).length) { toast('Kopyalanacak paket linki yok.', 'error'); return; }
  try {
    await navigator.clipboard.writeText(item.packages.join('\n'));
    toast('Paket linki panoya kopyalandi.', 'ok');
  } catch {
    toast('Tarayici panoya yazmaya izin vermedi.', 'error');
  }
});

load().catch((err) => {
  console.error(err);
  toast('Katalog yuklenemedi: ' + err.message, 'error');
});
