const fs = require('fs');
const path = require('path');

// Load .env
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const SITE_URL_DEV = process.env.SITE_URL_DEV;
const SITE_URL_PRD = process.env.SITE_URL_PRD;

if (!SITE_URL_DEV || !SITE_URL_PRD) {
  throw new Error("SITE_URL_DEV and SITE_URL_PRD must be set in .env");
}

// Determine mode
const mode = process.argv[2] || 'dev';
const SITE_URL_EXT = mode === 'prd' ? SITE_URL_PRD : SITE_URL_DEV;

// Load base index.html template
const baseTemplate = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// Load categories
const { CATEGORIES } = require('./categories');

// -------------------------------
// Load or generate conversion guide
// -------------------------------
function loadConversionGuide(catId, fromUnit, toUnit) {
  const folderPath = path.join(__dirname, 'static-pages', catId, `${fromUnit}-to-${toUnit}`);
  const guidePath = path.join(folderPath, 'conversionguide.html');
  const templatePath = path.join(__dirname, 'conversionguide-template.html');

  if (fs.existsSync(guidePath)) {
    return fs.readFileSync(guidePath, 'utf8');
  } else if (fs.existsSync(templatePath)) {
    const template = fs.readFileSync(templatePath, 'utf8');
    const prettyFrom = fromUnit.replace(/_/g, ' ');
    const prettyTo = toUnit.replace(/_/g, ' ');
    return template
      .replace(/{{fromUnit}}/g, fromUnit)
      .replace(/{{toUnit}}/g, toUnit)
      .replace(/{{fromUnitPretty}}/g, prettyFrom)
      .replace(/{{toUnitPretty}}/g, prettyTo);
  }

  return '';
}

// -------------------------------
// Build index.html with guide injected
// -------------------------------
function makeHtml(catId, catLabel, fromUnit, toUnit) {
  const prettyFrom = fromUnit.replace(/_/g, ' ');
  const prettyTo = toUnit.replace(/_/g, ' ');
  const title = `${prettyFrom} to ${prettyTo} Converter | Free Units Converter`;
  const desc = `Convert ${prettyFrom} to ${prettyTo} instantly with our free, accurate, and easy-to-use ${catLabel.toLowerCase()} converter.`;
  const canonical = `${SITE_URL_EXT}${catId}/${fromUnit}-to-${toUnit}/`;
  const guide = loadConversionGuide(catId, fromUnit, toUnit);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "name": `Convert ${prettyFrom} to ${prettyTo}`,
    "step": [
      { "@type": "HowToStep", "text": `Multiply your ${prettyFrom} value by the conversion factor to get ${prettyTo}.` }
    ]
  };

  // Inject guide into placeholder <!-- guide-content -->
  return baseTemplate
    .replace(/<title>.*<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description"[^>]+>/, `<meta name="description" content="${desc}">`)
    .replace(/<link rel="canonical"[^>]+>/, `<link rel="canonical" href="${canonical}">`)
    .replace(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/, `<script type="application/ld+json">${JSON.stringify(jsonLd, null, 2)}</script>`)
    .replace(/http:\/\/freeunitsconverter\.com:8080\//g, SITE_URL_EXT)
    .replace(/window\.SITE_URL_EXT\s*=\s*".*?";/, `window.SITE_URL_EXT = "${SITE_URL_EXT}";`)
    // Placeholder for guide injection, do not remove
    .replace('<!-- guide content will be injected here by app.js -->', guide);
}

// -------------------------------
// Determine folder to use for combo
// -------------------------------
function chooseFolder(catId, fromUnit, toUnit) {
  const folderA = path.join(__dirname, 'static-pages', catId, `${fromUnit}-to-${toUnit}`);
  const folderB = path.join(__dirname, 'static-pages', catId, `${toUnit}-to-${fromUnit}`);
  const guideA = fs.existsSync(path.join(folderA, 'conversionguide.html')) ? fs.readFileSync(path.join(folderA, 'conversionguide.html'), 'utf8') : '';
  const guideB = fs.existsSync(path.join(folderB, 'conversionguide.html')) ? fs.readFileSync(path.join(folderB, 'conversionguide.html'), 'utf8') : '';

  if (guideA && guideB) {
    if (guideA.length >= guideB.length) {
      if (fs.existsSync(folderB)) fs.rmSync(folderB, { recursive: true });
      return folderA;
    } else {
      if (fs.existsSync(folderA)) fs.rmSync(folderA, { recursive: true });
      return folderB;
    }
  } else if (guideA) {
    if (fs.existsSync(folderB)) fs.rmSync(folderB, { recursive: true });
    return folderA;
  } else if (guideB) {
    if (fs.existsSync(folderA)) fs.rmSync(folderA, { recursive: true });
    return folderB;
  } else {
    // Neither exists, choose folderA
    return folderA;
  }
}

// -------------------------------
// Generate all pages
// -------------------------------
CATEGORIES.forEach(cat => {
  const units = cat.units;
  units.forEach(fromUnit => {
    units.forEach(toUnit => {
      if (fromUnit === toUnit) return;

      const folder = chooseFolder(cat.label.toLowerCase(), fromUnit, toUnit);
      fs.mkdirSync(folder, { recursive: true });

      const htmlPath = path.join(folder, 'index.html');
      const html = makeHtml(cat.id, cat.label, fromUnit, toUnit);
      fs.writeFileSync(htmlPath, html, 'utf8');

      // Ensure .gitkeep exists
      const gitkeepPath = path.join(folder, '.gitkeep');
      if (!fs.existsSync(gitkeepPath)) fs.writeFileSync(gitkeepPath, '', 'utf8');
    });
  });
});

console.log(`✅ Static pages generated for ${mode.toUpperCase()} using ${SITE_URL_EXT}`);
