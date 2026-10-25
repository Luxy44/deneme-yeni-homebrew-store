/**
 * BaseAdapter — site adapterlerinin ortak iskeleti.
 *
 * Calisma bicimi:
 *   1) listPaths altindaki liste sayfalarini ceker
 *   2) selectors.list ile kartlari (baslik, detay linki, kapak) ayiklar
 *   3) her kartin detay sayfasini ceker ve selectors.detail ile
 *      surum, boyut, aciklama ve INDIRME linklerini toplar
 *   4) hepsini katalog şemasina normalize eder
 *
 * Seciciler (CSS selector) site tasarimi degistikce guncellenmelidir;
 * bu yuzden her adapter dosyasinda seciciler tek noktada toplanmistir.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { normalizeEntry } = require('../lib/catalog');

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function absoluteUrl(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

/** "12.4 GB", "850 MB", "1.024 KB" gibi metinleri bayta cevirir. */
function parseSize(text) {
  if (!text) return null;
  const m = String(text).replace(',', '.').match(/([\d.]+)\s*(KB|MB|GB|TB)/i);
  if (!m) return null;
  const value = parseFloat(m[1]);
  const factor = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4 }[m[2].toUpperCase()];
  return Math.round(value * factor);
}

class BaseAdapter {
  constructor(config) {
    this.config = {
      name: 'generic',
      baseUrl: '',
      listPaths: [],
      fetchDetails: true,
      delay: 1200,        // istekler arasi bekleme (nazik kazima)
      timeout: 20000,
      maxRetries: 2,
      selectors: {
        list: { item: '', title: '', link: '', cover: '' },
        detail: {
          title: '', developer: '', version: '', firmware: '',
          region: '', size: '', description: '', covers: '',
          downloadLinks: ''
        }
      },
      ...config
    };
  }

  async fetchHTML(url) {
    let lastErr;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const res = await axios.get(url, {
          headers: BROWSER_HEADERS,
          timeout: this.config.timeout,
          responseType: 'text',
          maxRedirects: 5
        });
        return res.data;
      } catch (err) {
        lastErr = err;
        await sleep(this.config.delay * (attempt + 1));
      }
    }
    throw new Error(`${this.config.name}: ${url} cekilemedi -> ${lastErr.message}`);
  }

  /** Liste sayfasindan ham kartlari cikarir. */
  parseList(html, pageUrl) {
    const $ = cheerio.load(html);
    const sel = this.config.selectors.list;
    const results = [];
    $(sel.item).each((_, el) => {
      const node = $(el);
      const title = sel.title ? node.find(sel.title).first().text().trim() : node.text().trim();
      const linkHref = sel.link ? node.find(sel.link).first().attr('href') : node.find('a').first().attr('href');
      const coverSrc = sel.cover ? node.find(sel.cover).first().attr('src') || node.find(sel.cover).first().attr('data-src') : '';
      if (!title || !linkHref) return;
      results.push({
        title,
        link: absoluteUrl(linkHref, pageUrl),
        covers: coverSrc ? [absoluteUrl(coverSrc, pageUrl)] : []
      });
    });
    return results;
  }

  /**
   * Detay sayfasi ayiklama. Varsayilan davranis tamamen secici tabanlidir;
   * ozel yapidaki siteler icin alt sinir bu metodu override edebilir.
   */
  parseDetail($, pageUrl, listItem) {
    const sel = this.config.selectors.detail;
    const text = (s) => (s ? $(s).first().text().trim() : '');
    const hrefs = (s) => (s
      ? $(s).map((_, el) => $(el).attr('href')).get().filter(Boolean).map((u) => absoluteUrl(u, pageUrl))
      : []);

    const sizeText = text(sel.size);
    const covers = sel.covers
      ? $(sel.covers).map((_, el) => $(el).attr('src') || $(el).attr('data-src')).get().filter(Boolean).map((u) => absoluteUrl(u, pageUrl))
      : [];

    // "Firmware: 9.00" gibi alan etiketlerini temizle
    const stripLabel = (t) =>
      (t || '').replace(/^(firmware|fw|region|size|boyut|surum|version|publisher|developer|gelistirici)\s*:?\s*/i, '').trim();

    return {
      title: text(sel.title) || listItem.title,
      developer: stripLabel(text(sel.developer)) || undefined,
      version: stripLabel(text(sel.version)) || undefined,
      firmware: stripLabel(text(sel.firmware)) || undefined,
      region: stripLabel(text(sel.region)) || undefined,
      size: parseSize(sizeText),
      sizeLabel: stripLabel(sizeText) || null,
      description: text(sel.description),
      covers: [...new Set([...(listItem.covers || []), ...covers])],
      packages: hrefs(sel.downloadLinks).filter((u) => /^https?:\/\//i.test(u)),
      homepage: pageUrl
    };
  }

  async parseDetailPage(listItem) {
    const html = await this.fetchHTML(listItem.link);
    const $ = cheerio.load(html);
    return this.parseDetail($, listItem.link, listItem);
  }

  async collect({ limit = null, logger = console } = {}) {
    const existingIds = new Set();
    const entries = [];
    for (const listPath of this.config.listPaths) {
      const pageUrl = absoluteUrl(listPath, this.config.baseUrl);
      logger.log(`[${this.config.name}] liste cekiliyor: ${pageUrl}`);
      const html = await this.fetchHTML(pageUrl);
      const items = this.parseList(html, pageUrl);
      logger.log(`[${this.config.name}] ${items.length} kart bulundu`);

      const slice = limit ? items.slice(0, limit) : items;
      for (const item of slice) {
        let detail = {};
        if (this.config.fetchDetails) {
          try {
            await sleep(this.config.delay);
            detail = await this.parseDetailPage(item);
          } catch (err) {
            logger.warn(`[${this.config.name}] detay hatasi (${item.link}): ${err.message}`);
          }
        }
        const merged = { ...item, ...detail, homepage: item.link };
        const entry = normalizeEntry(merged, this.config.name, existingIds);
        existingIds.add(entry.id);
        entries.push(entry);
      }
    }
    return entries;
  }
}

module.exports = { BaseAdapter, parseSize, absoluteUrl, sleep };
