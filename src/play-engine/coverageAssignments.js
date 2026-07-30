import { tacticalMatchupsForReplay } from '../tactical3d/tacticalLayers';

const MIRRORED_HOME_ROLE = Object.freeze({
  LW: 'RW',
  RW: 'LW',
  LD: 'RD',
  RD: 'LD',
  C: 'C',
});

export function hasCoverageAssignments(coverage) {
  return Object.values(coverage ?? {}).some(Boolean);
}

export function coverageAssignmentsForReplay(replay, requestedTime = 0, { mirrored = false } = {}) {
  if (!replay?.players) return null;

  const playersById = new Map(replay.players.map((player) => [player.id, player]));
  const assignments = {};

  tacticalMatchupsForReplay(replay, requestedTime).forEach((matchup) => {
    const home = playersById.get(matchup.homePlayerId);
    const opponent = playersById.get(matchup.opponentPlayerId);
    if (
      home?.team !== 'us'
      || home.role === 'G'
      || opponent?.team !== 'opponent'
    ) return;

    const homeRole = mirrored ? MIRRORED_HOME_ROLE[home.role] : home.role;
    if (homeRole) assignments[homeRole] = opponent.id;
  });

  return hasCoverageAssignments(assignments) ? assignments : null;
}

export function contextualCoverageForReplay({
  enabled = true,
  lane,
  mirrored = false,
  replay,
  time = 0,
}) {
  if (!enabled || lane !== 'defence') return null;
  return coverageAssignmentsForReplay(replay, time, { mirrored });
}
