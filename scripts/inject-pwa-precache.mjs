import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const serviceWorkerPath = path.join(dist, 'sw.js');
const assetsPath = path.join(dist, 'assets');
const coreAssetPattern = /\.(?:css|js|mjs|woff2?|svg|png|webp)$/iu;

if (!fs.existsSync(serviceWorkerPath) || !fs.existsSync(assetsPath)) {
  throw new Error('PWA precache injection requires a completed Vite build.');
}

function collectCoreAssets(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectCoreAssets(absolutePath));
      continue;
    }
    if (!coreAssetPattern.test(entry.name) || entry.name.toLowerCase().endsWith('.glb')) continue;
    result.push(`/${path.relative(dist, absolutePath).replaceAll('\\', '/')}`);
  }
  return result;
}

const buildAssets = collectCoreAssets(assetsPath).sort();
const buildFingerprint = buildAssets.map((asset) => {
  const stat = fs.statSync(path.join(dist, asset.slice(1)));
  return `${asset}:${stat.size}`;
}).join('|');
const buildId = crypto.createHash('sha256').update(buildFingerprint).digest('hex').slice(0, 12);
const source = fs.readFileSync(serviceWorkerPath, 'utf8');

if (!source.includes("'__BUILD_ID__'") || !source.includes('/*__BUILD_ASSETS__*/ []')) {
  throw new Error('PWA precache placeholders are missing from dist/sw.js.');
}

const injected = source
  .replace("'__BUILD_ID__'", JSON.stringify(buildId))
  .replace('/*__BUILD_ASSETS__*/ []', JSON.stringify(buildAssets, null, 2));

fs.writeFileSync(serviceWorkerPath, injected, 'utf8');
console.log(`Injected ${buildAssets.length} production assets into PWA cache ${buildId}.`);
