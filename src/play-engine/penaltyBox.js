export const PENALTY_BOX_STATUS = 'penalty-box';

const PENALTY_BOX_LANGUAGE = /\bpenalty box\b|serving the penalty|off the playing surface/i;

export function isPenaltyBoxPlayer(player) {
  if (!player) return false;
  if (player.status === PENALTY_BOX_STATUS || player.inactive === true) return true;

  return PENALTY_BOX_LANGUAGE.test([
    player.role,
    player.label,
    player.l,
    player.status,
  ].filter(Boolean).join(' '));
}
