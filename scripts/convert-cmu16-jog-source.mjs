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

const sourceDir = path.join(root, 'asset-inbox', 'players', 'mocap', 'cmu-16');
const outputBlend = path.join(sourceDir, 'cmu-16-35-source.blend');
const conversionReport = path.join(sourceDir, 'conversion-report.json');
const renderReport = path.join(sourceDir, 'source-render-report.json');
const reviewDir = path.join(root, 'docs', 'vnext', 'evidence', 'cmu-16-source-review');
const contactSheet = path.join(reviewDir, 'contact-sheet-source-progression-2026-07-12.png');

function run(command, args, failure) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    console.error(result.error?.message ?? failure);
    process.exit(result.status ?? 1);
  }
}

for (const file of [outputBlend, conversionReport, renderReport]) fs.rmSync(file, { force: true });
fs.rmSync(reviewDir, { recursive: true, force: true });
fs.mkdirSync(reviewDir, { recursive: true });

run(blender, [
  '--background', '--factory-startup',
  '--python', path.join(root, 'scripts', 'blender', 'import_cmu_asf_amc.py'),
  '--',
  '--asf', path.join(sourceDir, '16.asf'),
  '--amc', path.join(sourceDir, '16_35.amc'),
  '--output-blend', outputBlend,
  '--output-report', conversionReport,
  '--subject-prefix', 'CMU16',
  '--rig-name', 'CMU16_Source_Rig',
  '--armature-name', 'CMU16_Source_Armature',
  '--action-name', 'cmu-run-jog-16-35',
], 'CMU Subject 16 conversion failed.');

run(blender, [
  '--background', outputBlend,
  '--python', path.join(root, 'scripts', 'blender', 'render_cmu_source_review.py'),
  '--',
  '--output-dir', reviewDir,
  '--output-report', renderReport,
  '--rig-name', 'CMU16_Source_Rig',
  '--subject-prefix', 'CMU16',
  '--file-prefix', 'cmu-16-35',
  '--sample-frames', '15,48,81,114,147',
], 'CMU Subject 16 source rendering failed.');

const pythonCandidates = [
  process.env.PYTHON_EXE,
  'C:\\Python313\\python.exe',
  'C:\\Python312\\python.exe',
  'python',
].filter(Boolean);
let sheetResult = null;
for (const python of pythonCandidates) {
  sheetResult = spawnSync(python, [
    path.join(root, 'scripts', 'build_cmu_source_contact_sheet.py'),
    '--input-dir', reviewDir,
    '--output', contactSheet,
    '--file-prefix', 'cmu-16-35',
    '--title', 'CMU 16-35 RUN/JOG - CONVERTED SOURCE PROGRESSION',
  ], { cwd: root, encoding: 'utf8', stdio: 'inherit' });
  if (!sheetResult.error && sheetResult.status === 0) break;
}
if (!sheetResult || sheetResult.error || sheetResult.status !== 0) {
  console.error(sheetResult?.error?.message ?? 'CMU Subject 16 contact sheet failed.');
  process.exit(sheetResult?.status ?? 1);
}

for (const required of [outputBlend, conversionReport, renderReport, contactSheet]) {
  if (!fs.existsSync(required)) {
    console.error(`CMU Subject 16 conversion output is missing: ${required}`);
    process.exit(1);
  }
}
