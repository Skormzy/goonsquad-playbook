import { describe, expect, it } from 'vitest';
import greaterTorontoSnapshot from './greaterTorontoSnapshot.json';
import yorkCentralSnapshot from './yorkCentralSnapshot.json';
import { mergeLeagueSnapshots } from './leagueSnapshotMerge';
import {
  formatScheduleName,
  formatSeasonSelectorLabel,
} from './statsModel';

describe('Greater Toronto league archive', () => {
  it('captures the complete linked Goonsquad history with detailed game data', () => {
    expect(greaterTorontoSnapshot.sourceName).toBe('Greater Toronto Ball Hockey League');
    expect(greaterTorontoSnapshot.sourceUrl).toBe('https://www.greatertorontobhl.com/team/3878-goonsquad');
    expect(greaterTorontoSnapshot.seasons).toHaveLength(5);
    expect(greaterTorontoSnapshot.teams).toHaveLength(5);
    expect(greaterTorontoSnapshot.games).toHaveLength(61);
    expect(greaterTorontoSnapshot.games.every((game) => game.status === 'final' && game.verified)).toBe(true);
    expect(greaterTorontoSnapshot.detailImport).toMatchObject({ requestedGames: 61, importedGames: 61, errors: [] });
    expect(greaterTorontoSnapshot.players.length).toBeGreaterThanOrEqual(80);
    expect(greaterTorontoSnapshot.playerGameStats.length).toBeGreaterThanOrEqual(700);
    expect(greaterTorontoSnapshot.gameEvents.length).toBeGreaterThanOrEqual(500);
  });

  it('keeps provider identities and overlapping seasons isolated from York Central', () => {
    const merged = mergeLeagueSnapshots(yorkCentralSnapshot, greaterTorontoSnapshot);
    expect(merged.seasons).toHaveLength(yorkCentralSnapshot.seasons.length + 5);
    expect(merged.teams).toHaveLength(yorkCentralSnapshot.teams.length + 5);
    expect(merged.games).toHaveLength(yorkCentralSnapshot.games.length + 61);
    expect(greaterTorontoSnapshot.seasons.every((season) => season.id.startsWith('gtbhl-'))).toBe(true);
    expect(greaterTorontoSnapshot.games.every((game) => game.id.startsWith('gtbhl-game-') && game.externalId.startsWith('gtbhl:'))).toBe(true);
    expect(greaterTorontoSnapshot.players.every((player) => player.id.startsWith('gtbhl-player-') && player.externalId.startsWith('gtbhl:'))).toBe(true);
  });

  it('uses concise year, season, source league, and day labels', () => {
    const sundaySeason = greaterTorontoSnapshot.seasons.find((season) => season.id === 'gtbhl-summer-2024');
    expect(formatScheduleName(greaterTorontoSnapshot.teams.find((team) => team.seasonId === sundaySeason.id))).toBe('Sunday Tier 5B West League');
    expect(formatSeasonSelectorLabel(sundaySeason, greaterTorontoSnapshot.teams)).toBe('2024 Summer · Greater Toronto Ball Hockey League · Sunday Tier 5B West');

    const currentSeason = yorkCentralSnapshot.seasons.find((season) => season.id === 'summer-2026');
    expect(formatSeasonSelectorLabel(currentSeason, yorkCentralSnapshot.teams)).toBe('2026 Summer · YCBHL · Monday Tier 5 + Sunday Tier 5');
  });
});
