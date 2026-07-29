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

const tag = 'cmu16-ik-glove-detail';
const sourceWorkfile = path.join(
  root, 'asset-inbox', 'players', 'vnext',
  'goon-field-player-cmu16-ik-neck-boundary-audition.blend',
);
const neckRefinementReport = path.join(
  root, 'asset-inbox', 'players', 'vnext',
  'cmu16-ik-neck-boundary-refinement-report.json',
);
const outputWorkfile = path.join(
  root, 'asset-inbox', 'players', 'vnext',
  `goon-field-player-${tag}-audition.blend`,
);
const privateOutputDir = path.join(
  root, 'asset-inbox', 'players', 'vnext', 'private-runtime-review',
);
const evidenceRoot = path.join(
  root, 'docs', 'vnext', 'evidence', 'athlete-glove-detail-review',
);
const actionDir = path.join(evidenceRoot, 'actions');
const closeDir = path.join(evidenceRoot, 'close');
const reports = {
  refinement: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-refinement-report.json`),
  gloveAudit: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-audit.json`),
  neck: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-neck-audit.json`),
  face: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-face-audit.json`),
  silhouette: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-silhouette-audit.json`),
  materials: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-material-audit.json`),
  topology: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-topology-report.json`),
  deformation: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-deformation-report.json`),
  closeRenders: path.join(root, 'asset-inbox', 'players', 'vnext', `${tag}-close-render-report.json`),
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

if (!fs.existsSync(sourceWorkfile) || !fs.existsSync(neckRefinementReport)) {
  console.error('The approved private neck workfile or restoration receipt is missing.');
  process.exit(1);
}

for (const directory of [actionDir, closeDir]) {
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
  '--python', path.join(root, 'scripts', 'blender', 'refine_vnext_glove_detail.py'),
  '--',
  '--output-workfile', outputWorkfile,
  '--output-report', reports.refinement,
], 'segmented hockey glove authoring');

runBlender('audit_vnext_glove_detail.py', [
  '--refinement-report', reports.refinement,
  '--output-report', reports.gloveAudit,
], 'segmented hockey glove audit');

runBlender('audit_vnext_neck_restoration.py', [
  '--refinement-report', neckRefinementReport,
  '--output-report', reports.neck,
], 'neck restoration regression audit');

for (const [label, script, report] of [
  ['licensed face regression audit', 'audit_vnext_face_pose.py', reports.face],
  ['glove silhouette audit', 'audit_vnext_silhouette.py', reports.silhouette],
  ['glove material audit', 'audit_vnext_materials.py', reports.materials],
  ['glove topology audit', 'audit_vnext_uniform_topology.py', reports.topology],
  ['glove deformation audit', 'audit_vnext_uniform_deformation.py', reports.deformation],
]) {
  runBlender(script, ['--output-report', report], label);
}

runBlender('render_vnext_glove_detail_review.py', [
  '--output-dir', closeDir,
  '--output-report', reports.closeRenders,
], 'glove close review');

runBlender('render_vnext_upper_body_action_review.py', [
  '--output-dir', actionDir,
  '--output-report', reports.actionRenders,
], 'glove all-action review');

runBlender('export_vnext_private_uniform_review.py', [
  '--output-dir', privateOutputDir,
  '--output-report', reports.export,
  '--output-tag', tag,
], 'glove private GLB export');

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
  ], `${side} glove transport optimization`);
  fs.copyFileSync(
    optimized,
    path.join(root, 'src', 'assets', 'vnext3d-review', `field-${side}-${tag}.glb`),
  );
}

run(process.execPath, [
  path.join(root, 'scripts', 'audit-vnext-pbr-runtime.mjs'),
  '--asset-tag', tag,
  '--output-report', reports.runtime,
], 'glove runtime asset audit');

console.log('GOON_VNEXT_GLOVE_DETAIL_REVIEW_READY');
