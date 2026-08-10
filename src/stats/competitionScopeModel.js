export const COMPETITION_SCOPE_ORDER = Object.freeze([
  'regular',
  'playoffs',
  'tournaments',
  'all',
]);

export const COMPETITION_SCOPE_META = Object.freeze({
  regular: {
    label: 'Regular season',
    shortLabel: 'Regular',
    eyebrow: 'LEAGUE PLAY',
    description: 'Career totals from regular-season league games only.',
    eventLabel: 'seasons',
  },
  playoffs: {
    label: 'Playoffs',
    shortLabel: 'Playoffs',
    eyebrow: 'POSTSEASON',
    description: 'League playoff totals, kept separate from the regular season.',
    eventLabel: 'postseasons',
  },
  tournaments: {
    label: 'Tournaments',
    shortLabel: 'Tournaments',
    eyebrow: 'TOURNAMENT PLAY',
    description: 'Tournament totals across documented Goonsquad events.',
    eventLabel: 'tournaments',
  },
  all: {
    label: 'Combined',
    shortLabel: 'Combined',
    eyebrow: 'FULL GOONSQUAD CAREER',
    description: 'Regular season, playoffs, and tournaments combined in one explicit view.',
    eventLabel: 'entries',
  },
});

export function availableCompetitionScopes(scopes = {}) {
  return COMPETITION_SCOPE_ORDER.filter((scopeId) => scopes[scopeId]?.available);
}
