import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYER_RIG_AVAILABILITY } from '../src/replay3d/assets/generatedPlayerRigAvailability.js';
import { getProductionRigReadinessReport } from '../src/replay3d/assets/playerRigReadiness.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'asset-inbox', 'players');
const jsonPath = path.join(outputDir, 'player-rig-readiness-report.json');
const markdownPath = path.join(outputDir, 'player-rig-readiness-report.md');
const report = getProductionRigReadinessReport(PLAYER_RIG_AVAILABILITY);

function issueList(asset) {
  if (asset.issues.length === 0) return '- No blocking issues detected.';
  return asset.issues.map((issue) => `- ${issue}`).join('\n');
}

function assetSection(asset) {
  return `## ${asset.label}

- Status: ${asset.statusLabel}
- Readiness score: ${asset.readinessScore}/100
- File: \`${asset.fileName}\`
- Size: ${asset.bytes} / ${asset.maxBytes} bytes
- Vertices: ${asset.uploadedVertices} / ${asset.maxVertices}
- Missing clips: ${asset.missingClips.length > 0 ? asset.missingClips.map((clip) => `\`${clip}\``).join(', ') : 'none'}
- Missing equipment groups: ${asset.missingPartGroups.length > 0 ? asset.missingPartGroups.map((group) => group.join(' / ')).join('; ') : 'none'}
- Retarget motion quality: ${asset.retargetMotionQuality ?? 'n/a'}
- Final-grade clips: ${asset.finalGradeClips.length > 0 ? asset.finalGradeClips.map((clip) => `\`${clip}\``).join(', ') : 'none'}
- Missing final-grade clips: ${asset.missingFinalGradeClips.length > 0 ? asset.missingFinalGradeClips.map((clip) => `\`${clip}\``).join(', ') : 'none'}

${issueList(asset)}
`;
}

const markdown = `# Production Player Rig Readiness

Status: ${report.status}

Score: ${report.score}/100

Ready: ${report.readyCount}/${report.totalCount}

Missing: ${report.missingCount}

Needs work: ${report.needsWorkCount}

${report.assets.map(assetSection).join('\n')}
`;

await mkdir(outputDir, { recursive: true });
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(markdownPath, markdown);

console.log(`Production rig readiness: ${report.status} (${report.score}/100)`);
for (const asset of report.assets) {
  console.log(`- ${asset.label}: ${asset.statusLabel} (${asset.readinessScore}/100)`);
  for (const issue of asset.issues) console.log(`  - ${issue}`);
}
console.log(`Wrote ${path.relative(root, jsonPath)}`);
console.log(`Wrote ${path.relative(root, markdownPath)}`);
