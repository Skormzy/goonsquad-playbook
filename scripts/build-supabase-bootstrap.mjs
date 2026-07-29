import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrations = [
  '20260718_playmaker_plays.sql',
  '20260722_team_accounts_and_statistics.sql',
  '20260723_member_profiles.sql',
];
const sections = await Promise.all(migrations.map(async (name) => {
  const sql = await readFile(path.join(root, 'supabase', 'migrations', name), 'utf8');
  return `-- BEGIN ${name}\n${sql.trim()}\n-- END ${name}`;
}));
const outputDir = path.join(root, 'docs', 'launch');
const outputPath = path.join(outputDir, 'GOONSQUAD_SUPABASE_BOOTSTRAP.sql');
await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, `${sections.join('\n\n')}\n`, 'utf8');
console.log(outputPath);
