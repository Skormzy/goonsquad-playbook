import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
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

const sourceFit = path.join(
  root,
  'asset-inbox/players/vnext/production-glove-fit',
  'goon-field-player-cmu16-ik-production-glove-fit-audition.blend',
);
const outputDirectory = path.join(
  root,
  'asset-inbox/players/vnext/production-glove-surface',
);
const evidenceDirectory = path.join(
  root,
  'docs/vnext/evidence/athlete-production-glove-surface-review',
);
const closeDirectory = path.join(evidenceDirectory, 'close');
const actionDirectory = path.join(evidenceDirectory, 'actions');
const outputWorkfile = path.join(
  outputDirectory,
  'goon-field-player-cmu16-ik-production-glove-surface-audition.blend',
);
const reports = {
  author: path.join(outputDirectory, 'production-glove-surface-author-report.json'),
  probe: path.join(outputDirectory, 'production-glove-surface-probe-after.json'),
  close: path.join(evidenceDirectory, 'close-render-report.json'),
  actions: path.join(evidenceDirectory, 'action-render-report.json'),
};

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.error || result.status !== 0) {
    console.error(result.error?.message ?? `${label} failed.`);
    process.exit(result.status ?? 1);
  }
}

function runBlender(source, script, args, label) {
  run(blender, [
    '--background',
    source,
    '--python-exit-code', '1',
    '--python', path.join(root, 'scripts/blender', script),
    '--', ...args,
  ], label);
}

if (!fs.existsSync(sourceFit)) {
  console.error(`Required private fitted glove source is missing: ${sourceFit}`);
  process.exit(1);
}
for (const directory of [outputDirectory, closeDirectory, actionDirectory]) {
  fs.mkdirSync(directory, { recursive: true });
}
for (const directory of [closeDirectory, actionDirectory]) {
  for (const file of fs.readdirSync(directory)) {
    if (file.endsWith('.png')) fs.rmSync(path.join(directory, file), { force: true });
  }
}
for (const file of [outputWorkfile, ...Object.values(reports)]) {
  fs.rmSync(file, { force: true });
  fs.rmSync(`${file}1`, { force: true });
}

runBlender(sourceFit, 'refine_vnext_production_glove_surface.py', [
  '--output-workfile', outputWorkfile,
  '--output-report', reports.author,
], 'private production glove surface authoring');

runBlender(outputWorkfile, 'probe_vnext_glove_surface.py', [
  '--output-report', reports.probe,
], 'private production glove surface probe');

runBlender(outputWorkfile, 'render_vnext_production_glove_surface.py', [
  '--output-dir', closeDirectory,
  '--output-report', reports.close,
], 'private production glove surface close review');

runBlender(outputWorkfile, 'render_vnext_upper_body_action_review.py', [
  '--output-dir', actionDirectory,
  '--output-report', reports.actions,
], 'private production glove surface all-action review');

run('python', [
  path.join(root, 'scripts/create_vnext_production_glove_fit_sheets.py'),
  '--input-dir', closeDirectory,
  '--prefix', 'production-glove-surface',
], 'private production glove surface close contact sheets');

run('python', [
  path.join(root, 'scripts/create_vnext_upper_body_contact_sheets.py'),
  '--input-dir', actionDirectory,
], 'private production glove surface action contact sheets');

console.log('GOON_VNEXT_PRODUCTION_GLOVE_SURFACE_READY');
