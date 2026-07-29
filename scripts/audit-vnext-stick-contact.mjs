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
const report = path.join(root, 'asset-inbox', 'players', 'vnext', 'contact-quality-report.json');
fs.rmSync(report, { force: true });
const result = spawnSync(blender, [
  '--background', workfile,
  '--python', path.join(root, 'scripts', 'blender', 'audit_vnext_stick_contact.py'),
  '--', '--output-report', report,
], { cwd: root, encoding: 'utf8', stdio: 'inherit' });

if (result.error || result.status !== 0 || !fs.existsSync(report)) {
  console.error(result.error?.message ?? 'Blender stick-contact audit failed.');
  process.exit(result.status ?? 1);
}
const audit = JSON.parse(fs.readFileSync(report, 'utf8'));
if (audit.status !== 'passed') {
  console.error(JSON.stringify(audit.failures, null, 2));
  process.exit(1);
}
