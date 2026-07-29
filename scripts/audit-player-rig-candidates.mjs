import { NodeIO } from '@gltf-transform/core';
import { EXTTextureWebP, KHRMeshQuantization } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarizeCandidateAudits } from './player-rig-candidate-audit.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultCandidateDir = path.join(root, 'asset-inbox', 'players', 'candidates');
const outputDir = path.join(root, 'asset-inbox', 'players');
const publicCandidateDir = path.join(root, 'public', 'models', 'players', 'candidates');
const generatedManifestPath = path.join(root, 'src', 'replay3d', 'assets', 'generatedPlayerRigCandidates.js');
const args = process.argv.slice(2);
const showHelp = args.includes('--help') || args.includes('-h');
const candidateDir = path.resolve(root, args.find((arg) => !arg.startsWith('-')) ?? defaultCandidateDir);
const reportJsonPath = path.join(outputDir, 'player-rig-candidate-report.json');
const reportMarkdownPath = path.join(outputDir, 'player-rig-candidate-report.md');
const io = new NodeIO().registerExtensions([EXTTextureWebP, KHRMeshQuantization]);

function animationDuration(animation) {
  return Math.max(0, ...animation.listSamplers().map((sampler) => {
    const input = sampler.getInput();
    const times = input?.getArray();
    if (!times || times.length === 0) return 0;
    return times[times.length - 1] ?? 0;
  }));
}

if (showHelp) {
  console.log([
    'Audit candidate ball hockey player GLBs before production import.',
    '',
    'Usage:',
    '  npm run asset:player:audit -- <candidate-folder>',
    '',
    'Default candidate folder:',
    `  ${path.relative(root, defaultCandidateDir)}`,
    '',
    'The command writes:',
    `  ${path.relative(root, reportJsonPath)}`,
    `  ${path.relative(root, reportMarkdownPath)}`,
    `  ${path.relative(root, generatedManifestPath)}`,
    `  ${path.relative(root, publicCandidateDir)}`,
  ].join('\n'));
  process.exit(0);
}

async function listCandidateFiles(folder) {
  try {
    const entries = await readdir(folder);
    return entries
      .filter((entry) => entry.toLowerCase().endsWith('.glb'))
      .map((entry) => path.join(folder, entry));
  } catch {
    await mkdir(folder, { recursive: true });
    return [];
  }
}

function getSceneStats(doc) {
  const rootDoc = doc.getRoot();
  const animations = rootDoc.listAnimations();
  const clips = animations.map((animation) => animation.getName()).filter(Boolean);
  const clipDurations = Object.fromEntries(animations
    .filter((animation) => animation.getName())
    .map((animation) => [animation.getName(), Number(animationDuration(animation).toFixed(3))]));
  const meshes = rootDoc.listMeshes();
  const nodes = rootDoc.listNodes().map((node) => node.getName()).filter(Boolean);
  const meshNames = meshes.map((mesh) => mesh.getName()).filter(Boolean);
  const materialNames = rootDoc.listMaterials().map((material) => material.getName()).filter(Boolean);
  const scene = rootDoc.getDefaultScene() ?? rootDoc.listScenes()[0];
  const bounds = scene ? getBounds(scene) : null;
  const dimensions = bounds ? {
    width: Number((bounds.max[0] - bounds.min[0]).toFixed(3)),
    height: Number((bounds.max[1] - bounds.min[1]).toFixed(3)),
    depth: Number((bounds.max[2] - bounds.min[2]).toFixed(3)),
  } : null;
  const uploadedVertices = meshes.reduce((sum, mesh) => (
    sum + mesh.listPrimitives().reduce((innerSum, primitive) => {
      const position = primitive.getAttribute('POSITION');
      return innerSum + (position?.getCount() ?? 0);
    }, 0)
  ), 0);

  return {
    clips,
    clipDurations,
    dimensions,
    namedParts: [...meshNames, ...nodes, ...materialNames],
    uploadedVertices,
  };
}

