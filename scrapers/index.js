/**
 * Scraper calistirici (CLI)
 *
 * Kullanim:
 *   node scrapers/index.js                         # tum adapterler, catalog/scraped.json yazar
 *   node scrapers/index.js --dry-run               # sadece ekrana basar, dosya degistirmez
 *   node scrapers/index.js --site mcpsp            # tek adapter
 *   node scrapers/index.js --site mcpsp,dlpsgame --limit 5
 *
 * Not: --dry-run disinda calistiginda kayitlari catalog/scraped.json
 * dosyasina birlestirir. Bu dosya .gitignore ile surum kontrolune girmez;
 * boylece otomatik kazima ciktilari repoyu kirletmez.
 */

const path = require('path');
const McpspAdapter = require('./adapters/mcpsp');
const DlpsGameAdapter = require('./adapters/dlpsgame');
const SuperPsxAdapter = require('./adapters/superpsx');
const { mergeScraped, writeJson, SCRAPED_FILE, validateEntry } = require('./lib/catalog');

const ADAPTERS = {
  mcpsp: McpspAdapter,
  dlpsgame: DlpsGameAdapter,
  superpsx: SuperPsxAdapter
};

function parseArgs(argv) {
  const args = { dryRun: false, sites: [], limit: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--site') args.sites = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--limit') args.limit = parseInt(argv[++i], 10) || null;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const wanted = args.sites.length ? args.sites : Object.keys(ADAPTERS);
  const unknown = wanted.filter((name) => !ADAPTERS[name]);
  if (unknown.length) {
    console.error(`Bilinmeyen adapter(ler): ${unknown.join(', ')}. Mevcut: ${Object.keys(ADAPTERS).join(', ')}`);
    process.exit(1);
  }

  const all = [];
  for (const name of wanted) {
    const adapter = new ADAPTERS[name]();
    try {
      const entries = await adapter.collect({ limit: args.limit });
      console.log(`[${name}] ${entries.length} kayit normalize edildi`);
      all.push(...entries);
    } catch (err) {
      console.error(`[${name}] HATA: ${err.message}`);
    }
  }

  if (!all.length) {
    console.log('Hic kayit uretilemedi. Secicileri kontrol edin (scrapers/adapters/*.js).');
    process.exit(args.dryRun ? 0 : 1);
  }

  // Sema kontrolu (uyari olarak goster, akisi durdurmaz)
  for (const entry of all) {
    const errors = validateEntry(entry);
    if (errors.length) console.warn(`[uyari] ${entry.id}: ${errors.join('; ')}`);
  }

  console.log('\n— Uretilen kayitlar —');
  for (const e of all) {
    console.log(`  • ${e.title} [${e.category}] ${e.sizeLabel} | paket: ${e.packages.length} | ${e.homepage}`);
  }

  if (args.dryRun) {
    console.log('\n--dry-run modunda dosyaya yazilmadi.');
    return;
  }

  const merged = mergeScraped(all);
  writeJson(SCRAPED_FILE, merged);
  console.log(`\n✓ ${all.length} yeni/guncellenen kayit islendi. Toplam ${merged.length} kayit -> ${path.relative(process.cwd(), SCRAPED_FILE)}`);
}

main().catch((err) => {
  console.error('Scraper calistirilamadi:', err);
  process.exit(1);
});
