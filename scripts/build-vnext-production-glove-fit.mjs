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

const sourceAthlete = path.join(
  root,
  'asset-inbox',
  'players',
  'vnext',
  'goon-field-player-cmu16-ik-neck-boundary-audition.blend',
);
const sourceGlove = path.join(
  root,
  'asset-inbox',
  'players',
  'vnext',
  'production-glove-base',
  'goon-production-glove-base-v1.blend',
);
const outputDirectory = path.join(
  root,
  'asset-inbox',
  'players',
  'vnext',
  'production-glove-fit',
);
const evidenceDirectory = path.join(
  root,
  'docs',
  'vnext',
  'evidence',
  'athlete-production-glove-fit-review',
);
const closeDirectory = path.join(evidenceDirectory, 'close');
const actionDirectory = path.join(evidenceDirectory, 'actions');
const outputWorkfile = path.join(
  outputDirectory,
  'goon-field-player-cmu16-ik-production-glove-fit-audition.blend',
);
const reports = {
  fit: path.join(outputDirectory, 'production-glove-fit-report.json'),
  audit: path.join(outputDirectory, 'production-glove-fit-audit.json'),
  close: path.join(outputDirectory, 'production-glove-fit-close-render-report.json'),
  actions: path.join(outputDirectory, 'production-glove-fit-action-render-report.json'),
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
    '--python', path.join(root, 'scripts', 'blender', script),
    '--', ...args,
  ], label);
}

for (const required of [sourceAthlete, sourceGlove]) {
  if (!fs.existsSync(required)) {
    console.error(`Required private source is missing: ${required}`);
    process.exit(1);
  }
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

runBlender(sourceAthlete, 'fit_vnext_production_glove.py', [
  '--glove-workfile', sourceGlove,
  '--output-workfile', outputWorkfile,
  '--output-report', reports.fit,
], 'private production glove athlete fit');

runBlender(outputWorkfile, 'audit_vnext_production_glove_fit.py', [
  '--fit-report', reports.fit,
  '--output-report', reports.audit,
], 'private production glove fit audit');

runBlender(outputWorkfile, 'render_vnext_production_glove_fit.py', [
  '--output-dir', closeDirectory,
  '--output-report', reports.close,
], 'private production glove close review');

runBlender(outputWorkfile, 'render_vnext_upper_body_action_review.py', [
  '--output-dir', actionDirectory,
  '--output-report', reports.actions,
], 'private production glove all-action review');

run('python', [
  path.join(root, 'scripts', 'create_vnext_production_glove_fit_sheets.py'),
  '--input-dir', closeDirectory,
], 'private production glove close contact sheets');

run('python', [
  path.join(root, 'scripts', 'create_vnext_upper_body_contact_sheets.py'),
  '--input-dir', actionDirectory,
], 'private production glove action contact sheets');

console.log('GOON_VNEXT_PRODUCTION_GLOVE_FIT_READY');
