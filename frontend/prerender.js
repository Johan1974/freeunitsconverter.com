const fs = require('fs');
const path = require('path');

// Categories to pre-render
const categories = [
  { id: 'length', title: 'Length Converter — Free Units Converter', desc: 'Convert meters, feet, inches, yards, and miles instantly.' },
  { id: 'weight', title: 'Weight Converter — Free Units Converter', desc: 'Convert kilograms, pounds, grams, and ounces instantly.' },
  { id: 'temperature', title: 'Temperature Converter — Free Units Converter', desc: 'Convert Celsius, Fahrenheit, and Kelvin instantly.' },
  { id: 'volume', title: 'Volume Converter — Free Units Converter', desc: 'Convert liters, milliliters, gallons, and cups instantly.' }
];

const templatePath = path.join(__dirname, 'index.html');
const template = fs.readFileSync(templatePath, 'utf-8');

categories.forEach(cat => {
  let html = template
    .replace(/<title>.*<\/title>/, `<title>${cat.title}</title>`)
    .replace(/<meta name="description" content=".*">/, `<meta name="description" content="${cat.desc}">`)
    // Optional: you could also inject an <h1> or hero text dynamically
    .replace(/<h1 class="title">.*<\/h1>/, `<h1 class="title">${cat.title}</h1>`);

  const outDir = path.join(__dirname, cat.id);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  console.log(`Pre-rendered ${cat.id}/index.html`);
});
