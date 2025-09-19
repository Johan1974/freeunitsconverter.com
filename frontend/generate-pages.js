const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load .env

const SITE_URL_DEV = process.env.SITE_URL_DEV || 'http://localhost:8080';
const SITE_URL_PRD = process.env.SITE_URL_PRD || 'https://freeunitsconverter.com';
const ENV = process.env.NODE_ENV || 'dev';
const SITE_URL = ENV === 'prd' ? SITE_URL_PRD : SITE_URL_DEV;

function makeHtml(catId, catLabel, fromUnit, toUnit) {
  const prettyFrom = fromUnit.replace(/_/g, " ");
  const prettyTo = toUnit.replace(/_/g, " ");
  const title = `${prettyFrom} to ${prettyTo} Converter | Free Units Converter`;
  const desc = `Convert ${prettyFrom} to ${prettyTo} instantly with our free, accurate, and easy-to-use ${catLabel.toLowerCase()} converter.`;
  const h1 = `${prettyFrom} to ${prettyTo} Converter`;

  // JSON-LD structured data uses SITE_URL (matches environment)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": `${prettyFrom} to ${prettyTo} Converter`,
    "url": `${SITE_URL}/${catId}/${fromUnit}-to-${toUnit}/`,
    "description": desc,
    "mainEntity": {
      "@type": "UnitConversion",
      "fromUnit": fromUnit,
      "toUnit": toUnit
    }
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${desc}">

  <!-- Canonical always points to PROD -->
  <link rel="canonical" href="${SITE_URL_PRD}/${catId}/${fromUnit}-to-${toUnit}/">

  <!-- Minimal Critical CSS -->
  <style>
    html,body{margin:0;padding:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#111;background:#fff}
    .site{max-width:980px;margin:0 auto;padding:16px}
    h1{margin-bottom:20px;font-size:1.5rem}
  </style>

  <!-- Full CSS loaded asynchronously -->
  <link rel="stylesheet" href="/style.css" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="/style.css"></noscript>

  <!-- JSON-LD structured data -->
  <script type="application/ld+json">
    ${JSON.stringify(jsonLd, null, 2)}
  </script>
</head>
<body>
  <div class="site">
    <h1>${h1}</h1>
    <div id="app"></div>
  </div>

  <!-- Deferred JS -->
  <script defer src="/app.js"></script>
</body>
</html>`;
}

// Generate pages
const categories = [
  { id: 'length', label: 'Length', units: ['meter','foot','inch'] },
  { id: 'weight', label: 'Weight', units: ['kilogram','pound','ounce'] },
];

categories.forEach(cat => {
  cat.units.forEach(fromUnit => {
    cat.units.forEach(toUnit => {
      if(fromUnit === toUnit) return; // skip same unit
      const folder = path.join(__dirname, 'static-pages', cat.id, `${fromUnit}-to-${toUnit}`);
      fs.mkdirSync(folder, { recursive: true });
      const html = makeHtml(cat.id, cat.label, fromUnit, toUnit);
      fs.writeFileSync(path.join(folder, 'index.html'), html);
    });
  });
});
