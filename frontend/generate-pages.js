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
  <p>Use this free tool to quickly convert ${prettyFrom} to ${prettyTo}. Accurate, simple, and always free.</p>
  <div id="app"></div>
  <script src="/app.js"></script>
</body>
</html>`;
}
