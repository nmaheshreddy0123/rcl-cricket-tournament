const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const dist = path.join(root, 'dist');
const sourceAssets = path.join(root, 'public', 'assets');

if (!fs.existsSync(path.join(root, 'index.html'))) {
  throw new Error('Cannot build: index.html was not found.');
}
if (!fs.existsSync(sourceAssets)) {
  throw new Error('Cannot build: public/assets was not found.');
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.cpSync(sourceAssets, path.join(dist, 'assets'), { recursive: true });
fs.copyFileSync(path.join(root, 'firebase-applet-config.json'), path.join(dist, 'firebase-applet-config.json'));

// Root-absolute URLs work on a domain root, but break when the app is hosted
// below a path (for example, a GitHub Pages project site). Make asset URLs
// relative in the built HTML so the same build works in either location.
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/(["'])\/assets\//g, '$1./assets/');
fs.writeFileSync(path.join(dist, 'index.html'), html);

// Catch missing or mis-cased assets during the build rather than after deploy.
const assetReferences = [...html.matchAll(/(?:src|poster)=["'](\.\/assets\/[^"']+)["']/g)];
for (const [, url] of assetReferences) {
  let relativePath;
  try {
    relativePath = decodeURIComponent(url.slice('./'.length));
  } catch {
    throw new Error(`Cannot build: invalid URL encoding in asset path ${url}`);
  }
  const assetPath = path.resolve(dist, relativePath);
  if (!assetPath.startsWith(`${path.resolve(dist, 'assets')}${path.sep}`) || !fs.existsSync(assetPath)) {
    throw new Error(`Cannot build: referenced asset is missing: ${url}`);
  }
}

console.log(`Built static site in ${dist} with ${assetReferences.length} verified asset references.`);
