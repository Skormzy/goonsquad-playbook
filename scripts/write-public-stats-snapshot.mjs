import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'src/stats/yorkCentralSnapshot.json');
const targetDirectory = path.join(root, 'public/data');
const target = path.join(targetDirectory, 'team-statistics.json');

await mkdir(targetDirectory, { recursive: true });
await copyFile(source, target);
process.stdout.write(`Published runtime statistics snapshot to ${target}\n`);
