import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const blenderCandidates = [
  process.env.BLENDER_EXE,
  'C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe',
  'C:\\Program Files\\Blender Foundation\\Blender 5.0\\blender.exe',
  'C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe',
].filter(Boolean);
const blender = blenderCandidates.find((candidate) => fs.existsSync(candidate));
if (!blender) {
  console.error('Blender was not found. Set BLENDER_EXE to the installed blender.exe path.');
  process.exit(1);
}

const sourceWorkfile = path.join(
  root, 'asset-inbox', 'players', 'vnext',
  'goon-field-player-cmu16-ik-diagonal-stick-audition.blend',
);
const outputWorkfile = path.join(
  root, 'asset-inbox', 'players', 'vnext',
  'goon-field-player-cmu16-ik-pbr-audition.blend',
);
const sourceTextureDir = path.join(
  root, 'asset-inbox', 'players', 'downloads', 'cc-character-base',
  'CC Character Base', 'OBJ', '03_Neutral_M', '03_Neutral_M',
);
const textureDir = path.join(
  root, 'asset-inbox', 'players', 'vnext', 'pbr-textures', 'cmu16-ik-pbr',
);
const privateOutputDir = path.join(
  root, 'asset-inbox', 'players', 'vnext', 'private-runtime-review',
);
const evidenceDir = path.join(
  root, 'docs', 'vnext', 'evidence', 'athlete-pbr-material-review', 'materials',
);
const reports = {
  authoring: path.join(root, 'asset-inbox', 'players', 'vnext', 'cmu16-ik-pbr-material-authoring-report.json'),
  materials: path.join(root, 'asset-inbox', 'players', 'vnext', 'cmu16-ik-pbr-material-audit.json'),
  renders: path.join(root, 'asset-inbox', 'players', 'vnext', 'cmu16-ik-pbr-material-render-report.json'),
  export: path.join(root, 'asset-inbox', 'players', 'vnext', 'cmu16-ik-pbr-private-export-report.json'),
  runtime: path.join(root, 'asset-inbox', 'players', 'vnext', 'cmu16-ik-pbr-runtime-audit.json'),
};

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.error || result.status !== 0) {
    console.error(result.error?.message ?? `${label} failed.`);
    process.exit(result.status ?? 1);
  }
}

if (!fs.existsSync(sourceWorkfile)) {
  console.error('The private diagonal-stick review workfile is missing.');
  process.exit(1);
}
if (!fs.existsSync(path.join(sourceTextureDir, 'Std_Skin_Head_diffuse.jpg'))) {
  console.error('The licensed Character Creator texture source is missing.');
  process.exit(1);
}

for (const directory of [textureDir, evidenceDir]) {
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });
}
fs.mkdirSync(privateOutputDir, { recursive: true });
for (const file of [outputWorkfile, ...Object.values(reports)]) {
  fs.rmSync(file, { force: true });
  fs.rmSync(`${file}1`, { force: true });
}

run(blender, [
  '--background', sourceWorkfile, '--python-exit-code', '1',
  '--python', path.join(root, 'scripts', 'blender', 'author_vnext_pbr_materials.py'),
  '--',
  '--output-workfile', outputWorkfile,
  '--output-report', reports.authoring,
  '--texture-dir', textureDir,
  '--source-texture-dir', sourceTextureDir,
], 'PBR material authoring');

run(blender, [
  '--background', outputWorkfile, '--python-exit-code', '1',
  '--python', path.join(root, 'scripts', 'blender', 'audit_vnext_materials.py'),
  '--', '--output-report', reports.materials,
], 'PBR material audit');

run(blender, [
  '--background', outputWorkfile, '--python-exit-code', '1',
  '--python', path.join(root, 'scripts', 'blender', 'render_vnext_pbr_material_review.py'),
  '--', '--output-dir', evidenceDir, '--output-report', reports.renders,
], 'PBR material review rendering');

run(blender, [
  '--background', outputWorkfile, '--python-exit-code', '1',
  '--python', path.join(root, 'scripts', 'blender', 'export_vnext_private_uniform_review.py'),
  '--',
  '--output-dir', privateOutputDir,
  '--output-report', reports.export,
  '--output-tag', 'cmu16-ik-pbr',
], 'PBR private GLB export');

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
for (const side of ['home', 'away']) {
  const raw = path.join(
    privateOutputDir,
    `goon-field-player-${side}-cmu16-ik-pbr-review.glb`,
  );
  const optimized = path.join(
    privateOutputDir,
    `goon-field-player-${side}-cmu16-ik-pbr-optimized-review.glb`,
  );
  run(npx, [
    'gltf-transform', 'optimize', raw, optimized,
    '--compress', 'quantize',
    '--flatten', 'false',
    '--join', 'false',
    '--simplify', 'false',
    '--palette', 'false',
    '--texture-compress', 'webp',
    '--texture-size', '1024',
  ], `${side} PBR transport optimization`);
  fs.copyFileSync(
    optimized,
    path.join(root, 'src', 'assets', 'vnext3d-review', `field-${side}-cmu16-ik-pbr.glb`),
  );
}

run(process.execPath, [
  path.join(root, 'scripts', 'audit-vnext-pbr-runtime.mjs'),
  '--output-report', reports.runtime,
], 'PBR runtime asset audit');

console.log('GOON_VNEXT_PBR_REVIEW_READY');
