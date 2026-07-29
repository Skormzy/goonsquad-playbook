import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blenderNotFoundMessage, findBlenderExecutable, getBlenderCandidates } from './blender-path.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const showHelp = args.includes('--help') || args.includes('-h');
const defaultSourceDir = path.join(root, 'asset-inbox', 'players', 'blender-sources');
const defaultOutputDir = path.join(root, 'asset-inbox', 'players', 'generated');
const sourceDir = path.resolve(root, args.find((arg) => !arg.startsWith('-')) ?? defaultSourceDir);
const outputDirArgIndex = args.findIndex((arg) => arg === '--out');
const outputDir = path.resolve(root, outputDirArgIndex >= 0 ? args[outputDirArgIndex + 1] : defaultOutputDir);
const blenderScript = path.join(root, 'scripts', 'blender', 'normalize_player_rigs.py');
const auditScript = path.join(root, 'scripts', 'audit-player-rig-candidates.mjs');
const runnersOnly = args.includes('--runners-only');

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

if (showHelp) {
  console.log([
    'Normalize authored ball hockey player source rigs through Blender.',
    '',
    'Usage:',
    '  npm run asset:player:blender:normalize -- <source-folder> --out <output-folder>',
    '  npm run asset:player:blender:normalize -- <source-folder> --runners-only',
    '',
    'Default source folder:',
    `  ${path.relative(root, defaultSourceDir)}`,
    '',
    'Default output folder:',
    `  ${path.relative(root, defaultOutputDir)}`,
    '',
    'Accepted source packs:',
    '  Exact four-file pack:',
    '    goon-runner-home.glb|gltf|fbx',
    '    goon-runner-away.glb|gltf|fbx',
    '    goon-goalie-home.glb|gltf|fbx',
    '    goon-goalie-away.glb|gltf|fbx',
    '',
    '  Neutral two-file pack:',
    '    goon-runner-production.glb|gltf|fbx',
    '    goon-goalie-production.glb|gltf|fbx',
    '',
    'This command writes normalized GLBs to the output folder, then runs the candidate audit.',
    'Use --runners-only to ignore goalie sources while field-player assets are being authored.',
  ].join('\n'));
  process.exit(0);
}

const blender = await findBlenderExecutable();
if (!blender) {
  console.error(blenderNotFoundMessage(await getBlenderCandidates()));
  process.exit(1);
}

await mkdir(outputDir, { recursive: true });

console.log(`Using Blender: ${blender}`);
console.log(`Source rigs: ${sourceDir}`);
console.log(`Generated rigs: ${outputDir}`);

let blenderError = null;

try {
  await run(blender, [
    '--background',
    '--factory-startup',
    '--python',
    blenderScript,
    '--',
    '--source-dir',
    sourceDir,
    '--output-dir',
    outputDir,
    ...(runnersOnly ? ['--runners-only'] : []),
  ]);
} catch (error) {
  blenderError = error;
  console.error(error.message);
  console.error('Blender normalization did not produce a complete source pack. See the generated report for missing source rigs or clip work.');
}

await run(process.execPath, [auditScript, outputDir]);

if (blenderError) process.exit(1);
