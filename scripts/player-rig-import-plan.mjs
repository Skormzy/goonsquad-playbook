import path from 'node:path';

export const NEUTRAL_PRODUCTION_SOURCES = {
  runner: [
    'goon-runner-production.glb',
    'goon-runner-base.glb',
    'goon-runner.glb',
  ],
  goalie: [
    'goon-goalie-production.glb',
    'goon-goalie-base.glb',
    'goon-goalie.glb',
  ],
};

export function getRigRoleForProductionKey(key) {
  return key.toLowerCase().includes('goalie') ? 'goalie' : 'runner';
}

export function getCandidateSourceNames(key, assetUrl) {
  const exact = path.basename(assetUrl);
  const role = getRigRoleForProductionKey(key);
  return [exact, ...NEUTRAL_PRODUCTION_SOURCES[role]];
}

export function createProductionImportPlan({
  productionTargets,
  sourceDir,
  availableFileNames,
  toDiskPath,
  roles = ['runner', 'goalie'],
}) {
  const available = new Set(availableFileNames);
  const acceptedRoles = new Set(roles);
  const plan = [];
  const missing = [];

  for (const [key, assetUrl] of Object.entries(productionTargets)) {
    const role = getRigRoleForProductionKey(key);
    if (!acceptedRoles.has(role)) continue;

    const candidates = getCandidateSourceNames(key, assetUrl);
    const sourceName = candidates.find((candidate) => available.has(candidate));
    const targetName = path.basename(assetUrl);
    const item = {
      key,
      assetUrl,
      targetName,
      target: toDiskPath(assetUrl),
      sourceName,
      source: sourceName ? path.join(sourceDir, sourceName) : null,
      candidates,
      usesNeutralSource: Boolean(sourceName && sourceName !== targetName),
    };

    if (sourceName) plan.push(item);
    else missing.push(item);
  }

  return { plan, missing };
}

export function formatExpectedSourceOptions(productionTargets) {
  const exactFiles = Object.values(productionTargets)
    .map((assetUrl) => `  - ${path.basename(assetUrl)}`)
    .join('\n');
  const neutralFiles = [
    ...NEUTRAL_PRODUCTION_SOURCES.runner.slice(0, 1),
    ...NEUTRAL_PRODUCTION_SOURCES.goalie.slice(0, 1),
  ].map((file) => `  - ${file}`).join('\n');

  return [
    'Exact four-file pack:',
    exactFiles,
    '',
    'Neutral two-file pack accepted because uniforms are applied at runtime:',
    neutralFiles,
  ].join('\n');
}
