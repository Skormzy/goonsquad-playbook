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
const workfile = path.join(root, 'asset-inbox', 'players', 'vnext', 'goon-goalie-v1.blend');
if (!blender || !fs.existsSync(workfile)) {
  console.error('Blender or the authored vNext goalie workfile is missing.');
  process.exit(1);
}
const result = spawnSync(blender, [
  '--background', workfile,
  '--python', path.join(root, 'scripts', 'blender', 'audit_vnext_goalie.py'),
  '--', '--output-report', path.join(root, 'asset-inbox', 'players', 'vnext', 'goalie-quality-report.json'),
], { cwd: root, encoding: 'utf8', stdio: 'inherit' });
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
