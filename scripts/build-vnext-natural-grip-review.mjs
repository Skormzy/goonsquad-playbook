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
  'goon-field-player-cmu16-ik-open-face-audition.blend',
);
const outputWorkfile = path.join(
  root, 'asset-inbox', 'players', 'vnext',
  'goon-field-player-cmu16-ik-natural-grip-audition.blend',
);
const refinementReport = path.join(
  root, 'asset-inbox', 'players', 'vnext',
  'cmu16-ik-natural-grip-refinement-report.json',
);
const auditReport = path.join(
  root, 'asset-inbox', 'players', 'vnext',
  'cmu16-ik-natural-grip-audit.json',
);
const actionRenderReport = path.join(
  root, 'asset-inbox', 'players', 'vnext',
  'cmu16-ik-natural-grip-action-render-report.json',
);
const exportReport = path.join(
  root, 'asset-inbox', 'players', 'vnext',
  'cmu16-ik-natural-grip-private-export-report.json',
);
const evidenceDir = path.join(
  root, 'docs', 'vnext', 'evidence', 'athlete-natural-grip-review', 'actions',
);
const privateOutputDir = path.join(
  root, 'asset-inbox', 'players', 'vnext', 'private-runtime-review',
);

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
  console.error('The private open-face review workfile is missing.');
  process.exit(1);
}

fs.mkdirSync(evidenceDir, { recursive: true });
fs.mkdirSync(privateOutputDir, { recursive: true });
for (const file of [outputWorkfile, refinementReport, auditReport, actionRenderReport, exportReport]) {
  fs.rmSync(file, { force: true });
}

run(blender, [
  '--background', sourceWorkfile, '--python-exit-code', '1',
  '--python', path.join(root, 'scripts', 'blender', 'refine_vnext_upper_body_controls.py'),
  '--',
  '--output-workfile', outputWorkfile,
  '--output-report', refinementReport,
], 'Natural-grip upper-body authoring');

run(blender, [
  '--background', outputWorkfile, '--python-exit-code', '1',
  '--python', path.join(root, 'scripts', 'blender', 'audit_vnext_upper_body.py'),
  '--', '--output-report', auditReport,
], 'Natural-grip upper-body audit');

run(blender, [
  '--background', outputWorkfile, '--python-exit-code', '1',
  '--python', path.join(root, 'scripts', 'blender', 'render_vnext_upper_body_action_review.py'),
  '--', '--output-dir', evidenceDir, '--output-report', actionRenderReport,
], 'Natural-grip action review rendering');

const pythonCandidates = [
  process.env.PYTHON_EXE,
  'C:\\Python313\\python.exe',
  'C:\\Python312\\python.exe',
  'python',
].filter(Boolean);
let contactSheetBuilt = false;
for (const python of pythonCandidates) {
  const result = spawnSync(python, [
    path.join(root, 'scripts', 'create_vnext_upper_body_contact_sheets.py'),
    '--input-dir', evidenceDir,
  ], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (!result.error && result.status === 0) {
    contactSheetBuilt = true;
    break;
  }
}
if (!contactSheetBuilt) {
  console.error('Natural-grip contact-sheet generation failed.');
  process.exit(1);
}

run(blender, [
  '--background', outputWorkfile, '--python-exit-code', '1',
  '--python', path.join(root, 'scripts', 'blender', 'export_vnext_private_uniform_review.py'),
  '--',
  '--output-dir', privateOutputDir,
  '--output-report', exportReport,
  '--output-tag', 'cmu16-ik-natural-grip',
], 'Natural-grip private GLB export');

for (const side of ['home', 'away']) {
  const source = path.join(
    privateOutputDir,
    `goon-field-player-${side}-cmu16-ik-natural-grip-review.glb`,
  );
  const target = path.join(
    root, 'src', 'assets', 'vnext3d-review',
    `field-${side}-cmu16-ik-natural-grip.glb`,
  );
  fs.copyFileSync(source, target);
}

console.log('GOON_NATURAL_GRIP_REVIEW_READY');
