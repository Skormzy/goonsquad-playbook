import { spawn } from 'node:child_process';
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYER_RIG_ASSETS } from '../src/replay3d/assets/playerRigManifest.js';
import {
  createProductionImportPlan,
  formatExpectedSourceOptions,
  getRigRoleForProductionKey,
} from './player-rig-import-plan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultSourceDir = path.join(root, 'asset-inbox', 'players');
const args = process.argv.slice(2);
const showHelp = args.includes('--help') || args.includes('-h');
const sourceDir = path.resolve(root, args.find((arg) => !arg.startsWith('-')) ?? defaultSourceDir);
const runnersOnly = args.includes('--runners-only');

const productionTargets = {
  runnerHome: PLAYER_RIG_ASSETS.productionTargets.runnerHome,
  runnerAway: PLAYER_RIG_ASSETS.productionTargets.runnerAway,
  goalieHome: PLAYER_RIG_ASSETS.productionTargets.goalieHome,
  goalieAway: PLAYER_RIG_ASSETS.productionTargets.goalieAway,
};

function run(command, commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { cwd: root, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

function toDiskPath(assetUrl) {
  return path.join(root, 'public', assetUrl.replace(/^\//, '').replaceAll('/', path.sep));
}

if (showHelp) {
  console.log([
    'Import production ball hockey player GLBs into the replay runtime.',
    '',
    'Usage:',
    '  npm run asset:player:import -- <source-folder>',
    '  npm run asset:player:import -- <source-folder> --runners-only',
    '',
    'Default source folder:',
    `  ${path.relative(root, defaultSourceDir)}`,
    '',
    'Accepted source packs:',
    formatExpectedSourceOptions(productionTargets),
    '',
    'Run `npm run asset:player:contract` to regenerate the asset-inbox contract packet.',
    '',
    'The command optimizes files into public/models/players, syncs availability,',
    'and runs strict production validation. Use --runners-only to promote field-player',
    'assets while goalie assets stay on the bridge path.',
  ].join('\n'));
  process.exit(0);
}

let availableFileNames = new Set();
try {
  availableFileNames = new Set(await readdir(sourceDir));
} catch {
  availableFileNames = new Set();
}

const { plan: importPlan, missing } = createProductionImportPlan({
  productionTargets,
  sourceDir,
  availableFileNames,
  toDiskPath,
  roles: runnersOnly ? ['runner'] : ['runner', 'goalie'],
});

if (missing.length > 0) {
  console.error(`Production GLB import aborted. Missing source files in ${sourceDir}:`);
  for (const item of missing) {
    console.error(`  - ${item.targetName} needs one of: ${item.candidates.join(', ')}`);
  }
  console.error('');
  console.error('Accepted source packs:');
  console.error(formatExpectedSourceOptions(productionTargets));
  process.exit(1);
}

await mkdir(path.dirname(importPlan[0].target), { recursive: true });

for (const item of importPlan) {
  const sourceType = item.usesNeutralSource ? 'neutral source' : 'exact source';
  const role = getRigRoleForProductionKey(item.key);
  if (role === 'runner') {
    console.log(`Preserving normalized runner GLB ${item.key} (${sourceType}): ${path.relative(root, item.source)} -> ${path.relative(root, item.target)}`);
    await copyFile(item.source, item.target);
    continue;
  }

  console.log(`Optimizing ${item.key} (${sourceType}): ${path.relative(root, item.source)} -> ${path.relative(root, item.target)}`);
  await run(process.execPath, [
    'node_modules/@gltf-transform/cli/bin/cli.js',
    'optimize',
    item.source,
    item.target,
    '--compress',
    'quantize',
    '--texture-compress',
    'webp',
    '--texture-size',
    '512',
    '--palette',
    'false',
    '--join-named',
    'false',
    '--simplify',
    'false',
  ]);
}

await run(process.execPath, ['scripts/sync-player-rig-manifest.mjs']);
await run(process.execPath, ['scripts/write-player-rig-readiness-report.mjs']);
await run(process.execPath, [
  'scripts/validate-player-rig.mjs',
  '--strict-production',
  ...(runnersOnly ? ['--runners-only'] : []),
]);

console.log('Production player rig import completed.');
