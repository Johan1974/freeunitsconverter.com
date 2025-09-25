// frontend/generate-pages.js
const fs = require('fs');
const path = require('path');

// Load .env
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const SITE_URL_DEV = process.env.SITE_URL_DEV;
const SITE_URL_PRD = process.env.SITE_URL_PRD;

if (!SITE_URL_DEV || !SITE_URL_PRD) {
  throw new Error("SITE_URL_DEV and SITE_URL_PRD must be set in .env");
}

// Determine mode: dev or prd
const mode = process.argv[2] || "dev";
const SITE_URL_EXT = mode === "prd" ? SITE_URL_PRD : SITE_URL_DEV;

// Load base index.html template
const baseTemplate = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// Example categories & units (adjust as needed)
const categories = [
  { id: 'length', label: 'Length', units: ['centimeter','meter','foot','inch'] },
  { id: 'weight', label: 'Weight', units: ['kilogram','pound','ounce'] },
];

// -------------------------------
// Load matching conversion guide
// -------------------------------
function loadConversionGuide(catId, fromUnit, toUnit) {
  const guidePath = path.join(__dirname, 'static-pages', catId, `${fromUnit}-to-${toUnit}`, 'conversionguide.html');
  if (fs.existsSync(guidePath)) {
    return fs.readFileSync(guidePath, 'utf8');
  }
  return '<p>Select a category and units to see the conversion guide here.</p>';
}

// -------------------------------
// Build HTML for a page
// -------------------------------
function makeHtml(catId, catLabel, fromUnit, toUnit) {
  const prettyFrom = fromUnit.replace(/_/g, " ");
  const prettyTo = toUnit.replace(/_/g, " ");
  const title = `${prettyFrom} to ${prettyTo} Converter | Free Units Converter`;
  const desc = `Convert ${prettyFrom} to ${prettyTo} instantly with our free, accurate, and easy-to-use ${catLabel.toLowerCase()} converter.`;
  const canonical = `${SITE_URL_EXT}${catId}/${fromUnit}-to-${toUnit}/`;
  const guideHTML = loadConversionGuide(catId, fromUnit, toUnit);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": `${prettyFrom} to ${prettyTo} Converter`,
    "url": canonical,
    "description": desc,
    "mainEntity": {
      "@type": "UnitConversion",
      "fromUnit": fromUnit,
      "toUnit": toUnit
    }
  };

  return baseTemplate
    .replace(/<title>.*<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description"[^>]+>/, `<meta name="description" content="${desc}">`)
    .replace(/<link rel="canonical"[^>]+>/, `<link rel="canonical" href="${canonical}">`)
    .replace(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/,
             `<script type="application/ld+json">${JSON.stringify(jsonLd, null, 2)}</script>`)

    // 🔥 New replacements for URLs
    .replace(/http:\/\/freeunitsconverter\.com:8080\//g, SITE_URL_EXT)   // favicon, CSS, JS
    .replace(/window\.SITE_URL_EXT\s*=\s*".*?";/,
             `window.SITE_URL_EXT = "${SITE_URL_EXT}";`);
}

// -------------------------------
// Generate pages
// -------------------------------
categories.forEach(cat => {
  cat.units.forEach(fromUnit => {
    cat.units.forEach(toUnit => {
      if (fromUnit === toUnit) return;

      const folder = path.join(__dirname, 'static-pages', cat.id, `${fromUnit}-to-${toUnit}`);
      fs.mkdirSync(folder, { recursive: true });

      const html = makeHtml(cat.id, cat.label, fromUnit, toUnit);
      fs.writeFileSync(path.join(folder, 'index.html'), html, 'utf8');
    });
  });
});

console.log(`✅ Static pages generated for ${mode.toUpperCase()} using ${SITE_URL_EXT}`);
