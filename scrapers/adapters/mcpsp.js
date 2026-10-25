/**
 * mcpsp.com adapter'i
 * -------------------------------------------------------------
 * NOT: Bu seciciler sitenin yaygin WordPress tema yapisina gore
 * HAZIRLANMIS BASLANGIC SABLONUDUR. Sitede tasarim degistiyse
 * `npm run scrape:dry -- --site mcpsp` ile deneyip asagidaki
 * secicileri guncelleyin. Her adapter BaseAdapter ile ayni
 * normalize şemasini uretir.
 */

const { BaseAdapter } = require('./BaseAdapter');

class McpspAdapter extends BaseAdapter {
  constructor() {
    super({
      name: 'mcpsp',
      baseUrl: 'https://mcpsp.com/',
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
          size: '.entry-content li:contains("Size"), .entry-content p:contains("Size"), .entry-content p:contains("GB")',
          description: '.entry-content p',
          covers: '.entry-content img, .post-thumbnail img',
          // Indirme butonlari genelde icerikteki baglantilar olarak durur
          downloadLinks:
            '.entry-content a:contains("Download"), .entry-content a:contains("Indir"), ' +
            '.download-button a, .btn-download a, a.download, .entry-content a[href$=".pkg"]'
        }
      }
    });
  }

  /** Icerik metninden firmware bilgisini yakalamaya calis (orn. "FW 5.05+"). */
  parseDetail($, pageUrl, listItem) {
    const detail = super.parseDetail($, pageUrl, listItem);
    const bodyText = $('.entry-content').text();
    const fw = bodyText.match(/(?:FW|Firmware)\s*:?\s*([0-9]{1,2}\.[0-9]{2}(?:\s*[-–+])?)/i);
    if (fw && (!detail.firmware || detail.firmware.length > 40)) detail.firmware = fw[1].trim();
    detail.packages = detail.packages.filter((u) => !/^https?:\/\/(mcpsp\.com)?\/?(wp-content|tag|category|page)/.test(u));
    return detail;
  }
}

module.exports = McpspAdapter;
