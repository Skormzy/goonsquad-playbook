import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  process.env.BLENDER_EXE,
  'C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe',
  'C:\\Program Files\\Blender Foundation\\Blender 5.0\\blender.exe',
  'C:\\Program Files\\Blender Foundation\\Blender 4.5\\blender.exe',
].filter(Boolean);
const blender = candidates.find((candidate) => fs.existsSync(candidate));
if (!blender) {
  console.error('Blender was not found. Set BLENDER_EXE to the installed blender.exe path.');
  process.exit(1);
}

const workfile = path.join(root, 'asset-inbox', 'players', 'vnext', 'goon-field-player-motion-audition.blend');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'athlete-motion-audition');
const renderReport = path.join(root, 'asset-inbox', 'players', 'vnext', 'motion-audition-render-report.json');
if (!fs.existsSync(workfile)) {
  console.error('The vNext motion audition workfile is missing.');
  process.exit(1);
}
fs.rmSync(renderReport, { force: true });

const render = spawnSync(blender, [
  '--background',
  workfile,
  '--python',
  path.join(root, 'scripts', 'blender', 'render_vnext_motion_audition.py'),
  '--',
  '--output-dir',
  outputDir,
  '--output-report',
  renderReport,
], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'inherit',
});
if (render.error || render.status !== 0 || !fs.existsSync(renderReport)) {
  console.error(render.error?.message ?? 'Blender motion audition rendering failed.');
  process.exit(render.status ?? 1);
}

const pythonCandidates = [
  process.env.PYTHON_EXE,
  'C:\\Python313\\python.exe',
  'C:\\Python312\\python.exe',
  'python',
].filter(Boolean);
let contactSheetResult = null;
for (const python of pythonCandidates) {
  contactSheetResult = spawnSync(python, [
    path.join(root, 'scripts', 'build_vnext_motion_contact_sheet.py'),
    '--input-dir',
    outputDir,
    '--output',
    path.join(outputDir, 'contact-sheet-motion-audition-2026-07-12.png'),
  ], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (!contactSheetResult.error && contactSheetResult.status === 0) break;
}
if (!contactSheetResult || contactSheetResult.error || contactSheetResult.status !== 0) {
  console.error(contactSheetResult?.error?.message ?? 'Motion contact-sheet generation failed.');
  process.exit(contactSheetResult?.status ?? 1);
}
