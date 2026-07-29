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

const workfile = path.join(root, 'asset-inbox', 'players', 'vnext', 'goon-field-player-vnext.blend');
if (!fs.existsSync(workfile)) {
  console.error('The vNext source workfile is missing. Run npm run asset:player:vnext:workfile first.');
  process.exit(1);
}

const args = [
  '--background',
  workfile,
  '--python',
  path.join(root, 'scripts', 'blender', 'render_vnext_field_player_review.py'),
  '--',
  '--output-dir',
  path.join(root, 'docs', 'vnext', 'evidence', 'athlete-base-review'),
  '--output-report',
  path.join(root, 'asset-inbox', 'players', 'vnext', 'human-review-render-report.json'),
];
const result = spawnSync(blender, args, {
  cwd: root,
  encoding: 'utf8',
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) process.exit(result.status ?? 1);

const evidenceDirectory = path.join(root, 'docs', 'vnext', 'evidence', 'athlete-base-review');
const contactSheet = spawnSync('python', [
  path.join(root, 'scripts', 'build_vnext_athlete_contact_sheet.py'),
  '--input-dir',
  evidenceDirectory,
  '--output',
  path.join(evidenceDirectory, 'contact-sheet.png'),
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
