import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import convertFbxToGltf from '@robertlong/fbx2gltf';

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
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

const source = process.argv[2] ?? 'public/models/player.fbx';
const output = process.argv[3] ?? 'public/models/players/goon-player.glb';
const rawOutput = output.replace(/\.glb$/i, '.raw.glb');

await mkdir('public/models/players', { recursive: true });

await convertFbxToGltf(source, rawOutput, ['--pbr-metallic-roughness']);

await run(
  process.execPath,
  [
    'node_modules/@gltf-transform/cli/bin/cli.js',
    'optimize',
    rawOutput,
    output,
    '--compress',
    'quantize',
    '--texture-compress',
    'webp',
    '--texture-size',
    '1024',
    '--simplify',
    'false',
  ],
);

console.log(`Prepared player rig: ${output}`);
