import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import greaterTorontoSnapshot from '../src/stats/greaterTorontoSnapshot.json' with { type: 'json' };
import yorkCentralSnapshot from '../src/stats/yorkCentralSnapshot.json' with { type: 'json' };
import { mergeLeagueSnapshots } from '../src/stats/leagueSnapshotMerge.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetDirectory = path.join(root, 'public/data');
const target = path.join(targetDirectory, 'team-statistics.json');
const snapshot = mergeLeagueSnapshots(yorkCentralSnapshot, greaterTorontoSnapshot);

await mkdir(targetDirectory, { recursive: true });
await writeFile(target, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
process.stdout.write(`Published runtime statistics snapshot to ${target}\n`);
