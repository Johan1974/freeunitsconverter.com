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
const mode = process.argv[2] || 'dev';
const SITE_URL_EXT = mode === 'prd' ? SITE_URL_PRD : SITE_URL_DEV;

// Load base index.html template
const baseTemplate = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// Load categories from separate file
const { CATEGORIES } = require('./categories');

// -------------------------------
// Build HTML for index.html page
// -------------------------------
function makeHtml(catId, catLabel, fromUnit, toUnit) {
  const prettyFrom = fromUnit.replace(/_/g, ' ');
  const prettyTo = toUnit.replace(/_/g, ' ');
  const title = `${prettyFrom} to ${prettyTo} Converter | Free Units Converter`;
  const desc = `Convert ${prettyFrom} to ${prettyTo} instantly with our free, accurate, and easy-to-use ${catLabel.toLowerCase()} converter.`;
  const canonical = `${SITE_URL_EXT}${catId}/${fromUnit}-to-${toUnit}/`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${prettyFrom} to ${prettyTo} Converter`,
    url: canonical,
    description: desc,
    mainEntity: {
      "@type": "UnitConversion",
      fromUnit,
      toUnit,
    },
  };

  return baseTemplate
    .replace(/<title>.*<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description"[^>]+>/, `<meta name="description" content="${desc}">`)
    .replace(/<link rel="canonical"[^>]+>/, `<link rel="canonical" href="${canonical}">`)
    .replace(/<script type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/, `<script type="application/ld+json">${JSON.stringify(jsonLd, null, 2)}</script>`)
    .replace(/http:\/\/freeunitsconverter\.com:8080\//g, SITE_URL_EXT)
    .replace(/window\.SITE_URL_EXT\s*=\s*".*?";/, `window.SITE_URL_EXT = "${SITE_URL_EXT}";`);
}

// -------------------------------
// Load existing conversion guide
// -------------------------------
function loadConversionGuide(catId, fromUnit, toUnit) {
  const guidePath = path.join(__dirname, 'static-pages', catId, `${fromUnit}-to-${toUnit}`, 'conversionguide.html');
  if (fs.existsSync(guidePath)) {
    return fs.readFileSync(guidePath, 'utf8');
  }
  return '';
}

// -------------------------------
// Check if a folder exists for a combo
// -------------------------------
function checkExistingFolder(catId, fromUnit, toUnit) {
  const folderPathA = path.join(__dirname, 'static-pages', catId, `${fromUnit}-to-${toUnit}`);
  const folderPathB = path.join(__dirname, 'static-pages', catId, `${toUnit}-to-${fromUnit}`);

  let folderAContent = '';
  let folderBContent = '';

  // Check both possible folder paths for a conversion guide
  if (fs.existsSync(folderPathA)) {
    folderAContent = loadConversionGuide(catId, fromUnit, toUnit);
  }
  if (fs.existsSync(folderPathB)) {
    folderBContent = loadConversionGuide(catId, toUnit, fromUnit);
  }

  return { folderPathA, folderPathB, folderAContent, folderBContent };
}

// -------------------------------
// Compare and clean up folders
// -------------------------------
function compareAndCleanUpFolders(catId, fromUnit, toUnit) {
  const { folderPathA, folderPathB, folderAContent, folderBContent } = checkExistingFolder(catId, fromUnit, toUnit);

  // If both folders exist, compare the content length
  if (folderAContent && folderBContent) {
    if (folderAContent.length === folderBContent.length) {
      console.log(`Both guides are identical in content length. Removing folder B: ${folderPathB}`);
      fs.rmdirSync(folderPathB, { recursive: true });
    } else if (folderAContent.length > folderBContent.length) {
      console.log(`Folder A has more content. Removing folder B: ${folderPathB}`);
      fs.rmdirSync(folderPathB, { recursive: true });
    } else {
      console.log(`Folder B has more content. Removing folder A: ${folderPathA}`);
      fs.rmdirSync(folderPathA, { recursive: true });
    }
  } else if (folderAContent) {
    console.log(`Folder B is missing or has no valid content. Removing folder B: ${folderPathB}`);
    fs.rmdirSync(folderPathB, { recursive: true });
  } else if (folderBContent) {
    console.log(`Folder A is missing or has no valid content. Removing folder A: ${folderPathA}`);
    fs.rmdirSync(folderPathA, { recursive: true });
  }
}

// -------------------------------
// Generate pages for valid categories (length, weight, etc.)
// -------------------------------
CATEGORIES.forEach(cat => {
  const units = cat.units; // array of strings
  units.forEach(fromUnit => {
    units.forEach(toUnit => {
      if (fromUnit === toUnit) return;

      // Build the main folder path using category label
      const folder = path.join(__dirname, 'static-pages', cat.label.toLowerCase(), `${fromUnit}-to-${toUnit}`);
      const reverseFolder = path.join(__dirname, 'static-pages', cat.label.toLowerCase(), `${toUnit}-to-${fromUnit}`);

      // Create folder if not already created
      fs.mkdirSync(folder, { recursive: true });
      fs.mkdirSync(reverseFolder, { recursive: true });

      // Always generate index.html
      const htmlPath = path.join(folder, 'index.html');
      const html = makeHtml(cat.id, cat.label, fromUnit, toUnit);
      fs.writeFileSync(htmlPath, html, 'utf8');

      // Always generate reverse index.html if needed
      const reverseHtmlPath = path.join(reverseFolder, 'index.html');
      const reverseHtml = makeHtml(cat.id, cat.label, toUnit, fromUnit);
      fs.writeFileSync(reverseHtmlPath, reverseHtml, 'utf8');

      // Add .gitkeep for empty folder tracking if needed
      const gitkeepPath = path.join(folder, '.gitkeep');
      if (!fs.existsSync(gitkeepPath)) {
        fs.writeFileSync(gitkeepPath, '', 'utf8');
      }

      // Compare and clean up folders based on conversion guide content
      compareAndCleanUpFolders(cat.label.toLowerCase(), fromUnit, toUnit);
    });
  });
});

console.log(`✅ Static pages generated and cleaned up for ${mode.toUpperCase()} using ${SITE_URL_EXT}`);
