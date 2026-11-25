const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const dist = path.join(root, 'dist');
const sourceImages = path.join(root, 'images');
const distImages = path.join(dist, 'images');
const imageExtensions = new Set(['.avif', '.bmp', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp']);

if (!fs.existsSync(path.join(root, 'index.html'))) {
  throw new Error('Cannot build: index.html was not found.');
}
if (!fs.existsSync(sourceImages)) {
  throw new Error('Cannot build: images/ was not found.');
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.cpSync(sourceImages, distImages, {
  recursive: true,
  filter: (sourcePath) => path.basename(sourcePath) !== 'README.md',
});
fs.copyFileSync(path.join(root, 'firebase-applet-config.json'), path.join(dist, 'firebase-applet-config.json'));

// Keep source URLs rooted at /images locally while making them deploy-safe.
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/(["'])\/images\//g, '$1./images/');
fs.writeFileSync(path.join(dist, 'index.html'), html);

// Catch missing or mis-cased assets during the build rather than after deploy.
const assetReferences = [...html.matchAll(/["'](\.\/images\/[^"']+)["']/g)];
for (const [, url] of assetReferences) {
  let relativePath;
  try {
    relativePath = decodeURIComponent(url.slice('./'.length));
  } catch {
    throw new Error(`Cannot build: invalid URL encoding in asset path ${url}`);
  }
  const assetPath = path.resolve(dist, relativePath);
  if (!assetPath.startsWith(`${path.resolve(distImages)}${path.sep}`) || !fs.existsSync(assetPath)) {
    throw new Error(`Cannot build: referenced asset is missing: ${url}`);
  }
}

console.log(`Built static site in ${dist} with ${assetReferences.length} verified image and media references.`);
