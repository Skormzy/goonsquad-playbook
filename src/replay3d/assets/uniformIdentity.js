export const JERSEY_NUMBERS = {
  G: '30',
  LD: '4',
  RD: '7',
  LW: '11',
  C: '91',
  RW: '18',
  F: '16',
  D: '2',
};

export function getJerseyNumber(player) {
  return JERSEY_NUMBERS[player?.role] ?? (player?.team === 'us' ? '23' : '8');
}

export function getUniformIdentityColors(player) {
  const uniform = player?.uniform ?? {};
  const isHome = player?.team === 'us';
  const accent = uniform.stripe ?? (isHome ? '#1d4ed8' : '#fee2e2');

  return {
    accent,
    number: isHome ? accent : '#fee2e2',
    outline: isHome ? '#f8fafc' : '#7f1d1d',
    crest: isHome ? '#0f172a' : '#fee2e2',
    helmetStripe: accent,
  };
}
