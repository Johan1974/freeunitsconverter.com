const fs = require('fs');
const path = require('path');

function makeHtml(catId, catLabel, fromUnit, toUnit) {
  const prettyFrom = fromUnit.replace(/_/g, " ");
  const prettyTo = toUnit.replace(/_/g, " ");
  const title = `${prettyFrom} to ${prettyTo} Converter | Free Units Converter`;
  const desc = `Convert ${prettyFrom} to ${prettyTo} instantly with our free, accurate, and easy-to-use ${catLabel.toLowerCase()} converter.`;
  const h1 = `${prettyFrom} to ${prettyTo} Converter`;

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": `${prettyFrom} to ${prettyTo} Converter`,
    "url": `https://freeunitsconverter.com/${catId}/${fromUnit}-to-${toUnit}/`,
    "description": desc,
    "mainEntity": {
      "@type": "UnitConversion",
      "fromUnit": fromUnit,
      "toUnit": toUnit
    }
  };

  // Only generate the full page for the unit converter itself
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="https://freeunitsconverter.com/${catId}/${fromUnit}-to-${toUnit}/">
  <script type="application/ld+json">
    ${JSON.stringify(jsonLd, null, 2)}
  </script>
</head>
<body>
  <h1>${h1}</h1>
  <div id="app"></div>
  <script src="/app.js"></script>
</body>
</html>`;
}

// Example usage: generate all index.html files
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
