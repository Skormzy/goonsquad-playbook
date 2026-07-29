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

const workfile = path.join(root, 'asset-inbox', 'players', 'vnext', 'goon-field-player-contact-v1.blend');
const outputDir = path.join(root, 'docs', 'vnext', 'evidence', 'athlete-contact-review');
const report = path.join(root, 'asset-inbox', 'players', 'vnext', 'contact-render-report.json');
if (!fs.existsSync(workfile)) {
  console.error('The authored contact workfile is missing.');
  process.exit(1);
}
fs.rmSync(report, { force: true });

const render = spawnSync(blender, [
  '--background', workfile,
  '--python', path.join(root, 'scripts', 'blender', 'render_vnext_stick_contact_review.py'),
  '--', '--output-dir', outputDir, '--output-report', report,
], { cwd: root, encoding: 'utf8', stdio: 'inherit' });
if (render.error || render.status !== 0 || !fs.existsSync(report)) {
  console.error(render.error?.message ?? 'Blender contact-review rendering failed.');
  process.exit(render.status ?? 1);
}

const pythonCandidates = [process.env.PYTHON_EXE, 'C:\\Python313\\python.exe', 'C:\\Python312\\python.exe', 'python'].filter(Boolean);
let sheets = null;
for (const python of pythonCandidates) {
  sheets = spawnSync(python, [
    path.join(root, 'scripts', 'build_vnext_stick_contact_sheets.py'),
    '--input-dir', outputDir,
    '--output-dir', outputDir,
  ], { cwd: root, encoding: 'utf8', stdio: 'inherit' });
  if (!sheets.error && sheets.status === 0) break;
}
if (!sheets || sheets.error || sheets.status !== 0) {
  console.error(sheets?.error?.message ?? 'Contact-sheet generation failed.');
  process.exit(sheets?.status ?? 1);
}
