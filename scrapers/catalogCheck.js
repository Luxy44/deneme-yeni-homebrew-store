/**
 * Katalog dogrulayici: store.config.json icinde tanimli tum katalog
 * dosyalarini okur, sema hatalarini ve cift id'leri raporlar.
 *
 * Kullanim:
 *   node scrapers/catalogCheck.js
 *
 * Cikis kodu: hata varsa 1, aksi halde 0 (CI'da kullanilabilir).
 */

const fs = require('fs');
const path = require('path');
const { validateEntry, ROOT } = require('./lib/catalog');

function main() {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'store.config.json'), 'utf8'));
  const seen = new Map();
  let errors = 0;
  let warnings = 0;
  let total = 0;

  for (const rel of config.catalogFiles) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) {
      console.warn(`~ ${rel} henuz yok (normal olabilir, ornegin scraped.json)`);
      continue;
    }
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    console.log(`\n${rel}: ${rows.length} kayit`);
    for (const row of rows) {
      total++;
      const problems = validateEntry(row);
      if (problems.length) {
        errors += problems.length;
        console.log(`  ✗ ${row.id || row.title || '?'}: ${problems.join('; ')}`);
      }
      if (seen.has(row.id)) {
        errors++;
        console.log(`  ✗ ${row.id}: cift id (ilk gorulme: ${seen.get(row.id)})`);
      } else {
        seen.set(row.id, rel);
      }
      if (!row.homepage) {
        warnings++;
        console.log(`  ~ ${row.id}: homepage alani bos`);
      }
    }
  }

  console.log(`\n———————————————————————————————`);
  console.log(`Toplam ${total} kayit | ${errors} hata | ${warnings} uyari`);
  process.exit(errors ? 1 : 0);
}

main();
