import crypto from 'node:crypto';
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

const workfile = path.join(root, 'asset-inbox', 'players', 'vnext', 'goon-field-player-cmu-run-audition.blend');
const outputDir = path.join(root, 'asset-inbox', 'players', 'vnext', 'private-runtime-review');
const runtimeDir = path.join(root, 'src', 'assets', 'vnext3d-review');
const reportPath = path.join(root, 'asset-inbox', 'players', 'vnext', 'cmu-run-private-export-report.json');
fs.rmSync(reportPath, { force: true });
const result = spawnSync(blender, [
  '--background', workfile,
  '--python', path.join(root, 'scripts', 'blender', 'export_vnext_cmu_run_review.py'),
  '--', '--output-dir', outputDir, '--output-report', reportPath,
], { cwd: root, encoding: 'utf8', stdio: 'inherit' });
if (result.error || result.status !== 0 || !fs.existsSync(reportPath)) {
  console.error(result.error?.message ?? 'Blender captured-locomotion review export failed.');
  process.exit(result.status ?? 1);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
if (report.status !== 'private-runtime-review-exported' || report.publicRuntimeAllowed !== false) {
  console.error('Captured locomotion assets did not retain their private-review boundary.');
  process.exit(1);
}
fs.mkdirSync(runtimeDir, { recursive: true });
const sync = {};
for (const side of ['home', 'away']) {
  const source = report.variants[side].file;
  const destination = path.join(runtimeDir, `field-${side}-cmu-run.glb`);
  fs.copyFileSync(source, destination);
  const sourceBytes = fs.readFileSync(source);
  const destinationBytes = fs.readFileSync(destination);
  const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
  if (hash(sourceBytes) !== hash(destinationBytes)) {
    console.error(`Private ${side} captured-locomotion asset failed byte-identity verification.`);
    process.exit(1);
  }
  sync[side] = { source, destination, bytes: destinationBytes.length, sha256: hash(destinationBytes) };
}
report.runtimeReviewSync = sync;
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
