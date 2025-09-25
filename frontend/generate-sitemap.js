const fs = require('fs');
const path = require('path');
const { CONVERTERS } = require('./converters.js');

// Load environment variables
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const BASE_URL = process.env.SITE_URL_PRD.replace(/\/$/, ''); // remove trailing slash

// Paths
const STATIC_DIR = path.join(__dirname, 'static-pages'); 
const SITEMAP_FILE = path.join(__dirname, 'sitemap.xml');

// Helper to safely join URLs without double slashes
function joinUrl(base, ...paths) {
  const trimmedPaths = paths.map(p => p.replace(/^\/|\/$/g, ''));
  return [base, ...trimmedPaths].join('/');
}

// Format date YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Get last modified date of a file
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

  // Homepage (no trailing slash)
  const homepageFile = path.join(STATIC_DIR, 'index.html');
  if (fs.existsSync(homepageFile)) {
    urls.push({
      loc: BASE_URL,
      lastmod: getLastModified(homepageFile),
      priority: 1.0
    });
  }

  // Category pages and converter pages
  for (const cat of CONVERTERS) {
    const catFolder = path.join(STATIC_DIR, cat.id);
    const catFile = path.join(catFolder, 'index.html');

    if (fs.existsSync(catFile)) {
      urls.push({
        loc: joinUrl(BASE_URL, cat.id),
        lastmod: getLastModified(catFile),
        priority: 0.8
      });
    }

    const units = Object.keys(cat.units);
    for (let i = 0; i < units.length; i++) {
      for (let j = 0; j < units.length; j++) {
        if (i === j) continue;

        const convFolder = path.join(catFolder, `${units[i]}-to-${units[j]}`);
        const convFile = path.join(convFolder, 'index.html');

        if (fs.existsSync(convFile)) {
          urls.push({
            loc: joinUrl(BASE_URL, cat.id, `${units[i]}-to-${units[j]}`),
            lastmod: getLastModified(convFile),
            priority: 0.7
          });
        }
      }
    }
  }

  // Write sitemap XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `<url>
  <loc>${u.loc}</loc>
  ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
  <priority>${u.priority}</priority>
</url>`).join('\n')}
</urlset>`;

  fs.writeFileSync(SITEMAP_FILE, xml, 'utf8');
  console.log(`✅ Sitemap generated with ${urls.length} URLs.`);
}

generateSitemap();
