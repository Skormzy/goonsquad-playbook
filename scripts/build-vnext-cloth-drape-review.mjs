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

const tag = 'cmu16-ik-cloth-drape';
const sourceWorkfile = path.join(
  root, 'asset-inbox', 'players', 'vnext',
  'goon-field-player-cmu16-ik-tailored-uniform-audition.blend',
);
const outputWorkfile = path.join(
  root, 'asset-inbox', 'players', 'vnext',
  `goon-field-player-${tag}-audition.blend`,
);
const privateOutputDir = path.join(
  root, 'asset-inbox', 'players', 'vnext', 'private-runtime-review',
);
const evidenceDir = path.join(
  root, 'docs', 'vnext', 'evidence', 'athlete-cloth-drape-review', 'actions',
);
const reports = {
  refinement: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-refinement-report.json`),
  silhouette: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-audit.json`),
  materials: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-material-audit.json`),
  topology: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-topology-report.json`),
  deformation: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-deformation-report.json`),
  renders: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-action-render-report.json`),
  export: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-private-export-report.json`),
  runtime: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-runtime-audit.json`),
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
  console.error('The private tailored-uniform source workfile is missing.');
  process.exit(1);
}

fs.rmSync(evidenceDir, { recursive: true, force: true });
fs.mkdirSync(evidenceDir, { recursive: true });
fs.mkdirSync(privateOutputDir, { recursive: true });
for (const file of [outputWorkfile, ...Object.values(reports)]) {
  fs.rmSync(file, { force: true });
  fs.rmSync(`${file}1`, { force: true });
}

run(blender, [
  '--background', sourceWorkfile, '--python-exit-code', '1',
  '--python', path.join(root, 'scripts', 'blender', 'refine_vnext_cloth_drape.py'),
  '--',
  '--output-workfile', outputWorkfile,
  '--output-report', reports.refinement,
], 'cloth drape authoring');

for (const [label, script, report] of [
  ['cloth drape silhouette audit', 'audit_vnext_silhouette.py', reports.silhouette],
  ['cloth drape material audit', 'audit_vnext_materials.py', reports.materials],
  ['cloth drape topology audit', 'audit_vnext_uniform_topology.py', reports.topology],
  ['cloth drape deformation audit', 'audit_vnext_uniform_deformation.py', reports.deformation],
]) {
  run(blender, [
    '--background', outputWorkfile, '--python-exit-code', '1',
    '--python', path.join(root, 'scripts', 'blender', script),
    '--', '--output-report', report,
  ], label);
}

run(blender, [
  '--background', outputWorkfile, '--python-exit-code', '1',
  '--python', path.join(root, 'scripts', 'blender', 'render_vnext_upper_body_action_review.py'),
  '--', '--output-dir', evidenceDir, '--output-report', reports.renders,
], 'cloth drape all-action review');

run(blender, [
  '--background', outputWorkfile, '--python-exit-code', '1',
  '--python', path.join(root, 'scripts', 'blender', 'export_vnext_private_uniform_review.py'),
  '--',
  '--output-dir', privateOutputDir,
  '--output-report', reports.export,
  '--output-tag', tag,
], 'cloth drape private GLB export');

const gltfTransformCli = path.join(
  root, 'node_modules', '@gltf-transform', 'cli', 'bin', 'cli.js',
);
for (const side of ['home', 'away']) {
  const raw = path.join(privateOutputDir, `goon-field-player-${side}-${tag}-review.glb`);
  const optimized = path.join(
    privateOutputDir,
    `goon-field-player-${side}-${tag}-optimized-review.glb`,
  );
  run(process.execPath, [gltfTransformCli,
    'optimize', raw, optimized,
    '--compress', 'quantize',
    '--flatten', 'false',
    '--join', 'false',
    '--simplify', 'false',
    '--palette', 'false',
    '--texture-compress', 'webp',
    '--texture-size', '1024',
  ], `${side} cloth drape transport optimization`);
  fs.copyFileSync(
    optimized,
    path.join(root, 'src', 'assets', 'vnext3d-review', `field-${side}-${tag}.glb`),
  );
}

run(process.execPath, [
  path.join(root, 'scripts', 'audit-vnext-pbr-runtime.mjs'),
  '--asset-tag', tag,
  '--output-report', reports.runtime,
], 'cloth drape runtime asset audit');

console.log('GOON_VNEXT_CLOTH_DRAPE_REVIEW_READY');
