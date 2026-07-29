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
  'asset-inbox/players/vnext/production-glove-finish',
  'goon-field-player-cmu16-ik-production-glove-finish-audition.blend',
);
const outputDirectory = path.join(root, 'asset-inbox/players/vnext/production-glove-sculpt');
const evidenceDirectory = path.join(
  root,
  'docs/vnext/evidence/athlete-production-glove-sculpt-review',
);
const closeDirectory = path.join(evidenceDirectory, 'close');
const actionDirectory = path.join(evidenceDirectory, 'actions');
const topologySource = path.join(outputDirectory, 'goon-production-glove-segmented-source-v2.blend');
const manufacturedSource = path.join(outputDirectory, 'goon-production-glove-anatomical-sewn-source-v3.blend');
const sculptSource = path.join(outputDirectory, 'goon-production-glove-integrated-sewn-volume-source-v4.blend');
const outputWorkfile = path.join(
  outputDirectory,
  'goon-field-player-cmu16-ik-production-glove-sculpt-audition.blend',
);
const reports = {
  topology: path.join(outputDirectory, 'production-glove-sculpt-topology-seed-report.json'),
  manufactured: path.join(outputDirectory, 'production-glove-sculpt-manufactured-seed-report.json'),
  source: path.join(outputDirectory, 'production-glove-sculpt-source-report.json'),
  fit: path.join(outputDirectory, 'production-glove-sculpt-fit-report.json'),
  audit: path.join(outputDirectory, 'production-glove-sculpt-audit.json'),
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
    ...(source ? [source] : []),
    '--python-exit-code', '1',
    '--python', path.join(root, 'scripts/blender', script),
    '--', ...args,
  ], label);
}

if (!fs.existsSync(sourceAthlete)) {
  console.error(`Required private athlete source is missing: ${sourceAthlete}`);
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
for (const file of [
  topologySource,
  manufacturedSource,
  sculptSource,
  outputWorkfile,
  ...Object.values(reports),
]) {
  fs.rmSync(file, { force: true });
  fs.rmSync(`${file}1`, { force: true });
}

runBlender(null, 'author_vnext_production_glove_topology.py', [
  '--output-workfile', topologySource,
  '--output-report', reports.topology,
], 'segmented-source topology seed authoring');

runBlender(topologySource, 'author_vnext_production_glove_manufactured.py', [
  '--output-workfile', manufacturedSource,
  '--output-report', reports.manufactured,
], 'manufactured-surface source seed authoring');

runBlender(manufacturedSource, 'author_vnext_production_glove_sculpt.py', [
  '--output-workfile', sculptSource,
  '--output-report', reports.source,
], 'integrated sewn-volume glove sculpt authoring');

runBlender(sourceAthlete, 'fit_vnext_production_glove_sculpt.py', [
  '--glove-workfile', sculptSource,
  '--output-workfile', outputWorkfile,
  '--output-report', reports.fit,
], 'private integrated sewn-volume glove athlete fit');

runBlender(outputWorkfile, 'audit_vnext_production_glove_sculpt.py', [
  '--fit-report', reports.fit,
  '--output-report', reports.audit,
], 'private integrated sewn-volume glove audit');

runBlender(outputWorkfile, 'render_vnext_production_glove_sculpt.py', [
  '--output-dir', closeDirectory,
  '--output-report', reports.close,
], 'private integrated sewn-volume glove close review');

runBlender(outputWorkfile, 'render_vnext_upper_body_action_review.py', [
  '--output-dir', actionDirectory,
  '--output-report', reports.actions,
], 'private integrated sewn-volume glove all-action review');

run('python', [
  path.join(root, 'scripts/create_vnext_production_glove_fit_sheets.py'),
  '--input-dir', closeDirectory,
  '--prefix', 'production-glove-sculpt',
], 'private integrated sewn-volume glove close contact sheets');

run('python', [
  path.join(root, 'scripts/create_vnext_upper_body_contact_sheets.py'),
  '--input-dir', actionDirectory,
], 'private integrated sewn-volume glove action contact sheets');

console.log('GOON_VNEXT_PRODUCTION_GLOVE_SCULPT_READY');
