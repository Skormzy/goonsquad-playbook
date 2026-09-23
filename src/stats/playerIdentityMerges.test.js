import { describe, expect, it } from 'vitest';
import { buildPlayerAdminRows, selectPlayerAdminRows } from '../account/playerAdminModel';
import { publicPlayerProfileSnapshot } from '../profile/profileModel';
import { buildAllTimeRecords } from './allTimeRecordsModel';
import { buildPlayerIdentityIndex, playerIdsForIdentity } from './playerIdentity';
import { applyPublicPlayerDetails } from './publicPlayerDetails';
import { OFFICIAL_STATS_DATASET } from './statsSeed';

const CANONICAL_ID = 'ycbhl-player-25735';
const MISSPELLED_ID = 'ycbhl-player-25962';
const ABRAHAM_IDS = [CANONICAL_ID, MISSPELLED_ID];
const GOALIE_TOTALS = {
  gamesPlayed: 19,
  wins: 6,
  losses: 11,
  ties: 2,
  shotsAgainst: 410,
  goalsAgainst: 72,
  saves: 338,
  minutesPlayed: 554,
  shutouts: 0,
};

function expectCombinedGoalieStats(goalie) {
  expect(goalie).toMatchObject(GOALIE_TOTALS);
  expect(goalie.savePercentage).toBeCloseTo(338 / 410, 8);
  expect(goalie.goalsAgainstAverage).toBeCloseTo(72 * 30 / 554, 8);
}

