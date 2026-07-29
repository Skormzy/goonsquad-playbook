import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blenderNotFoundMessage, findBlenderExecutable, getBlenderCandidates } from './blender-path.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const probeScript = path.join(root, 'scripts', 'blender', 'probe_environment.py');

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
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

const blender = await findBlenderExecutable();
if (!blender) {
  console.error(blenderNotFoundMessage(await getBlenderCandidates()));
  process.exit(1);
}

console.log(`Using Blender: ${blender}`);
await run(blender, [
  '--background',
  '--factory-startup',
  '--python',
  probeScript,
]);
