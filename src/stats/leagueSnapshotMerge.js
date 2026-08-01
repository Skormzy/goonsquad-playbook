const COLLECTION_KEYS = Object.freeze([
  'seasons',
  'teams',
  'players',
  'memberships',
  'games',
  'teamGameStats',
  'playerGameStats',
  'goalieGameStats',
  'gameEvents',
  'teamSeasonSummaries',
  'standings',
  'playerSeasonStats',
  'goalieSeasonStats',
]);

const UNIQUE_ID_KEYS = Object.freeze([
  'seasons',
  'teams',
  'players',
  'memberships',
  'games',
  'playerGameStats',
  'goalieGameStats',
  'gameEvents',
  'playerSeasonStats',
  'goalieSeasonStats',
]);

const SEASON_ORDER = Object.freeze({ Fall: 4, Summer: 3, Spring: 2, Winter: 1 });

function seasonSortValue(season) {
  const years = String(season?.name || '').match(/\d{4}/g)?.map(Number) || [0];
  const endYear = Math.max(...years);
  const term = Object.keys(SEASON_ORDER).find((name) => String(season?.name || '').startsWith(name));
  return endYear * 10 + (SEASON_ORDER[term] || 0);
}

function assertUniqueIds(dataset) {
  UNIQUE_ID_KEYS.forEach((key) => {
    const rows = dataset[key] || [];
    const seen = new Set();
    const duplicates = new Set();
    rows.forEach((row) => {
      if (!row?.id) return;
      if (seen.has(row.id)) duplicates.add(row.id);
      seen.add(row.id);
    });
    if (duplicates.size) {
      throw new Error(`League archive ID collision in ${key}: ${[...duplicates].join(', ')}`);
    }
  });
}

export function mergeLeagueSnapshots(...snapshots) {
  const validSnapshots = snapshots.filter(Boolean);
  if (!validSnapshots.length) throw new Error('At least one league snapshot is required.');
  const capturedTimes = validSnapshots
    .map((snapshot) => Date.parse(snapshot.capturedAt || ''))
    .filter(Number.isFinite);
  const merged = {
    source: 'league-snapshot',
    sourceName: 'Goonsquad league records',
    sourceUrl: null,
    capturedAt: capturedTimes.length ? new Date(Math.max(...capturedTimes)).toISOString() : null,
    sourceArchives: validSnapshots.map((snapshot) => ({
      key: snapshot.sourceKey || (/York Central/i.test(snapshot.sourceName || '') ? 'york-central' : snapshot.sourceName),
      name: snapshot.sourceName,
      url: snapshot.sourceUrl,
      capturedAt: snapshot.capturedAt,
    })),
  };
  COLLECTION_KEYS.forEach((key) => {
    merged[key] = validSnapshots.flatMap((snapshot) => {
      const leagueKey = snapshot.sourceKey || (/York Central/i.test(snapshot.sourceName || '') ? 'york-central' : null);
      return (snapshot[key] || []).map((row) => (
        key === 'seasons' || key === 'teams'
          ? { leagueKey, leagueName: snapshot.sourceName, ...row }
          : row
      ));
    });
  });
  merged.seasons.sort((a, b) => (
    Number(Boolean(b.current)) - Number(Boolean(a.current))
    || seasonSortValue(b) - seasonSortValue(a)
    || String(a.id).localeCompare(String(b.id))
  ));
  merged.detailImport = {
    requestedGames: validSnapshots.reduce((total, snapshot) => total + Number(snapshot.detailImport?.requestedGames || 0), 0),
    importedGames: validSnapshots.reduce((total, snapshot) => total + Number(snapshot.detailImport?.importedGames || 0), 0),
    errors: validSnapshots.flatMap((snapshot) => snapshot.detailImport?.errors || []),
  };
  assertUniqueIds(merged);
  return merged;
}
