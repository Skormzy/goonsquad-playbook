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

const sourceDir = path.join(root, 'asset-inbox', 'players', 'mocap', 'cmu-16');
const sourceBlend = path.join(sourceDir, 'cmu-16-35-source.blend');
const report = path.join(sourceDir, 'loop-analysis-report.json');
fs.rmSync(report, { force: true });
const result = spawnSync(blender, [
  '--background', sourceBlend,
  '--python', path.join(root, 'scripts', 'blender', 'analyze_cmu_gait_loops.py'),
  '--',
  '--output-report', report,
  '--rig-name', 'CMU16_Source_Rig',
  '--action-name', 'cmu-run-jog-16-35',
  '--subject-prefix', 'CMU16',
  '--minimum-frame-span', '60',
  '--maximum-frame-span', '130',
  '--target-cycle-distance', '1.8139',
  '--candidate-count', '20',
], { cwd: root, encoding: 'utf8', stdio: 'inherit' });
if (result.error || result.status !== 0 || !fs.existsSync(report)) {
  console.error(result.error?.message ?? 'CMU Subject 16 loop analysis failed.');
  process.exit(result.status ?? 1);
}
