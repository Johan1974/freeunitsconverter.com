const fs = require('fs');
const { CONVERTERS } = require('./converters.js');

const BASE_URL = "https://freeunitsconverter.com";

function generateSitemap() {
  let urls = [];

  // Homepage
  urls.push({ loc: BASE_URL + "/", priority: 1.0 });

  // Category pages
  for (const conv of CONVERTERS) {
    urls.push({
      loc: `${BASE_URL}/${conv.id}`,
      priority: 0.8
    });
  }

  // XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => 
  `<url><loc>${u.loc}</loc><priority>${u.priority}</priority></url>`).join("\n")}
</urlset>`;

  fs.writeFileSync("sitemap.xml", xml, "utf8");
  console.log("Sitemap generated with SEO-friendly paths.");
}

generateSitemap();
