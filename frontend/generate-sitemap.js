const fs = require('fs');
const path = require('path');
const { CONVERTERS } = require('./converters.js');

const BASE_URL = "https://freeunitsconverter.com";
const STATIC_DIR = path.join(__dirname, 'static-pages'); // path to your generated pages
const SITEMAP_FILE = path.join(__dirname, 'sitemap.xml');

function formatDate(date) {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

function getLastModified(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return formatDate(stats.mtime);
  } catch (err) {
    return null; // file missing
  }
}

function generateSitemap() {
  let urls = [];

  // Homepage
  const homepageFile = path.join(STATIC_DIR, 'index.html');
  urls.push({
    loc: BASE_URL + '/',
    lastmod: getLastModified(homepageFile),
    priority: 1.0
  });

  // Category pages and converter pages
  for (const cat of CONVERTERS) {
    const catFile = path.join(STATIC_DIR, cat.id, 'index.html');
    urls.push({
      loc: `${BASE_URL}/${cat.id}`,
      lastmod: getLastModified(catFile),
      priority: 0.8
    });

    const units = Object.keys(cat.units);
    for (let i = 0; i < units.length; i++) {
      for (let j = 0; j < units.length; j++) {
        if (i === j) continue;
        const convPath = path.join(STATIC_DIR, cat.id, `${units[i]}-to-${units[j]}`, 'index.html');
        urls.push({
          loc: `${BASE_URL}/${cat.id}/${units[i]}-to-${units[j]}`,
          lastmod: getLastModified(convPath),
          priority: 0.7
        });
      }
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => {
  return `<url>
  <loc>${u.loc}</loc>
  ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
  <priority>${u.priority}</priority>
</url>`;
}).join('\n')}
</urlset>`;

  fs.writeFileSync(SITEMAP_FILE, xml, 'utf8');
  console.log(`Sitemap generated with ${urls.length} URLs.`);
}

generateSitemap();
