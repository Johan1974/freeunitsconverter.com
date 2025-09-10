const fs = require("fs");
const path = require("path");

// Mirror of your CONVERTERS from app.js
const CONVERTERS = [
  { id: 'length', label: 'Length', baseUnit: 'meter', units: { 'millimeter':0.001,'centimeter':0.01,'meter':1,'kilometer':1000,'inch':0.0254,'foot':0.3048,'yard':0.9144,'mile':1609.344 }},
  { id: 'weight', label: 'Weight', baseUnit: 'kilogram', units: { 'gram':0.001,'kilogram':1,'pound':0.45359237,'ounce':0.028349523125 }},
  { id: 'temperature', label: 'Temperature', baseUnit: 'celsius', type: 'temperature', units: { 'celsius':{}, 'fahrenheit':{}, 'kelvin':{} }},
  { id: 'volume', label: 'Volume', baseUnit: 'liter', units: { 'milliliter':0.001,'liter':1,'cubic_meter':1000,'gallon_us':3.78541,'cup_us':0.236588 }}
];

// Base output dir
const outDir = path.join(__dirname, "static-pages");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

// HTML template generator
function makeHtml(catId, catLabel, fromUnit, toUnit) {
  const prettyFrom = fromUnit.replace(/_/g, " ");
  const prettyTo = toUnit.replace(/_/g, " ");
  const title = `${prettyFrom} to ${prettyTo} Converter | Free Units Converter`;
  const desc = `Convert ${prettyFrom} to ${prettyTo} instantly with our free, accurate, and easy-to-use ${catLabel.toLowerCase()} converter.`;
  const h1 = `${prettyFrom} to ${prettyTo} Converter`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="https://freeunitsconverter.com/${catId}/${fromUnit}-to-${toUnit}/">
</head>
<body>
  <h1>${h1}</h1>
  <p>Use this free tool to quickly convert ${prettyFrom} to ${prettyTo}. Accurate, simple, and always free.</p>
  <div id="app"></div>
  <script src="/app.js"></script>
</body>
</html>`;
}

// Collect sitemap entries
const urls = [`https://freeunitsconverter.com/`];

// Generate all combinations
for (const cat of CONVERTERS) {
  const units = Object.keys(cat.units);
  for (let i = 0; i < units.length; i++) {
    for (let j = 0; j < units.length; j++) {
      if (i === j) continue;
      const from = units[i];
      const to = units[j];
      const dir = path.join(outDir, cat.id, `${from}-to-${to}`);
      fs.mkdirSync(dir, { recursive: true });

      const html = makeHtml(cat.id, cat.label, from, to);
      fs.writeFileSync(path.join(dir, "index.html"), html);

      urls.push(`https://freeunitsconverter.com/${cat.id}/${from}-to-${to}/`);
    }
  }
}

// Build sitemap.xml
const sitemap =
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls
    .map(url => `  <url><loc>${url}</loc><priority>0.8</priority></url>`)
    .join("\n") +
  `\n</urlset>`;

fs.writeFileSync(path.join(__dirname, "sitemap.xml"), sitemap);

console.log(`✅ Generated ${urls.length} URLs (including homepage).`);
