import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const blender = [
  process.env.BLENDER_EXE,
  'C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe',
  'C:\\Program Files\\Blender Foundation\\Blender 5.0\\blender.exe',
  'C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe',
].filter(Boolean).find((candidate) => fs.existsSync(candidate));
if (!blender) {
  console.error('Blender was not found. Set BLENDER_EXE to the installed blender.exe path.');
  process.exit(1);
}

const workDir = path.join(root, 'asset-inbox', 'players', 'vnext');
const sourceBlend = path.join(workDir, 'goon-field-player-cmu16-run-audition.blend');
const outputBlend = path.join(workDir, 'goon-field-player-cmu16-ik-transition-audition.blend');
const authorReport = path.join(workDir, 'cmu16-ik-transition-report.json');
const shoeAuditReport = path.join(workDir, 'cmu16-ik-transition-shoe-audit.json');
const renderReport = path.join(workDir, 'cmu16-ik-transition-render-report.json');
const exportReport = path.join(workDir, 'cmu16-ik-transition-private-export-report.json');
const reviewDir = path.join(root, 'docs', 'vnext', 'evidence', 'cmu16-ik-transition-review');
const contactSheet = path.join(reviewDir, 'contact-sheet-cmu16-ik-transition-2026-07-12.png');
const privateOutputDir = path.join(workDir, 'private-runtime-review');
const runtimeDir = path.join(root, 'src', 'assets', 'vnext3d-review');

function run(command, args, failure) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    console.error(result.error?.message ?? failure);
    process.exit(result.status ?? 1);
  }
}

for (const file of [authorReport, shoeAuditReport, renderReport, exportReport]) fs.rmSync(file, { force: true });
fs.rmSync(reviewDir, { recursive: true, force: true });
fs.mkdirSync(reviewDir, { recursive: true });

run(blender, [
  '--python-exit-code', '1',
  '--background', sourceBlend,
  '--python', path.join(root, 'scripts', 'blender', 'author_vnext_cmu_locomotion_transition.py'),
  '--',
  '--output-blend', outputBlend,
  '--output-report', authorReport,
  '--output-action', 'jog-to-sprint-ik',
  '--jog-start-phase', '0.2165',
  '--sprint-start-phase', '0.8255',
  '--jog-cycle-advance', '0.4439',
  '--sprint-cycle-advance', '0.4084',
  '--output-frames', '1,11',
  '--foot-lock-side', 'Right',
  '--runtime-start=-5.52,-20.16,-0.7',
  '--runtime-end=-5.8533,-19.2267,-0.6167',
  '--lock-release-progress', '0.7',
  '--lock-height', '0.004',
  '--transfer-lock-side', 'Left',
  '--transfer-start-progress', '0.8',
  '--transfer-end-progress', '0.9',
], 'CMU planted-shoe transition authoring failed.');

run(blender, [
  '--python-exit-code', '1',
  '--background', outputBlend,
  '--python', path.join(root, 'scripts', 'blender', 'audit_vnext_transition_shoes.py'),
  '--',
  '--action-name', 'jog-to-sprint-ik',
  '--runtime-speed', '2.973',
  '--runtime-start=-5.52,-20.16,-0.7',
  '--runtime-end=-5.8533,-19.2267,-0.6167',
  '--output-report', shoeAuditReport,
], 'CMU planted-shoe transition audit failed.');

const shoeAudit = JSON.parse(fs.readFileSync(shoeAuditReport, 'utf8'));
const plantedRightP95 = shoeAudit.exactRuntime?.sides?.right?.p95MmPerFrame;
const transferLeftP95 = shoeAudit.exactRuntime?.sides?.left?.p95MmPerFrame;
const combinedP95 = shoeAudit.exactRuntime?.combinedP95MmPerFrame;
if (![plantedRightP95, transferLeftP95, combinedP95].every(Number.isFinite) || combinedP95 > 10) {
  console.error(`CMU transition rejected before export: combined shoe p95 ${combinedP95} mm/frame.`);
  process.exit(1);
}

run(blender, [
  '--python-exit-code', '1',
  '--background', outputBlend,
  '--python', path.join(root, 'scripts', 'blender', 'render_vnext_cmu_retarget_review.py'),
  '--',
  '--output-dir', reviewDir,
  '--output-report', renderReport,
  '--action-name', 'jog-to-sprint-ik',
  '--file-prefix', 'cmu16-ik-transition',
  '--sample-frames', '1,4,7,11',
], 'CMU jog-to-sprint review rendering failed.');

const pythonCandidates = [process.env.PYTHON_EXE, 'C:\\Python313\\python.exe', 'C:\\Python312\\python.exe', 'python'].filter(Boolean);
let sheetResult = null;
for (const python of pythonCandidates) {
  sheetResult = spawnSync(python, [
    path.join(root, 'scripts', 'build_vnext_cmu_retarget_contact_sheet.py'),
    '--input-dir', reviewDir,
    '--output', contactSheet,
    '--file-prefix', 'cmu16-ik-transition',
    '--title', 'CMU JOG TO SPRINT - PLANTED SHOE TRANSITION',
    '--frames', '1,4,7,11',
  ], { cwd: root, encoding: 'utf8', stdio: 'inherit' });
  if (!sheetResult.error && sheetResult.status === 0) break;
}
if (!sheetResult || sheetResult.error || sheetResult.status !== 0) {
  console.error(sheetResult?.error?.message ?? 'CMU transition contact sheet failed.');
  process.exit(sheetResult?.status ?? 1);
}

run(blender, [
  '--python-exit-code', '1',
  '--background', outputBlend,
  '--python', path.join(root, 'scripts', 'blender', 'export_vnext_cmu_run_review.py'),
  '--',
  '--output-dir', privateOutputDir,
  '--output-report', exportReport,
  '--jog-audition', 'jog-cmu16-lower-body-audition',
  '--output-tag', 'cmu16-ik-transition',
], 'CMU planted-shoe transition private runtime export failed.');

const report = JSON.parse(fs.readFileSync(exportReport, 'utf8'));
if (report.status !== 'private-runtime-review-exported' || report.publicRuntimeAllowed !== false) {
  console.error('CMU transition assets did not retain their private-review boundary.');
  process.exit(1);
}
fs.mkdirSync(runtimeDir, { recursive: true });
const sync = {};
for (const side of ['home', 'away']) {
  const source = report.variants[side].file;
  const destination = path.join(runtimeDir, `field-${side}-cmu16-ik-transition.glb`);
  fs.copyFileSync(source, destination);
  const bytes = fs.readFileSync(destination);
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  sync[side] = { source, destination, bytes: bytes.length, sha256 };
}
report.runtimeReviewSync = sync;
report.transitionAction = 'jog-to-sprint-ik';
report.shoeAudit = {
  file: shoeAuditReport,
  lockedSide: 'right-to-left-transfer',
  rightP95MmPerFrame: plantedRightP95,
  leftP95MmPerFrame: transferLeftP95,
  p95MmPerFrame: combinedP95,
  thresholdMmPerFrame: 10,
};
fs.writeFileSync(exportReport, `${JSON.stringify(report, null, 2)}\n`);

for (const required of [outputBlend, authorReport, shoeAuditReport, renderReport, exportReport, contactSheet]) {
  if (!fs.existsSync(required)) {
    console.error(`CMU transition output is missing: ${required}`);
    process.exit(1);
  }
}
