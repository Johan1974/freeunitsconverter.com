const fs = require('fs');
const path = require('path');

const STATIC_PAGES_PATH = path.join(__dirname, 'static-pages');

function cleanupCategory(categoryPath) {
  const folders = fs.readdirSync(categoryPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && dirent.name !== '_review')
    .map(dirent => dirent.name);

  const pairsMap = {};

  folders.forEach(folder => {
    const [from, to] = folder.split('-to-');
    if (!to) return; // skip malformed folder
    const key = [from, to].sort().join('-to-'); // alphabetical key
    if (!pairsMap[key]) pairsMap[key] = [];
    pairsMap[key].push(folder);
  });

  // Ensure _review folder exists
  const reviewFolder = path.join(categoryPath, '_review');
  if (!fs.existsSync(reviewFolder)) fs.mkdirSync(reviewFolder);

  Object.values(pairsMap).forEach(foldersArr => {
    if (foldersArr.length <= 1) return; // only one folder, nothing to move

    // Determine canonical folder alphabetically
    foldersArr.sort((a, b) => {
      const [fromA, toA] = a.split('-to-');
      const [fromB, toB] = b.split('-to-');
      return fromA.localeCompare(fromB) || toA.localeCompare(toB);
    });

    const canonical = foldersArr[0]; // keep this one
    const canonicalPath = path.join(categoryPath, canonical);

    const toMove = foldersArr.slice(1); // move the rest

    toMove.forEach(folder => {
      const src = path.join(categoryPath, folder);
      const dest = path.join(reviewFolder, folder);

      // Move conversionguide if exists
      const guideSrc = path.join(src, 'conversionguide.html');
      const guideDest = path.join(canonicalPath, 'conversionguide.html');
      if (fs.existsSync(guideSrc)) {
        console.log(`Moving guide: ${guideSrc} -> ${guideDest}`);
        fs.renameSync(guideSrc, guideDest);
      }

      // Move folder to _review
      if (fs.existsSync(src)) {
        console.log(`Moving folder: ${src} -> ${dest}`);
        fs.renameSync(src, dest);
      }
    });
  });
}

// Process all categories
fs.readdirSync(STATIC_PAGES_PATH, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .forEach(dirent => {
    const categoryPath = path.join(STATIC_PAGES_PATH, dirent.name);
    cleanupCategory(categoryPath);
  });

console.log('Cleanup and correction complete.');