describe('reviewed misspelled player identities', () => {
  it('shows Abraham once in admin while keeping both source names searchable', () => {
    const rows = buildPlayerAdminRows({ players: OFFICIAL_STATS_DATASET.players });
    const matches = selectPlayerAdminRows(rows, { query: 'Abraham' });

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      identityId: CANONICAL_ID,
      displayName: 'Abraham Sadozi',
    });
    expect(matches[0].sourcePlayers.map((player) => player.id).sort()).toEqual(ABRAHAM_IDS);
    expect(selectPlayerAdminRows(rows, { query: 'Abraham Saodzi' })).toEqual(matches);
    expect(selectPlayerAdminRows(rows, { query: '25962' })).toContain(matches[0]);
    expect(OFFICIAL_STATS_DATASET.players.find((player) => player.id === MISSPELLED_ID).displayName)
      .toBe('Abraham Saodzi');
  });

  it.each(ABRAHAM_IDS)('combines all goalie and field history through profile route %s', (playerId) => {
    const profile = publicPlayerProfileSnapshot(OFFICIAL_STATS_DATASET, playerId);

    expect(profile.primaryPlayer).toMatchObject({ id: CANONICAL_ID, displayName: 'Abraham Sadozi' });
    expect(profile.players.map((player) => player.id).sort()).toEqual(ABRAHAM_IDS);
    expect(profile.seasonsPlayed).toBe(5);
    expectCombinedGoalieStats(profile.careerGoalie);
    expectCombinedGoalieStats(profile.competitionStats.all.careerGoalie);
    expect(profile.careerField).toMatchObject({ gamesPlayed: 1, goals: 0, assists: 0, points: 0 });
    expect(profile.recentGames.filter((row) => row.goalie?.gamesPlayed > 0)).toHaveLength(19);
    expect(profile.recentGames.find((row) => row.game.id === 'ycbhl-game-52142').goalie)
      .toMatchObject({ gamesPlayed: 1, shotsAgainst: 24, goalsAgainst: 7, saves: 17, minutesPlayed: 30 });
  });

  it('publishes one combined record and recalculates rates from all appearances', () => {
    const records = buildAllTimeRecords(OFFICIAL_STATS_DATASET);

    for (const scope of [records, records.scopes.all]) {
      const goalies = scope.goalies.filter((line) => ABRAHAM_IDS.includes(line.playerId));
      const fieldPlayers = scope.skaters.filter((line) => ABRAHAM_IDS.includes(line.playerId));
      expect(goalies).toHaveLength(1);
      expect(goalies[0]).toMatchObject({ playerId: CANONICAL_ID, displayName: 'Abraham Sadozi' });
      expectCombinedGoalieStats(goalies[0]);
      expect(fieldPlayers).toHaveLength(1);
      expect(fieldPlayers[0]).toMatchObject({ gamesPlayed: 1, goals: 0, assists: 0, points: 0 });
    }
    expect(records.scopes.regular.goalies.find((line) => line.playerId === CANONICAL_ID).gamesPlayed)
      .toBe(17);
    expect(records.scopes.playoffs.goalies.find((line) => line.playerId === CANONICAL_ID).gamesPlayed)
      .toBe(2);
  });

  it.each([
    { jerseyNumber: '00', primaryPosition: 'D' },
    { jerseyNumber: null, primaryPosition: null },
  ])('preserves alias edits and clears across admin, profiles and records: %j', ({ jerseyNumber, primaryPosition }) => {
    const dataset = applyPublicPlayerDetails(OFFICIAL_STATS_DATASET, [
      {
        player_id: CANONICAL_ID,
        jersey_number: '31',
        jersey_number_updated_at: '2026-09-22T12:00:00Z',
        primary_position: 'G',
        primary_position_updated_at: '2026-09-22T12:00:00Z',
      },
      {
        player_id: MISSPELLED_ID,
        jersey_number: jerseyNumber,
        jersey_number_updated_at: '2026-09-23T12:00:00Z',
        primary_position: primaryPosition,
        primary_position_updated_at: '2026-09-23T12:00:00Z',
      },
    ]);
    const adminRows = selectPlayerAdminRows(buildPlayerAdminRows({ players: dataset.players }), { query: 'Abraham Saodzi' });
    expect(adminRows).toHaveLength(1);
    expect(adminRows[0]).toMatchObject({ jerseyNumber: jerseyNumber ?? '', position: primaryPosition });

    for (const playerId of ABRAHAM_IDS) {
      const profile = publicPlayerProfileSnapshot(dataset, playerId);
      expect(profile).toMatchObject({ jerseyNumber, position: primaryPosition });
      expectCombinedGoalieStats(profile.careerGoalie);
    }
    const goalie = buildAllTimeRecords(dataset).goalies.find((line) => line.playerId === CANONICAL_ID);
    expect(goalie).toMatchObject({ jerseyNumber, position: primaryPosition });
    expectCombinedGoalieStats(goalie);
  });

  it('uses the reviewed spelling even when only the historical alias is loaded', () => {
    const dataset = {
      ...OFFICIAL_STATS_DATASET,
      players: OFFICIAL_STATS_DATASET.players.filter((player) => player.id === MISSPELLED_ID),
      memberships: OFFICIAL_STATS_DATASET.memberships.filter((membership) => membership.playerId === MISSPELLED_ID),
      playerSeasonStats: [],
      goalieSeasonStats: OFFICIAL_STATS_DATASET.goalieSeasonStats.filter((line) => line.playerId === MISSPELLED_ID),
    };
    expect(buildPlayerAdminRows({ players: dataset.players })[0].displayName).toBe('Abraham Sadozi');
    const profile = publicPlayerProfileSnapshot(dataset, MISSPELLED_ID);
    expect(profile.primaryPlayer.displayName).toBe('Abraham Sadozi');
    expect(profile.careerGoalie.gamesPlayed).toBe(1);
    expect(buildAllTimeRecords(dataset).goalies[0]).toMatchObject({ displayName: 'Abraham Sadozi', gamesPlayed: 1 });
  });

  it('keeps unreviewed similar names and local namesakes separate', () => {
    const players = [
      ...OFFICIAL_STATS_DATASET.players.filter((player) => ABRAHAM_IDS.includes(player.id)),
      { id: 'ycbhl-player-99999', displayName: 'Abraham Sadozi' },
      { id: 'gtbhl-player-99998', displayName: 'Abraham Sadozzi' },
      { id: 'local-abraham', displayName: 'Abraham Saodzi', externalId: '25962' },
    ];
    const identityIndex = buildPlayerIdentityIndex(players);
    expect(playerIdsForIdentity(identityIndex, CANONICAL_ID).sort()).toEqual(ABRAHAM_IDS);
    for (const player of players.slice(2)) {
      expect(playerIdsForIdentity(identityIndex, player.id)).toEqual([player.id]);
    }
    expect(buildPlayerAdminRows({ players })).toHaveLength(4);
  });
});
