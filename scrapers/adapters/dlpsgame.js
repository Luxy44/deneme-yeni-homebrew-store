/**
 * dlpsgame.com adapter'i
 * -------------------------------------------------------------
 * NOT: Seciciler sitenin bilinen WordPress yapsina gore yazilmis
 * BASLANGIC SABLONUDUR. Calistirmadan once --dry-run ile ciktisini
 * kontrol edin ve gerekiyorsa asagidaki secicileri guncelleyin.
 * Indirme linkleri cogunlukla ara sayfalara/filehostlara ciktigi
 * icin packages[] listesini manuel olarak gozden gecirin.
 */

const { BaseAdapter } = require('./BaseAdapter');

class DlpsGameAdapter extends BaseAdapter {
  constructor() {
    super({
      name: 'dlpsgame',
      baseUrl: 'https://dlpsgame.com/',
      listPaths: ['category/ps4/', 'category/ps4-game/'],
      delay: 1500,
      selectors: {
        list: {
          item: 'article.post, .blog-post, article',
          title: 'h2.entry-title a, .post-title a, h2 a',
          link: 'h2.entry-title a, .post-title a, h2 a',
          cover: '.post-thumbnail img, img.attachment-post-thumbnail, img'
        },
        detail: {
          title: 'h1.entry-title, h1.post-title, h1',
          developer: '.entry-content li:contains("Publisher"), table td:contains("Publisher")',
          version: '.entry-content li:contains("Version"), table td:contains("Version")',
          firmware: '.entry-content li:contains("Firmware"), .entry-content p:contains("Firmware"), table td:contains("Firmware")',
          region: '.entry-content li:contains("Region"), table td:contains("Region")',
          size: '.entry-content li:contains("Size"), .entry-content p:contains("GB"), table td:contains("Size")',
          description: '.entry-content p',
          covers: '.entry-content img, .post-thumbnail img',
          downloadLinks:
            '.entry-content a:contains("Download"), .entry-content a:contains("Link"), ' +
            '.download-box a, .btn-download a, a.button, .entry-content a[href$=".pkg"]'
        }
      }
    });
  }

  parseDetail($, pageUrl, listItem) {
    const detail = super.parseDetail($, pageUrl, listItem);
    const bodyText = $('.entry-content').text();
    const fw = bodyText.match(/(?:FW|Firmware|Required)\s*:?\s*([0-9]{1,2}\.[0-9]{2}(?:\s*[-–+])?)/i);
    if (fw) detail.firmware = fw[1].trim();
    // Dosya barindirma sayfasi disindaki gezinme baglantilarini ele
    detail.packages = detail.packages.filter((u) => !/\/(category|tag|page|wp-login)/.test(u));
    return detail;
  }
}

module.exports = DlpsGameAdapter;
