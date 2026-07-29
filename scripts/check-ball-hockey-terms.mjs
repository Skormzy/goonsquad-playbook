import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const targets = ['src', 'scripts', 'asset-inbox', 'docs/3d-quality', 'docs/vnext', 'package.json'];
const ignoredDirectories = new Set([
  '.git',
  '.superpowers',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'screenshots',
]);
const textExtensions = new Set([
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.txt',
  '.yml',
  '.yaml',
]);

const restrictedTerms = [
  [115, 107, 97, 116, 101],
  [115, 107, 97, 116, 101, 114],
  [115, 107, 97, 116, 105, 110, 103],
  [112, 117, 99, 107],
].map((codes) => String.fromCharCode(...codes));

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const restrictedPattern = new RegExp(`\\b(${restrictedTerms.map(escapeRegExp).join('|')})\\b`, 'iu');

function isTextFile(filePath) {
  if (path.basename(filePath) === 'package.json') return true;
  return textExtensions.has(path.extname(filePath).toLowerCase());
}

function* walk(entryPath) {
  const stats = fs.statSync(entryPath);
  if (stats.isFile()) {
    if (isTextFile(entryPath)) yield entryPath;
    return;
  }

  if (!stats.isDirectory()) return;
  if (ignoredDirectories.has(path.basename(entryPath))) return;

  for (const item of fs.readdirSync(entryPath, { withFileTypes: true })) {
    if (item.isDirectory() && ignoredDirectories.has(item.name)) continue;
    yield* walk(path.join(entryPath, item.name));
  }
}

function scanFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const matches = [];

  text.split(/\r?\n/).forEach((line, index) => {
    const match = line.match(restrictedPattern);
    if (!match) return;
    matches.push({
      file: path.relative(root, filePath),
      line: index + 1,
      term: match[1],
      text: line.trim(),
    });
  });

  return matches;
}

const allMatches = [];

for (const target of targets) {
  const absoluteTarget = path.join(root, target);
  if (!fs.existsSync(absoluteTarget)) continue;
  for (const filePath of walk(absoluteTarget)) {
    allMatches.push(...scanFile(filePath));
  }
}

if (allMatches.length > 0) {
  console.error('Ball hockey terminology check failed:');
  for (const match of allMatches) {
    console.error(`${match.file}:${match.line}: ${match.term}: ${match.text}`);
  }
  process.exit(1);
}

console.log('Ball hockey terminology check passed.');
