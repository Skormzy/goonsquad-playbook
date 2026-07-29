import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiredActions = [
  'jog',
  'jog-to-sprint-ik',
  'pass',
  'ready',
  'receive',
  'shot',
  'sprint',
  'stop',
  'turn',
];
const outputFlag = process.argv.indexOf('--output-report');
const assetTagFlag = process.argv.indexOf('--asset-tag');
const assetTag = assetTagFlag >= 0 ? process.argv[assetTagFlag + 1] : 'cmu16-ik-pbr';
if (!/^[a-z0-9-]+$/.test(assetTag)) {
  throw new Error(`Invalid private asset tag: ${assetTag}`);
}
const outputReport = path.resolve(
  root,
  outputFlag >= 0
    ? process.argv[outputFlag + 1]
    : 'asset-inbox/players/vnext/cmu16-ik-pbr-runtime-audit.json',
);
const variants = {
  home: path.join(
    root,
    'asset-inbox/players/vnext/private-runtime-review/',
    `goon-field-player-home-${assetTag}-optimized-review.glb`,
  ),
  away: path.join(
    root,
    'asset-inbox/players/vnext/private-runtime-review/',
    `goon-field-player-away-${assetTag}-optimized-review.glb`,
  ),
};
const goalieFiles = [
  path.join(root, 'src/assets/vnext3d/goalie-home.glb'),
  path.join(root, 'src/assets/vnext3d/goalie-away.glb'),
];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function inspectVariant(file) {
  const bytes = fs.readFileSync(file);
  const document = await io.read(file);
  const documentRoot = document.getRoot();
  const actions = documentRoot.listAnimations().map((animation) => animation.getName()).sort();
  const materials = documentRoot.listMaterials().map((material) => material.getName()).sort();
  const textures = documentRoot.listTextures();
  const nodes = documentRoot.listNodes().map((node) => node.getName()).filter(Boolean);
  const extensions = documentRoot.listExtensionsUsed()
    .map((extension) => extension.extensionName)
    .sort();
  return {
    file,
    bytes: bytes.length,
    sha256: sha256(bytes),
    actions,
    missingActions: requiredActions.filter((name) => !actions.includes(name)),
    materialCount: materials.length,
    pbrMaterialCount: materials.filter((name) => name.startsWith('GS_PBR_')).length,
    materials,
    textureCount: textures.length,
    webpTextureCount: textures.filter((texture) => texture.getMimeType() === 'image/webp').length,
    extensions,
    cageNodeCount: nodes.filter((name) => name.includes('_Helmet_Cage_')).length,
  };
}

const inspected = Object.fromEntries(await Promise.all(
  Object.entries(variants).map(async ([side, file]) => [side, await inspectVariant(file)]),
));
const fieldAssetBytes = Object.values(inspected).reduce((total, variant) => total + variant.bytes, 0);
const goalieAssetBytes = goalieFiles.reduce((total, file) => total + fs.statSync(file).size, 0);
const report = {
  status: `private-${assetTag}-runtime-audited`,
  assetTag,
  decision: 'not-runtime-approved',
  publicRuntimeAllowed: false,
  acceptedRuntimeAssetsChanged: false,
  requiredActions,
  variants: inspected,
  fieldAssetBytes,
  goalieAssetBytes,
  fourAssetBytes: fieldAssetBytes + goalieAssetBytes,
  fourAssetBudgetBytes: 10_000_000,
  fourAssetBudgetPass: fieldAssetBytes + goalieAssetBytes < 10_000_000,
  reviewRule: (
    'Compression and material completeness cannot promote this candidate; desktop, mobile, '
    + 'close-camera, deformation, grounding, motion, and explicit human visual review remain required.'
  ),
};
fs.mkdirSync(path.dirname(outputReport), { recursive: true });
fs.writeFileSync(outputReport, `${JSON.stringify(report, null, 2)}\n`);
console.log(`GOON_VNEXT_PBR_RUNTIME_AUDITED ${outputReport}`);
