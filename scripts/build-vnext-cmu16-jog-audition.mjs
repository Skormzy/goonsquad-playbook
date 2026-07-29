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
const sourceBlend = path.join(root, 'asset-inbox', 'players', 'mocap', 'cmu-16', 'cmu-16-35-source.blend');
const targetBlend = path.join(workDir, 'goon-field-player-cmu-sprint-audition.blend');
const outputBlend = path.join(workDir, 'goon-field-player-cmu16-run-audition.blend');
const retargetReport = path.join(workDir, 'cmu16-jog-retarget-report.json');
const strideReport = path.join(workDir, 'cmu16-jog-stride-report.json');
const renderReport = path.join(workDir, 'cmu16-jog-retarget-render-report.json');
const reviewDir = path.join(root, 'docs', 'vnext', 'evidence', 'cmu16-jog-retarget-review');
const contactSheet = path.join(reviewDir, 'contact-sheet-cmu16-jog-retarget-2026-07-12.png');
const actionName = 'jog-cmu16-lower-body-audition';

function run(command, args, failure) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    console.error(result.error?.message ?? failure);
    process.exit(result.status ?? 1);
  }
}

for (const file of [retargetReport, strideReport, renderReport]) fs.rmSync(file, { force: true });
fs.rmSync(reviewDir, { recursive: true, force: true });
fs.mkdirSync(reviewDir, { recursive: true });

run(blender, [
  '--background', targetBlend,
  '--python', path.join(root, 'scripts', 'blender', 'retarget_cmu_lower_body.py'),
  '--',
  '--source-blend', sourceBlend,
  '--output-blend', outputBlend,
  '--output-report', retargetReport,
  '--source-rig', 'CMU16_Source_Rig',
  '--source-action', 'cmu-run-jog-16-35',
  '--source-prefix', 'CMU16',
  '--target-action', 'jog',
  '--output-action', actionName,
  '--source-loop', '38,134',
  '--output-frames', '1,41',
  '--root-motion-scale', '0',
  '--retarget-blend', '1',
], 'CMU Subject 16 jog retarget failed.');

run(blender, [
  '--background', outputBlend,
  '--python', path.join(root, 'scripts', 'blender', 'audit_vnext_locomotion_stride.py'),
  '--', '--clips', actionName, '--output-report', strideReport,
], 'CMU Subject 16 jog stride audit failed.');

run(blender, [
  '--background', outputBlend,
  '--python', path.join(root, 'scripts', 'blender', 'render_vnext_cmu_retarget_review.py'),
  '--',
  '--output-dir', reviewDir,
  '--output-report', renderReport,
  '--action-name', actionName,
  '--file-prefix', 'cmu16-jog',
  '--sample-frames', '1,11,21,31',
], 'CMU Subject 16 jog review rendering failed.');

const pythonCandidates = [
  process.env.PYTHON_EXE,
  'C:\\Python313\\python.exe',
  'C:\\Python312\\python.exe',
  'python',
].filter(Boolean);
let sheetResult = null;
for (const python of pythonCandidates) {
  sheetResult = spawnSync(python, [
    path.join(root, 'scripts', 'build_vnext_cmu_retarget_contact_sheet.py'),
    '--input-dir', reviewDir,
    '--output', contactSheet,
    '--file-prefix', 'cmu16-jog',
    '--title', 'CMU 16-35 JOG RETARGET - CAPTURED GAIT + AUTHORED STICK CONTROL',
    '--frames', '1,11,21,31',
  ], { cwd: root, encoding: 'utf8', stdio: 'inherit' });
  if (!sheetResult.error && sheetResult.status === 0) break;
}
if (!sheetResult || sheetResult.error || sheetResult.status !== 0) {
  console.error(sheetResult?.error?.message ?? 'CMU Subject 16 jog contact sheet failed.');
  process.exit(sheetResult?.status ?? 1);
}

for (const required of [outputBlend, retargetReport, strideReport, renderReport, contactSheet]) {
  if (!fs.existsSync(required)) {
    console.error(`CMU Subject 16 jog output is missing: ${required}`);
    process.exit(1);
  }
}
