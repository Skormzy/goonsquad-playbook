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

const source = path.join(root, 'asset-inbox', 'players', 'vnext', 'goon-field-player-motion-v1.blend');
const output = path.join(root, 'asset-inbox', 'players', 'vnext', 'goon-field-player-contact-v1.blend');
const report = path.join(root, 'asset-inbox', 'players', 'vnext', 'contact-authoring-report.json');
if (!fs.existsSync(source)) {
  console.error('The accepted vNext motion workfile is missing.');
  process.exit(1);
}
fs.rmSync(output, { force: true });
fs.rmSync(report, { force: true });

const result = spawnSync(blender, [
  '--background', source,
  '--python', path.join(root, 'scripts', 'blender', 'author_vnext_stick_contact.py'),
  '--', '--output-blend', output, '--output-report', report,
], { cwd: root, encoding: 'utf8', stdio: 'inherit' });

if (result.error || result.status !== 0 || !fs.existsSync(output) || !fs.existsSync(report)) {
  console.error(result.error?.message ?? 'Blender stick-contact authoring failed.');
  process.exit(result.status ?? 1);
}
