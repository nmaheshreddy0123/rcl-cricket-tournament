const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const dist = path.join(root, 'dist');
const sourceAssets = path.join(root, 'public', 'assets');
const sourceImageAssets = path.join(sourceAssets, 'aistudio');
const distAssets = path.join(dist, 'assets');
const distImages = path.join(dist, 'images');
const imageExtensions = new Set(['.avif', '.bmp', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);

if (!fs.existsSync(path.join(root, 'index.html'))) {
  throw new Error('Cannot build: index.html was not found.');
}
if (!fs.existsSync(sourceAssets)) {
  throw new Error('Cannot build: public/assets was not found.');
}
if (!fs.existsSync(sourceImageAssets)) {
  throw new Error('Cannot build: public/assets/aistudio was not found.');
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.cpSync(sourceAssets, distAssets, { recursive: true });
fs.mkdirSync(distImages, { recursive: true });
fs.copyFileSync(path.join(root, 'firebase-applet-config.json'), path.join(dist, 'firebase-applet-config.json'));

// Move image files into the published images directory and generate a manifest
// so the page can resolve its image references dynamically at runtime.
const imageFiles = [];
function moveImages(sourceDir, relativeDir = '') {
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      moveImages(sourcePath, relativePath);
      continue;
    }
    if (!entry.isFile() || !imageExtensions.has(path.extname(entry.name).toLowerCase())) continue;

    const copiedAssetPath = path.join(distAssets, 'aistudio', relativePath);
    const imagePath = path.join(distImages, relativePath);
    fs.mkdirSync(path.dirname(imagePath), { recursive: true });
    fs.renameSync(copiedAssetPath, imagePath);
    imageFiles.push(relativePath.split(path.sep).join('/'));
  }
}
moveImages(sourceImageAssets);
fs.writeFileSync(path.join(distImages, 'manifest.json'), JSON.stringify({ images: imageFiles }, null, 2));

// Rewrite media URLs for the built site. Images now live under ./images;
// other assets (including video) remain under ./assets.
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/(["'])\/assets\/aistudio\//g, '$1./images/')
  .replace(/(["'])\/assets\//g, '$1./assets/');

// Resolve image tags from the generated manifest, rather than baking image
// URLs into the published HTML. The manifest supports adding images without
// having to update the page markup.
html = html.replace(/\bsrc=(['"])\.\/images\/([^'"]+)\1/g, (_match, quote, imagePath) => {
  return `data-image=${quote}${imagePath}${quote}`;
});
const imageLoader = `\n  <script>\n    (async function loadPublishedImages() {\n      try {\n        const response = await fetch('./images/manifest.json');\n        if (!response.ok) throw new Error('Image manifest request failed');\n        const manifest = await response.json();\n        const availableImages = new Set(manifest.images || []);\n        document.querySelectorAll('img[data-image]').forEach((image) => {\n          let imagePath;\n          try { imagePath = decodeURIComponent(image.dataset.image); } catch { return; }\n          if (!availableImages.has(imagePath)) return;\n          image.src = './images/' + imagePath.split('/').map(encodeURIComponent).join('/');\n        });\n      } catch (error) {\n        console.error('Unable to load site images:', error);\n      }\n    })();\n  </script>\n`;
html = html.replace('</body>', `${imageLoader}</body>`);
fs.writeFileSync(path.join(dist, 'index.html'), html);

// Catch missing or mis-cased assets during the build rather than after deploy.
const assetReferences = [...html.matchAll(/(?:src|poster)=["'](\.\/(?:assets|images)\/[^"']+)["']/g)];
for (const [, url] of assetReferences) {
  let relativePath;
  try {
    relativePath = decodeURIComponent(url.slice('./'.length));
  } catch {
    throw new Error(`Cannot build: invalid URL encoding in asset path ${url}`);
  }
  const assetPath = path.resolve(dist, relativePath);
  const allowedRoots = [path.resolve(distAssets), path.resolve(distImages)];
  if (!allowedRoots.some((allowedRoot) => assetPath.startsWith(`${allowedRoot}${path.sep}`)) || !fs.existsSync(assetPath)) {
    throw new Error(`Cannot build: referenced asset is missing: ${url}`);
  }
}

console.log(`Built static site in ${dist} with ${imageFiles.length} manifest images and ${assetReferences.length} verified asset references.`);
