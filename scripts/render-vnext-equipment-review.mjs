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

const workfile = path.join(root, 'asset-inbox', 'players', 'vnext', 'goon-field-player-equipment-v1.blend');
if (!fs.existsSync(workfile)) {
  console.error('The authored vNext equipment workfile is missing.');
  process.exit(1);
}
const evidence = path.join(root, 'docs', 'vnext', 'evidence', 'athlete-equipment-review');
const blenderResult = spawnSync(blender, [
  '--background',
  workfile,
  '--python',
  path.join(root, 'scripts', 'blender', 'render_vnext_equipment_review.py'),
  '--',
  '--output-dir',
  evidence,
  '--output-report',
  path.join(root, 'asset-inbox', 'players', 'vnext', 'equipment-review-render-report.json'),
], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'inherit',
});
if (blenderResult.error) {
  console.error(blenderResult.error.message);
  process.exit(1);
}
if (blenderResult.status !== 0) process.exit(blenderResult.status ?? 1);

const contactSheet = spawnSync('python', [
  path.join(root, 'scripts', 'build_vnext_equipment_contact_sheet.py'),
  '--input-dir',
  evidence,
  '--output',
  path.join(evidence, 'contact-sheet.png'),
], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'inherit',
});
if (contactSheet.error) {
  console.error(contactSheet.error.message);
  process.exit(1);
}
process.exit(contactSheet.status ?? 1);
