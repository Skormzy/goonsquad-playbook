import tournamentSeed from './tournaments.json';
import officialYoutubeActivity from '../feed/officialYoutubeActivity.json';

export const TOURNAMENT_COMPETITION_ID = 'tournaments';

const VIDEO_TITLE_PATTERN = /^Goonsquad vs (.+?) \((Home|Away) View\) - Game (\d+) \| (.+)$/i;

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

export function parseTournamentVideo(activity) {
  const match = String(activity?.sourceTitle || '').match(VIDEO_TITLE_PATTERN);
  if (!match) return null;
  return {
    opponent: match[1].trim(),
    angle: match[2].toLowerCase(),
    gameNumber: Number(match[3]),
    tournamentName: match[4].trim(),
    title: activity.sourceTitle,
    url: activity.linkUrl,
    thumbnail: activity.sourceImageUrl,
    videoId: activity.sourceMetadata?.videoId || '',
    publishedAt: activity.sourcePublishedAt || '',
  };
}

export function enrichTournament(tournament, activities = officialYoutubeActivity.items) {
  const parsedVideos = (activities || [])
    .map(parseTournamentVideo)
    .filter(Boolean)
    .filter((video) => normalized(video.tournamentName) === normalized(tournament.name));

  const games = (tournament.games || []).map((game) => ({
    ...game,
    media: parsedVideos
      .filter((video) => (
        video.gameNumber === game.gameNumber
        && normalized(video.opponent) === normalized(game.opponent)
      ))
      .sort((a, b) => (a.angle === 'home' ? -1 : b.angle === 'home' ? 1 : 0)),
  }));

  return {
    ...tournament,
    games,
  };
}

export function buildTournamentArchive(
  tournaments = tournamentSeed,
  activities = officialYoutubeActivity.items,
) {
  return tournaments
    .map((tournament) => enrichTournament(tournament, activities))
    .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
}

export function tournamentById(tournaments, tournamentId) {
  return tournaments.find((tournament) => tournament.id === tournamentId) || tournaments[0] || null;
}

export function tournamentSummary(tournament) {
  const games = tournament?.games || [];
  const played = games.filter((game) => game.status === 'played' || game.status === 'final');
  const scored = played.filter((game) => Number.isFinite(game.scoreFor) && Number.isFinite(game.scoreAgainst));
  const wins = scored.filter((game) => game.scoreFor > game.scoreAgainst).length;
  const losses = scored.filter((game) => game.scoreFor < game.scoreAgainst).length;
  const ties = scored.filter((game) => game.scoreFor === game.scoreAgainst).length;
  const opponents = new Set(games.map((game) => game.opponent).filter(Boolean));
  const videoAngles = games.reduce((total, game) => total + (game.media?.length || 0), 0);

  return {
    documentedGames: games.length,
    playedGames: played.length,
    scoredGames: scored.length,
    wins,
    losses,
    ties,
    opponents: opponents.size,
    videoAngles,
    record: scored.length ? `${wins}-${losses}-${ties}` : 'Archive pending',
  };
}

export function sortedTournamentStandings(standings = []) {
  return [...standings]
    .sort((a, b) => (
      (b.points ?? 0) - (a.points ?? 0)
      || ((b.goalsFor ?? 0) - (b.goalsAgainst ?? 0)) - ((a.goalsFor ?? 0) - (a.goalsAgainst ?? 0))
      || (b.goalsFor ?? 0) - (a.goalsFor ?? 0)
      || String(a.team).localeCompare(String(b.team))
    ))
    .map((row, index) => ({
      ...row,
      rank: row.rank ?? index + 1,
    }));
}

export function tournamentBracketRounds(bracket = []) {
  const rounds = new Map();
  bracket.forEach((match) => {
    const roundId = match.roundId || 'round';
    if (!rounds.has(roundId)) {
      rounds.set(roundId, {
        id: roundId,
        name: match.roundName || 'Round',
        order: match.roundOrder ?? rounds.size,
        matches: [],
      });
    }
    rounds.get(roundId).matches.push(match);
  });
  return [...rounds.values()]
    .sort((a, b) => a.order - b.order)
    .map((round) => ({
      ...round,
      matches: round.matches.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    }));
}

export const TOURNAMENT_ARCHIVE = buildTournamentArchive();
