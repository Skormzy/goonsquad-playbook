import { isUpcomingGame } from '../stats/scheduleFreshness';
import { formatLeagueScheduleName } from '../stats/statsModel';

const OPEN_TOURNAMENT_STATUSES = new Set(['upcoming', 'live']);
const CLOSED_GAME_STATUSES = new Set(['final', 'played', 'cancelled', 'eliminated', 'not-qualified']);

function timestamp(value) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function tournamentGameTime(tournament, game, index) {
  if (game?.scheduledAt) return game.scheduledAt;
  if (game?.date) {
    return `${game.date}T${game.time || '12:00'}:00`;
  }
  if (tournament?.startDate) {
    const start = timestamp(`${tournament.startDate}T12:00:00`);
    if (start !== null) return new Date(start + index * 60 * 1000).toISOString();
  }
  return '';
}

export function datasetPlayerIdForMember(dataset, member) {
  if (!dataset || !member) return '';
  const externalId = String(member.playerExternalId || '').trim();
  const directId = String(member.playerId || '').trim();
  const player = (dataset.players || []).find((candidate) => (
    (externalId && String(candidate.externalId || '') === externalId)
    || (directId && candidate.id === directId)
  ));
  return player?.id || '';
}

export function rosterTeamIdsForMember(dataset, member) {
  const playerId = datasetPlayerIdForMember(dataset, member);
  if (!playerId) return new Set();
  return new Set((dataset.memberships || [])
    .filter((membership) => membership.playerId === playerId && membership.active)
    .map((membership) => membership.seasonTeamId));
}

export function memberScopedLeagueGames({ dataset, games = [], member }) {
  if (!dataset || !Array.isArray(games)) return [];
  if (member?.role === 'admin') return games;

  const playerId = datasetPlayerIdForMember(dataset, member);
  if (!playerId) return games;

  const teamIds = rosterTeamIdsForMember(dataset, member);
  return games.filter((game) => teamIds.has(game.seasonTeamId));
}

export function memberScheduleLabels(dataset, member) {
  const teamIds = rosterTeamIdsForMember(dataset, member);
  return [...new Set((dataset?.teams || [])
    .filter((team) => teamIds.has(team.id))
    .map(formatLeagueScheduleName))];
}

export function attendanceGrantMatches(grant, fixture) {
  if (!grant || !fixture) return false;
  if (grant.scopeType === 'fixture') return grant.scopeId === fixture.id;
  return grant.scopeType === 'tournament'
    && Boolean(fixture.tournamentId)
    && grant.scopeId === fixture.tournamentId;
}

function memberGrants(grants, memberId) {
  return (grants || []).filter((grant) => grant.userId === memberId);
}

export function memberIsAttendanceParticipant({ dataset, fixture, grants, member }) {
  if (!member?.id || !fixture) return false;
  if (memberGrants(grants, member.id).some((grant) => attendanceGrantMatches(grant, fixture))) {
    return true;
  }
  return Boolean(
    fixture.seasonTeamId
    && rosterTeamIdsForMember(dataset, member).has(fixture.seasonTeamId)
  );
}

export function memberCanViewAttendance({ dataset, fixture, grants, member }) {
  return member?.role === 'admin'
    || memberIsAttendanceParticipant({ dataset, fixture, grants, member });
}

function leagueFixture(game, dataset) {
  return {
    ...game,
    kind: 'league',
    schedule: (dataset.teams || []).find((team) => team.id === game.seasonTeamId) || null,
    tournamentId: '',
    tournamentName: '',
  };
}

function tournamentFixtures(tournament) {
  if (!OPEN_TOURNAMENT_STATUSES.has(String(tournament?.status || '').toLowerCase())) return [];
  return (tournament.games || [])
    .filter((game) => !CLOSED_GAME_STATUSES.has(String(game.status || '').toLowerCase()))
    .map((game, index) => ({
      ...game,
      id: String(game.id || `${tournament.id}-game-${index + 1}`),
      kind: 'tournament',
      opponent: game.opponent || 'Opponent TBD',
      scheduledAt: tournamentGameTime(tournament, game, index),
      seasonTeamId: '',
      tournamentId: tournament.id,
      tournamentName: tournament.shortName || tournament.name,
      schedule: {
        id: tournament.id,
        name: tournament.name,
        scheduleLabel: 'Tournament',
      },
      sortTime: timestamp(tournamentGameTime(tournament, game, index)) ?? Number.MAX_SAFE_INTEGER,
      stageLabel: game.stageLabel || game.stage || 'Tournament game',
    }));
}

