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

const tag = 'cmu16-ik-neck-boundary';
const sourceWorkfile = path.join(
  root, 'asset-inbox', 'players', 'vnext',
  'goon-field-player-cmu16-ik-face-pose-audition.blend',
);
const referenceWorkfile = path.join(
  root, 'asset-inbox', 'players', 'vnext',
  'goon-field-player-cmu16-ik-continuous-jersey-audition.blend',
);
const outputWorkfile = path.join(
  root, 'asset-inbox', 'players', 'vnext',
  `goon-field-player-${tag}-audition.blend`,
);
const privateOutputDir = path.join(
  root, 'asset-inbox', 'players', 'vnext', 'private-runtime-review',
);
const evidenceRoot = path.join(
  root, 'docs', 'vnext', 'evidence', 'athlete-neck-boundary-review',
);
const actionDir = path.join(evidenceRoot, 'actions');
const headDir = path.join(evidenceRoot, 'head');
const reports = {
  refinement: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-refinement-report.json`),
  restoration: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-restoration-audit.json`),
  face: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-face-audit.json`),
  silhouette: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-silhouette-audit.json`),
  materials: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-material-audit.json`),
  topology: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-topology-report.json`),
  deformation: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-deformation-report.json`),
  headRenders: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-head-render-report.json`),
  actionRenders: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-action-render-report.json`),
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

function runBlender(script, args, label) {
  run(blender, [
    '--background', outputWorkfile, '--python-exit-code', '1',
    '--python', path.join(root, 'scripts', 'blender', script),
    '--', ...args,
  ], label);
}

if (!fs.existsSync(sourceWorkfile) || !fs.existsSync(referenceWorkfile)) {
  console.error('The approved private face source or licensed pre-mask body reference is missing.');
  process.exit(1);
}

for (const directory of [actionDir, headDir]) {
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });
}
fs.mkdirSync(privateOutputDir, { recursive: true });
fs.mkdirSync(path.join(root, 'src', 'assets', 'vnext3d-review'), { recursive: true });
for (const file of [outputWorkfile, ...Object.values(reports)]) {
  fs.rmSync(file, { force: true });
  fs.rmSync(`${file}1`, { force: true });
}

run(blender, [
  '--background', sourceWorkfile, '--python-exit-code', '1',
  '--python', path.join(root, 'scripts', 'blender', 'refine_vnext_neck_boundary.py'),
  '--',
  '--reference-workfile', referenceWorkfile,
  '--output-workfile', outputWorkfile,
  '--output-report', reports.refinement,
], 'licensed neck boundary restoration');

runBlender('audit_vnext_neck_restoration.py', [
  '--refinement-report', reports.refinement,
  '--output-report', reports.restoration,
], 'licensed neck restoration audit');

for (const [label, script, report] of [
  ['licensed face regression audit', 'audit_vnext_face_pose.py', reports.face],
  ['neck silhouette audit', 'audit_vnext_silhouette.py', reports.silhouette],
  ['neck material audit', 'audit_vnext_materials.py', reports.materials],
  ['neck topology audit', 'audit_vnext_uniform_topology.py', reports.topology],
  ['neck deformation audit', 'audit_vnext_uniform_deformation.py', reports.deformation],
]) {
  runBlender(script, ['--output-report', report], label);
}

runBlender('render_vnext_head_detail_review.py', [
  '--output-dir', headDir,
  '--output-report', reports.headRenders,
], 'neck close review');

runBlender('render_vnext_upper_body_action_review.py', [
  '--output-dir', actionDir,
  '--output-report', reports.actionRenders,
], 'neck all-action review');

runBlender('export_vnext_private_uniform_review.py', [
  '--output-dir', privateOutputDir,
  '--output-report', reports.export,
  '--output-tag', tag,
], 'neck private GLB export');

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
  ], `${side} neck transport optimization`);
  fs.copyFileSync(
    optimized,
    path.join(root, 'src', 'assets', 'vnext3d-review', `field-${side}-${tag}.glb`),
  );
}

run(process.execPath, [
  path.join(root, 'scripts', 'audit-vnext-pbr-runtime.mjs'),
  '--asset-tag', tag,
  '--output-report', reports.runtime,
], 'neck runtime asset audit');

console.log('GOON_VNEXT_NECK_BOUNDARY_REVIEW_READY');
