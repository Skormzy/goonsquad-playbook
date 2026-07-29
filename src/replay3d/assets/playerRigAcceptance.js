export const RUNNER_REQUIRED_CLIPS = [
  'idle-ready',
  'jog-forward',
  'sprint-forward',
  'stick-handle',
  'forehand-pass',
  'receive-pass',
  'wrist-shot',
];

export const GOALIE_REQUIRED_CLIPS = [
  'goalie-ready',
  'goalie-slide',
];

export const PLAYER_RIG_ACCEPTANCE = {
  runner: {
    maxVertices: 20000,
    maxBytes: 2500000,
    minHeight: 1.45,
    maxHeight: 2.45,
    maxWidth: 1.55,
    maxDepth: 1.55,
    requiredClips: RUNNER_REQUIRED_CLIPS,
    requiredNamedPartGroups: [
      ['jersey', 'shirt', 'uniform_top'],
      ['short', 'shorts'],
      ['shoe', 'sneaker', 'footwear'],
      ['helmet', 'cage', 'visor'],
      ['glove', 'mitt'],
    ],
    requiredSideBalancedPartGroups: [
      { label: 'shoes', fragments: ['shoe', 'sneaker', 'footwear'] },
      { label: 'shin and sock guards', fragments: ['sock_shin_guard', 'shin_guard'] },
      { label: 'short legs', fragments: ['shorts'] },
      { label: 'gloves', fragments: ['glove', 'mitt'] },
      { label: 'forearm compression sleeves', fragments: ['compression_sleeve_forearm'] },
      { label: 'upper-arm compression sleeves', fragments: ['compression_sleeve_upperarm'] },
      { label: 'elbow pads', fragments: ['elbow_pad', '_elbow'] },
      { label: 'shoulder pads', fragments: ['shoulder_pad', '_shoulder', 'shoulder_cap'] },
      { label: 'jersey sleeves', fragments: ['jersey_uniform_top', 'sleeve'] },
    ],
  },
  goalie: {
    maxVertices: 35000,
    maxBytes: 4000000,
    requiredClips: GOALIE_REQUIRED_CLIPS,
    requiredNamedPartGroups: [
      ['jersey', 'shirt', 'uniform_top'],
      ['shoe', 'sneaker', 'footwear'],
      ['helmet', 'mask', 'cage'],
      ['pad', 'legpad', 'leg_pad'],
      ['blocker'],
      ['catcher', 'glove'],
      ['stick', 'shaft', 'blade'],
    ],
  },
};

export function getRigProfileForKey(key) {
  return key.toLowerCase().includes('goalie')
    ? PLAYER_RIG_ACCEPTANCE.goalie
    : PLAYER_RIG_ACCEPTANCE.runner;
}

export function missingNamedPartGroups(namedParts, requiredGroups) {
  const text = namedParts.join(' ').toLowerCase();
  return requiredGroups.filter((group) => !group.some((fragment) => text.includes(fragment)));
}

function containsSide(partName, side) {
  const text = partName.toLowerCase();
  return text.includes(`_${side}`)
    || text.includes(`${side}_`)
    || text.endsWith(side)
    || text.includes(`-${side}`)
    || text.includes(`${side}-`);
}

function containsRequiredFragments(partName, fragments) {
  const text = partName.toLowerCase();
  return fragments.some((fragment) => text.includes(fragment));
}

export function missingSideBalancedPartGroups(namedParts, requiredGroups = []) {
  const parts = namedParts.map((part) => part.toLowerCase());
  const missing = [];

  for (const group of requiredGroups) {
    for (const side of ['left', 'right']) {
      const hasSidePart = parts.some((part) => (
        containsSide(part, side)
        && containsRequiredFragments(part, group.fragments)
      ));
      if (!hasSidePart) {
        missing.push({
          label: group.label,
          missingSide: side,
          fragments: group.fragments,
        });
      }
    }
  }

  return missing;
}