export function buildAttendanceFixtures({
  dataset,
  tournaments = [],
  grants = [],
  member,
  now = Date.now(),
}) {
  if (!dataset || !member?.id) return [];
  const league = (dataset.games || [])
    .filter((game) => isUpcomingGame(game, now))
    .map((game) => leagueFixture(game, dataset))
    .filter((fixture) => memberCanViewAttendance({ dataset, fixture, grants, member }))
    .sort((left, right) => timestamp(left.scheduledAt) - timestamp(right.scheduledAt))
    .slice(0, 2);
  const tournament = tournaments
    .flatMap(tournamentFixtures)
    .filter((fixture) => {
      const scheduled = timestamp(fixture.scheduledAt);
      return (scheduled === null || scheduled > timestamp(now))
        && memberCanViewAttendance({ dataset, fixture, grants, member });
    })
    .sort((left, right) => left.sortTime - right.sortTime);

  return [...league, ...tournament].sort((left, right) => {
    const leftTime = timestamp(left.scheduledAt) ?? Number.MAX_SAFE_INTEGER;
    const rightTime = timestamp(right.scheduledAt) ?? Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime || left.id.localeCompare(right.id);
  });
}

export function attendanceParticipants({ dataset, fixture, grants = [], members = [] }) {
  return members
    .filter((member) => memberIsAttendanceParticipant({
      dataset,
      fixture,
      grants,
      member,
    }))
    .map((member) => ({
      ...member,
      attendanceRole: fixture?.seasonTeamId
        && rosterTeamIdsForMember(dataset, member).has(fixture.seasonTeamId)
        ? 'Roster'
        : 'EP',
    }));
}

export function leagueEpDirectory({
  dataset,
  members = [],
  fixture = null,
  excludedPlayerIds = [],
}) {
  if (!dataset) return [];
  const excluded = new Set(excludedPlayerIds.filter(Boolean));
  const linkedIds = new Set(members.map((member) => member.playerId).filter(Boolean));
  const linkedExternalIds = new Set(members.map((member) => member.playerExternalId).filter(Boolean));
  const teamsById = new Map((dataset.teams || []).map((team) => [team.id, team]));
  const seasonsById = new Map((dataset.seasons || []).map((season) => [season.id, season]));
  const membershipsByPlayer = new Map();
  (dataset.memberships || []).forEach((membership) => {
    const entries = membershipsByPlayer.get(membership.playerId) || [];
    entries.push(membership);
    membershipsByPlayer.set(membership.playerId, entries);
  });

  return (dataset.players || [])
    .filter((player) => !excluded.has(player.id))
    .filter((player) => !linkedIds.has(player.id))
    .filter((player) => !player.externalId || !linkedExternalIds.has(player.externalId))
    .map((player) => {
      const memberships = [...(membershipsByPlayer.get(player.id) || [])]
        .sort((left, right) => {
          const leftTeam = teamsById.get(left.seasonTeamId);
          const rightTeam = teamsById.get(right.seasonTeamId);
          const leftSeason = seasonsById.get(leftTeam?.seasonId);
          const rightSeason = seasonsById.get(rightTeam?.seasonId);
          if (Boolean(leftSeason?.current) !== Boolean(rightSeason?.current)) return leftSeason?.current ? -1 : 1;
          if (Boolean(left.active) !== Boolean(right.active)) return left.active ? -1 : 1;
          return String(rightSeason?.name || '').localeCompare(String(leftSeason?.name || ''));
        });
      const latestMembership = memberships[0] || null;
      const latestTeam = teamsById.get(latestMembership?.seasonTeamId) || null;
      const latestSeason = seasonsById.get(latestTeam?.seasonId) || null;
      const rosterLabel = [latestSeason?.name, latestTeam ? formatLeagueScheduleName(latestTeam) : '']
        .filter(Boolean)
        .join(' · ');
      return {
        id: player.id,
        externalId: player.externalId || '',
        displayName: player.displayName,
        jerseyNumber: player.jerseyNumber || latestMembership?.jerseyNumber || '',
        position: player.primaryPosition || latestMembership?.position || '',
        sourceUrl: player.sourceUrl || '',
        rosterLabel: rosterLabel || 'League player record',
        fixtureRostered: Boolean(fixture?.seasonTeamId && memberships.some(
          (membership) => membership.seasonTeamId === fixture.seasonTeamId && membership.active !== false,
        )),
      };
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export function attendanceAccessLabel(fixture) {
  if (fixture?.kind === 'tournament') {
    return `${fixture.tournamentName || 'Tournament'} - all games`;
  }
  return `vs ${fixture?.opponent || 'opponent'} - this game only`;
}
