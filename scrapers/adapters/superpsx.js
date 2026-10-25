/**
 * superpsx.com adapter'i
 * -------------------------------------------------------------
 * NOT: Diger adapterler gibi bu seciciler de BASLANGIC SABLONUDUR;
 * site guncellendiginde --dry-run ciktisina gore duzeltilmelidir.
 * SuperPSX indirme akisi genelde birden fazla ara sayfa icerir;
 * dogrudan .pkg linki elde etmek icin son adimi manuel dogrulayin.
 */

const { BaseAdapter } = require('./BaseAdapter');

class SuperPsxAdapter extends BaseAdapter {
  constructor() {
    super({
      name: 'superpsx',
      baseUrl: 'https://www.superpsx.com/',
      listPaths: ['category/ps4/', 'category/ps4-games/'],
      delay: 1500,
      selectors: {
        list: {
          item: 'article.post, .post, article',
          title: 'h2.entry-title a, h2 a',
          link: 'h2.entry-title a, h2 a',
          cover: '.post-thumbnail img, img.attachment-post-thumbnail, img'
        },
        detail: {
          title: 'h1.entry-title, h1',
          developer: '.entry-content li:contains("Publisher"), .entry-content p:contains("Publisher")',
          version: '.entry-content li:contains("Version"), .entry-content p:contains("Version")',
          firmware: '.entry-content li:contains("Firmware"), .entry-content p:contains("FW"), .entry-content p:contains("Firmware")',
          region: '.entry-content li:contains("Region"), .entry-content p:contains("Region")',
          size: '.entry-content li:contains("Size"), .entry-content p:contains("GB"), .entry-content p:contains("Size")',
          description: '.entry-content p',
          covers: '.entry-content img, .post-thumbnail img',
          downloadLinks:
            '.entry-content a:contains("Download"), .entry-content a:contains("Get"), ' +
            '.download-container a, .btn-primary, a.download, .entry-content a[href$=".pkg"]'
        }
      }
    });
  }

  parseDetail($, pageUrl, listItem) {
    const detail = super.parseDetail($, pageUrl, listItem);
    const bodyText = $('.entry-content').text();
    const fw = bodyText.match(/(?:FW|Firmware)\s*:?\s*([0-9]{1,2}\.[0-9]{2}(?:\s*[-–+])?)/i);
    if (fw) detail.firmware = fw[1].trim();
    detail.packages = detail.packages.filter((u) => !/\/(category|tag|page|wp-content\/themes)/.test(u));
    return detail;
  }
}

module.exports = SuperPsxAdapter;