async function inspectCandidate(file) {
  const doc = await io.read(file);
  const stats = getSceneStats(doc);
  const fileStat = await stat(file);
  const stagedName = safePreviewFileName(path.basename(file));
  const stagedPath = path.join(publicCandidateDir, stagedName);
  await mkdir(publicCandidateDir, { recursive: true });
  await copyFile(file, stagedPath);

  return {
    fileName: path.basename(file),
    filePath: path.relative(root, file),
    previewUrl: `/models/players/candidates/${stagedName}`,
    bytes: fileStat.size,
    uploadedVertices: stats.uploadedVertices,
    clips: stats.clips,
    clipDurations: stats.clipDurations,
    dimensions: stats.dimensions,
    namedParts: stats.namedParts,
  };
}

function safePreviewFileName(fileName) {
  const parsed = path.parse(fileName);
  const base = parsed.name.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 72) || 'candidate';
  return `${base}.glb`;
}

function formatIssues(profile) {
  if (profile.issues.length === 0) return '- No blocking issues detected for this profile.';
  return profile.issues.map((issue) => `- ${issue}`).join('\n');
}

function candidateSection(candidate) {
  return `## ${candidate.fileName}

- Recommended profile: ${candidate.recommendedProfile}
- Best score: ${candidate.score}/100
- Status: ${candidate.status}
- Vertices: ${candidate.uploadedVertices}
- Dimensions: ${candidate.dimensions ? `${candidate.dimensions.height}m high x ${candidate.dimensions.width}m wide x ${candidate.dimensions.depth}m deep` : 'unknown'}
- Recommended preview scale: ${candidate.recommendedScale ?? 'none'}
- Browser preview: \`${candidate.previewUrl}\`
- Clips: ${candidate.clips.length > 0 ? candidate.clips.map((clip) => `\`${clip}\``).join(', ') : 'none'}

${candidate.profiles.map((profile) => `### ${profile.profile}

- Score: ${profile.score}/100
- Vertices: ${profile.uploadedVertices} / ${profile.maxVertices}

${formatIssues(profile)}
`).join('\n')}
`;
}

function toMarkdown(report) {
  if (report.totalCount === 0) {
    return `# Player Rig Candidate Report

Status: empty

No candidate GLBs found. Place candidate files in \`asset-inbox/players/candidates\`, then run:

\`\`\`bash
npm run asset:player:audit
\`\`\`
`;
  }

  return `# Player Rig Candidate Report

Status: ${report.status}

Candidates: ${report.totalCount}

Best candidate: ${report.bestCandidate.fileName} (${report.bestCandidate.score}/100 as ${report.bestCandidate.recommendedProfile})

${report.candidates.map(candidateSection).join('\n')}
`;
}

const candidateFiles = await listCandidateFiles(candidateDir);
const candidates = [];

for (const file of candidateFiles) {
  candidates.push(await inspectCandidate(file));
}

const report = summarizeCandidateAudits(candidates);
const generatedManifest = `${[
  '// Generated by scripts/audit-player-rig-candidates.mjs.',
  '// Commit this file so the rig review surface can preview the latest audited candidate GLBs.',
  'export const PLAYER_RIG_CANDIDATES = ',
].join('\n')}${JSON.stringify(report, null, 2)};\n\nexport const HAS_CANDIDATE_RIGS = PLAYER_RIG_CANDIDATES.candidates.length > 0;\n`;

await mkdir(outputDir, { recursive: true });
await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(reportMarkdownPath, toMarkdown(report));
await writeFile(generatedManifestPath, generatedManifest);

console.log(`Candidate audit: ${report.status} (${report.totalCount} files)`);
for (const candidate of report.candidates) {
  console.log(`- ${candidate.fileName}: ${candidate.score}/100 as ${candidate.recommendedProfile}`);
  const bestProfile = candidate.profiles[0];
  for (const issue of bestProfile.issues) console.log(`  - ${issue}`);
}
console.log(`Wrote ${path.relative(root, reportJsonPath)}`);
console.log(`Wrote ${path.relative(root, reportMarkdownPath)}`);
console.log(`Wrote ${path.relative(root, generatedManifestPath)}`);
