import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLAYER_RIG_ACCEPTANCE } from '../src/replay3d/assets/playerRigAcceptance.js';
import { PLAYER_RIG_ASSETS } from '../src/replay3d/assets/playerRigManifest.js';
import { NEUTRAL_PRODUCTION_SOURCES } from './player-rig-import-plan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inboxDir = path.join(root, 'asset-inbox', 'players');
const contractPath = path.join(inboxDir, 'player-rig-contract.json');
const readmePath = path.join(inboxDir, 'README.md');

const targetFiles = {
  runnerHome: {
    filename: path.basename(PLAYER_RIG_ASSETS.productionTargets.runnerHome),
    profile: 'runner',
    uniform: 'white jersey, blue accents, dark shorts, white helmet',
  },
  runnerAway: {
    filename: path.basename(PLAYER_RIG_ASSETS.productionTargets.runnerAway),
    profile: 'runner',
    uniform: 'red jersey, light accents, dark shorts, red helmet',
  },
  goalieHome: {
    filename: path.basename(PLAYER_RIG_ASSETS.productionTargets.goalieHome),
    profile: 'goalie',
    uniform: 'white goalie gear with blue Goon Squad accents',
  },
  goalieAway: {
    filename: path.basename(PLAYER_RIG_ASSETS.productionTargets.goalieAway),
    profile: 'goalie',
    uniform: 'red goalie gear with light accents',
  },
};

const contract = {
  schemaVersion: 1,
  purpose: 'Production GLB contract for the Goon Squad 3D ball hockey replay.',
  targetFolder: 'asset-inbox/players',
  importCommand: 'npm run asset:player:import',
  validationCommand: 'npm run asset:player:validate:production',
  targetFiles,
  acceptedSourcePacks: {
    exactFourFilePack: Object.fromEntries(
      Object.entries(targetFiles).map(([key, target]) => [key, target.filename]),
    ),
    neutralTwoFilePack: {
      runner: NEUTRAL_PRODUCTION_SOURCES.runner[0],
      goalie: NEUTRAL_PRODUCTION_SOURCES.goalie[0],
    },
  },
  sharedRequirements: {
    format: 'GLB 2.0',
    hierarchy: 'one skinned humanoid hierarchy per file',
    pivot: 'floor contact point between shoes',
    forwardAxis: 'match public/models/players/animated-runner.glb',
    textureBudget: '1024px max per material',
    forbiddenBranding: ['EA', 'NHL', 'real team marks', 'league-owned marks'],
    runtimeMaterialFragments: {
      jersey: ['jersey', 'shirt', 'uniform_top'],
      stripe: ['stripe', 'trim', 'number', 'logo', 'crest'],
      shorts: ['short', 'shorts'],
      shoes: ['shoe', 'sneaker', 'footwear'],
      helmet: ['helmet', 'mask'],
      visor: ['visor', 'cage', 'grille'],
      glove: ['glove', 'mitt', 'blocker', 'catcher'],
      goaliePads: ['pad', 'legpad', 'leg_pad'],
      stick: ['stick', 'shaft', 'blade', 'tape'],
    },
    requiredLook: [
      'adult ball hockey proportions',
      'running shoes',
      'helmet or mask',
      'gloves',
      'stick with shaft and blade',
      'Goon Squad-style uniform striping',
    ],
  },
  profiles: PLAYER_RIG_ACCEPTANCE,
};

function bulletList(values) {
  return values.map((value) => `- ${value}`).join('\n');
}

function groupList(groups) {
  return groups.map((group) => `- ${group.join(' / ')}`).join('\n');
}

const readme = `# Goon Squad 3D Player Asset Inbox

Place the four authored production GLBs in this folder, then run:

\`\`\`bash
npm run asset:player:import
\`\`\`

The import command optimizes the GLBs into \`public/models/players/\`, updates runtime availability, and runs strict production validation.

To regenerate the local readiness report without importing new files:

\`\`\`bash
npm run asset:player:sync
npm run asset:player:report
\`\`\`

To audit candidate GLBs before import, place files in \`asset-inbox/players/candidates\`, then run:

\`\`\`bash
npm run asset:player:audit
\`\`\`

## Accepted Source Packs

Option A, exact four-file pack:

${Object.values(targetFiles).map((target) => `- \`${target.filename}\` - ${target.profile}, ${target.uniform}`).join('\n')}

Option B, neutral two-file pack:

- \`${NEUTRAL_PRODUCTION_SOURCES.runner[0]}\` - runner source used for both home and away
- \`${NEUTRAL_PRODUCTION_SOURCES.goalie[0]}\` - goalie source used for both home and away

The runtime applies home and away Goon Squad materials after import, so Option B is the fastest path if the same rig can serve both uniforms.

## Shared Requirements

${bulletList(contract.sharedRequirements.requiredLook)}

Forbidden branding:

${bulletList(contract.sharedRequirements.forbiddenBranding)}

## Runtime Material Fragments

The runtime can apply Goon Squad home and away materials when mesh, node, or material names include these fragments:

${Object.entries(contract.sharedRequirements.runtimeMaterialFragments).map(([part, fragments]) => `- ${part}: ${fragments.join(' / ')}`).join('\n')}

## Runner Clips

${bulletList(PLAYER_RIG_ACCEPTANCE.runner.requiredClips.map((clip) => `\`${clip}\``))}

## Goalie Clips

${bulletList(PLAYER_RIG_ACCEPTANCE.goalie.requiredClips.map((clip) => `\`${clip}\``))}

## Runner Named Equipment Groups

The validator searches mesh, node, and material names. Each group needs at least one matching fragment:

${groupList(PLAYER_RIG_ACCEPTANCE.runner.requiredNamedPartGroups)}

## Goalie Named Equipment Groups

The validator searches mesh, node, and material names. Each group needs at least one matching fragment:

${groupList(PLAYER_RIG_ACCEPTANCE.goalie.requiredNamedPartGroups)}

## Machine-Readable Contract

See \`player-rig-contract.json\` in this folder.

## Readiness Report

After sync or import, see \`player-rig-readiness-report.md\` and \`player-rig-readiness-report.json\` in this folder.

## Candidate Audit

Before import, see \`player-rig-candidate-report.md\` and \`player-rig-candidate-report.json\` after running the audit command.
`;

await mkdir(inboxDir, { recursive: true });
await writeFile(contractPath, `${JSON.stringify(contract, null, 2)}\n`);
await writeFile(readmePath, readme);

console.log(`Wrote ${path.relative(root, contractPath)}`);
console.log(`Wrote ${path.relative(root, readmePath)}`);
