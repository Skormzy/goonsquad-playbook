import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsDirectory = path.join(root, 'dist', 'assets');
const requiredPwaFiles = [
  'index.html',
  'manifest.json',
  'sw.js',
  'favicon.ico',
  'goonsquad-favicon-v2-32.png',
  'goonsquad-favicon-v2-64.png',
  'goonsquad-icon-v2-192.png',
  'goonsquad-icon-v2-512.png',
  'goonsquad-icon-v2-1024.png',
  'goonsquad-icon-maskable-v2-512.png',
  'goonsquad-apple-touch-icon-v2.png',
  'goonsquad-social-card-v2.png',
];
const forbiddenFilePattern = /PlayerRigReviewView/iu;
const forbiddenLegacyModels = new Set([
  'animated-runner.glb',
  'goon-player.glb',
  'goon-runner-away.glb',
  'goon-runner-home.glb',
]);
const acceptedReviewModels = new Set([
  'field-away-cmu16-ik-neck-boundary',
  'field-home-cmu16-ik-neck-boundary',
]);
const forbiddenJavaScript = [
  'PRODUCTION GLB GATE',
  'rigreview-view',
  'asset:player:contract',
  'procedural-broadcast-crowd-backdrop',
  'three.js example Soldier.glb',
  'FLAGSHIP 3D REPLAY',
];

if (!fs.existsSync(assetsDirectory)) {
  console.error('Public build check failed: dist/assets does not exist. Run npm run build first.');
  process.exit(1);
}

const missingPwaFiles = requiredPwaFiles.filter((file) => !fs.existsSync(path.join(root, 'dist', file)));
if (missingPwaFiles.length) {
  console.error(`Public build check failed: missing PWA files: ${missingPwaFiles.join(', ')}`);
  process.exit(1);
}

const publicServiceWorker = fs.readFileSync(path.join(root, 'dist', 'sw.js'), 'utf8');
if (
  publicServiceWorker.includes('__BUILD_ID__')
  || publicServiceWorker.includes('/*__BUILD_ASSETS__*/ []')
  || !/const BUILD_ASSETS = \[\s*"\/assets\//u.test(publicServiceWorker)
) {
  console.error('Public build check failed: the service worker does not contain the production asset manifest.');
  process.exit(1);
}

const assetFiles = fs.readdirSync(assetsDirectory);
const forbiddenFiles = assetFiles.filter((file) => forbiddenFilePattern.test(file));
const forbiddenMatches = [];
const forbiddenModelFiles = [];
const privateReviewModelFiles = [];

function findForbiddenModels(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) findForbiddenModels(fullPath);
    else {
      if (forbiddenLegacyModels.has(entry.name)) forbiddenModelFiles.push(path.relative(root, fullPath));
      if (
        entry.name.endsWith('.glb')
        && entry.name.includes('-cmu')
        && ![...acceptedReviewModels].some((accepted) => entry.name.startsWith(accepted))
      ) {
        privateReviewModelFiles.push(path.relative(root, fullPath));
      }
    }
  }
}

findForbiddenModels(path.join(root, 'dist'));

for (const file of assetFiles.filter((entry) => entry.endsWith('.js'))) {
  const contents = fs.readFileSync(path.join(assetsDirectory, file), 'utf8');
  for (const marker of forbiddenJavaScript) {
    if (contents.includes(marker)) forbiddenMatches.push(`${file}: ${marker}`);
  }
}

if (
  forbiddenFiles.length > 0
  || forbiddenMatches.length > 0
  || forbiddenModelFiles.length > 0
  || privateReviewModelFiles.length > 0
) {
  console.error('Public build check failed: internal review code or the rejected legacy 3D runtime was bundled.');
  forbiddenFiles.forEach((file) => console.error(`file: ${file}`));
  forbiddenMatches.forEach((match) => console.error(`content: ${match}`));
  forbiddenModelFiles.forEach((file) => console.error(`legacy model: ${file}`));
  privateReviewModelFiles.forEach((file) => console.error(`private review model: ${file}`));
  process.exit(1);
}

console.log('Public build excludes internal review code and contains an installable, versioned PWA shell.');
