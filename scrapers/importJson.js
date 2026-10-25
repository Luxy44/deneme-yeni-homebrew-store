/**
 * Harici JSON listesini kataloga aktarir.
 *
 * Kullanim:
 *   node scrapers/importJson.js benim-oyunlarim.json
 *   node scrapers/importJson.js liste.json --target apps
 *
 * Beklenen format: katalog şemasiyla ayni nesneleri iceren bir JSON dizisi.
 * Eksik alanlar normalizeEntry ile doldurulur; ayni id'li kayitlar yenisiyle
 * guncellenir. Hedef varsayilan olarak catalog/games.json dosyasidir.
 */

const fs = require('fs');
const path = require('path');
const { readJson, writeJson, normalizeEntry, validateEntry, ROOT } = require('./lib/catalog');

function parseArgs(argv) {
  const positional = argv.slice(2).filter((a) => !a.startsWith('--'));
  const target = argv.includes('--target') ? argv[argv.indexOf('--target') + 1] : 'games';
  return { file: positional[0], target };
}

function main() {
  const { file, target } = parseArgs(process.argv);
  if (!file) {
    console.error('Kullanim: node scrapers/importJson.js <dosya.json> [--target apps|games]');
    process.exit(1);
  }
  if (!['apps', 'games'].includes(target)) {
    console.error('--target sadece "apps" veya "games" olabilir.');
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  if (!Array.isArray(raw)) {
    console.error('JSON dosyasi bir dizi (array) icermeli.');
    process.exit(1);
  }

  const targetFile = path.join(ROOT, 'catalog', `${target}.json`);
  const current = readJson(targetFile);
  const existingIds = new Set(current.map((e) => e.id));
  const map = new Map(current.map((e) => [e.id, e]));

  let added = 0;
  let updated = 0;
  for (const row of raw) {
    const entry = normalizeEntry(row, row.source || 'import', existingIds);
    const errors = validateEntry(entry);
    if (errors.length) {
      console.warn(`[atlandi] ${entry.title}: ${errors.join('; ')}`);
      continue;
    }
    if (map.has(entry.id)) updated++; else added++;
    map.set(entry.id, entry);
    existingIds.add(entry.id);
  }

  const result = [...map.values()].sort((a, b) => a.title.localeCompare(b.title, 'tr'));
  writeJson(targetFile, result);
  console.log(`✓ ${added} yeni kayit eklendi, ${updated} kayit guncellendi -> ${path.relative(process.cwd(), targetFile)} (toplam ${result.length})`);
}

main();
