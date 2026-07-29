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

const source = path.join(root, 'asset-inbox', 'players', 'vnext', 'goon-field-player-vnext.blend');
if (!fs.existsSync(source)) {
  console.error('The accepted vNext field-player base is missing.');
  process.exit(1);
}

const result = spawnSync(blender, [
  '--background',
  source,
  '--python',
  path.join(root, 'scripts', 'blender', 'author_vnext_field_player_equipment.py'),
  '--',
  '--output-blend',
  path.join(root, 'asset-inbox', 'players', 'vnext', 'goon-field-player-equipment-v1.blend'),
  '--output-report',
  path.join(root, 'asset-inbox', 'players', 'vnext', 'equipment-authoring-report.json'),
  '--logo',
  path.join(root, 'public', 'goonsquad.png'),
], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'inherit',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
