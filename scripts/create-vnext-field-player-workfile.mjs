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

const args = [
  '--background',
  '--python',
  path.join(root, 'scripts', 'blender', 'create_vnext_field_player_workfile.py'),
  '--',
  '--source',
  path.join(root, 'asset-inbox', 'players', 'blender-sources', 'goon-runner-production.fbx'),
  '--output-blend',
  path.join(root, 'asset-inbox', 'players', 'vnext', 'goon-field-player-vnext.blend'),
  '--output-report',
  path.join(root, 'asset-inbox', 'players', 'vnext', 'source-review-report.json'),
  '--output-preview',
  path.join(root, 'docs', 'vnext', 'evidence', 'vnext-field-player-source.png'),
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

process.exit(result.status ?? 1);
