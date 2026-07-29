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
const outputDir = path.join(root, 'asset-inbox', 'players', 'vnext', 'candidates');
const report = path.join(root, 'asset-inbox', 'players', 'vnext', 'contact-export-report.json');
fs.rmSync(report, { force: true });
const result = spawnSync(blender, [
  '--background', workfile,
  '--python', path.join(root, 'scripts', 'blender', 'export_vnext_contact_candidates.py'),
  '--', '--output-dir', outputDir, '--output-report', report,
], { cwd: root, encoding: 'utf8', stdio: 'inherit' });

if (result.error || result.status !== 0 || !fs.existsSync(report)) {
  console.error(result.error?.message ?? 'Blender contact-candidate export failed.');
  process.exit(result.status ?? 1);
}
const exportReport = JSON.parse(fs.readFileSync(report, 'utf8'));
if (exportReport.status !== 'contact-candidates-exported') {
  console.error('Contact candidates were not exported.');
  process.exit(1);
}
