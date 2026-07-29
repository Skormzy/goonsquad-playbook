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

const outputDirectory = path.join(
  root,
  'asset-inbox',
  'players',
  'vnext',
  'production-glove-base',
);
const evidenceDirectory = path.join(
  root,
  'docs',
  'vnext',
  'evidence',
  'production-glove-base-review',
);
const workfile = path.join(outputDirectory, 'goon-production-glove-base-v1.blend');
const reports = {
  author: path.join(outputDirectory, 'production-glove-base-author-report.json'),
  audit: path.join(outputDirectory, 'production-glove-base-audit.json'),
  renders: path.join(outputDirectory, 'production-glove-base-render-report.json'),
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
    '--python', path.join(root, 'scripts', 'blender', script),
    '--', ...args,
  ], label);
}

for (const directory of [outputDirectory, evidenceDirectory]) {
  fs.mkdirSync(directory, { recursive: true });
}
for (const file of [workfile, ...Object.values(reports)]) {
  fs.rmSync(file, { force: true });
  fs.rmSync(`${file}1`, { force: true });
}
for (const file of fs.readdirSync(evidenceDirectory)) {
  if (file.endsWith('.png')) fs.rmSync(path.join(evidenceDirectory, file), { force: true });
}

runBlender(null, 'author_vnext_production_glove_base.py', [
  '--output-workfile', workfile,
  '--output-report', reports.author,
], 'continuous production glove base authoring');

runBlender(workfile, 'audit_vnext_production_glove_base.py', [
  '--author-report', reports.author,
  '--output-report', reports.audit,
], 'continuous production glove base audit');

runBlender(workfile, 'render_vnext_production_glove_base.py', [
  '--output-dir', evidenceDirectory,
  '--output-report', reports.renders,
], 'continuous production glove base render');

console.log('GOON_VNEXT_PRODUCTION_GLOVE_BASE_READY');
