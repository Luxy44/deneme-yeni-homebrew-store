/**
 * Katalog okuma/yazma ve normalize etme yardimcilari.
 * Tum scraper adapterleri ayni şemayi uretir:
 *
 * {
 *   id, title, developer, category, type, version, firmware, region,
 *   size, sizeLabel, titleId, description, covers[], packages[],
 *   homepage, source, updatedAt
 * }
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SCRAPED_FILE = path.join(ROOT, 'catalog', 'scraped.json');

const REQUIRED = ['id', 'title', 'category'];
const ALLOWED_CATEGORIES = ['homebrew', 'game', 'tool', 'payload', 'theme'];

function slugify(text) {
  return String(text)
    .toLocaleLowerCase('tr')
    .replace(/İ/g, 'i')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'kayit';
}

function uniqueId(base, existing = new Set()) {
  let id = base;
  let n = 2;
  while (existing.has(id)) {
    id = `${base}-${n++}`;
  }
  return id;
}

function readJson(file) {
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** Ham veriyi katalog şemasina cevirir; eksik alanlari guvenli varsayilanlarla doldurur. */
function normalizeEntry(raw, sourceName, existingIds) {
  const title = (raw.title || 'Basliksiz').trim();
  const entry = {
    id: raw.id || uniqueId(`${sourceName}-${slugify(title)}`, existingIds),
    title,
    developer: raw.developer || 'Bilinmiyor',
    category: ALLOWED_CATEGORIES.includes(raw.category) ? raw.category : 'game',
    type: raw.type || 'pkg',
    version: raw.version || '1.00',
    firmware: raw.firmware || 'Bilinmiyor',
    region: raw.region || 'GLOBAL',
    size: Number.isFinite(raw.size) ? raw.size : null,
    sizeLabel: raw.sizeLabel || (Number.isFinite(raw.size) ? `${(raw.size / 1048576).toFixed(1)} MB` : 'Bilinmiyor'),
    titleId: raw.titleId || null,
    description: (raw.description || '').trim().slice(0, 1200),
    covers: Array.isArray(raw.covers) ? raw.covers.filter(Boolean).slice(0, 4) : [],
    packages: Array.isArray(raw.packages) ? raw.packages.filter(Boolean) : [],
    homepage: raw.homepage || '',
    source: raw.source || sourceName,
    updatedAt: raw.updatedAt || new Date().toISOString().slice(0, 10)
  };
  return entry;
}

/** Yeni kayitlari mevcut scraped.json ile birlestirir (id bazli, yeni veri kazanir). */
function mergeScraped(newEntries) {
  const current = readJson(SCRAPED_FILE);
  const map = new Map(current.map((e) => [e.id, e]));
  for (const entry of newEntries) map.set(entry.id, entry);
  return [...map.values()].sort((a, b) => a.title.localeCompare(b.title, 'tr'));
}

function validateEntry(entry) {
  const errors = [];
  for (const key of REQUIRED) {
    const val = entry[key];
    if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
      errors.push(`zorunlu alan eksik: ${key}`);
    }
  }
  if (entry.category && !ALLOWED_CATEGORIES.includes(entry.category)) {
    errors.push(`gecersiz kategori: ${entry.category}`);
  }
  const packages = entry.packages || [];
  if (packages.length === 0 && !entry.homepage) {
    errors.push('kayitta en az bir paket URL\'si veya homepage baglantisi olmali');
  }
  for (const url of packages) {
    if (!/^https?:\/\//i.test(url)) errors.push(`paket URL'si http(s) ile baslamali: ${url}`);
  }
  return errors;
}

module.exports = {
  ROOT,
  SCRAPED_FILE,
  slugify,
  uniqueId,
  readJson,
  writeJson,
  normalizeEntry,
  mergeScraped,
  validateEntry,
  ALLOWED_CATEGORIES
};
