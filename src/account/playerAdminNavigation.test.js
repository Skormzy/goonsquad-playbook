import { describe, expect, it } from 'vitest';
import { OFFICIAL_STATS_DATASET } from '../stats/statsSeed';
import { publicPlayerProfileSnapshot } from '../profile/profileModel';
import { playerAdminProfileUrl, resolvePlayerAdminProfileId } from './playerAdminNavigation';

describe('player administration profile navigation', () => {
  it.each([
    ['25970', 'ycbhl-player-25970'],
    ['gtbhl:84064', 'gtbhl-player-84064'],
  ])('resolves imported cloud record %s to a real public archive profile', (externalId, expectedId) => {
    const playerId = resolvePlayerAdminProfileId({ id: 'cloud-player-uuid', externalId }, OFFICIAL_STATS_DATASET);
    expect(playerId).toBe(expectedId);
    expect(publicPlayerProfileSnapshot(OFFICIAL_STATS_DATASET, playerId)).not.toBeNull();
  });

  it('retains cloud UUIDs when the active public dataset uses cloud records', () => {
    const player = { id: '8f797470-272b-45f0-9648-e069f906dc84', externalId: '25970' };
    const dataset = { players: [player] };
    expect(resolvePlayerAdminProfileId(player, dataset)).toBe(player.id);
    expect(resolvePlayerAdminProfileId({ id: 'ycbhl-player-25970', externalId: '25970' }, dataset)).toBe(player.id);
  });

  it('opens a team-created UUID record without an external source identifier', () => {
    const player = { id: '8f797470-272b-45f0-9648-e069f906dc84', externalId: null };
    expect(resolvePlayerAdminProfileId(player, { players: [player] })).toBe(player.id);
  });

  it('keeps names and unverified source-ID patterns from producing broken or wrong profile links', () => {
    const dataset = { players: [{ id: 'published-player', displayName: 'Same Name', externalId: '17' }] };
    expect(resolvePlayerAdminProfileId({ id: 'private-player', displayName: 'Same Name' }, dataset)).toBeNull();
    expect(resolvePlayerAdminProfileId({ id: 'private-player', externalId: 'ycbhl:player:17' }, dataset)).toBeNull();
    expect(resolvePlayerAdminProfileId(null, dataset)).toBeNull();
    expect(resolvePlayerAdminProfileId({ id: 'private-player' }, null)).toBeNull();
  });

  it('does not guess between ambiguous external IDs', () => {
    const dataset = { players: [{ id: 'one', externalId: '17' }, { id: 'two', externalId: '17' }] };
    expect(resolvePlayerAdminProfileId({ id: 'unmatched', externalId: '17' }, dataset)).toBeNull();
    expect(resolvePlayerAdminProfileId({ id: 'two', externalId: '17' }, dataset)).toBe('two');
  });

  it('builds the individual statistics route and removes stale admin or competition state', () => {
    const original = new URL('https://goonsquad.app/?content=account&mode=3d&panel=players&auth=signin&game=old&opponent=old&fixture=old&competition=tournaments&tournament=old&tournamentGame=old&season=old&team=old&stage=playoffs#section');
    const url = playerAdminProfileUrl(original, { id: 'cloud-player-uuid', externalId: '25970' }, OFFICIAL_STATS_DATASET);
    expect(Object.fromEntries(url.searchParams)).toEqual({ content: 'stats', mode: '2d', player: 'ycbhl-player-25970' });
    expect(url.hash).toBe('#section');
    expect(original.searchParams.get('panel')).toBe('players');
    expect(playerAdminProfileUrl(original, { id: 'unpublished' }, OFFICIAL_STATS_DATASET)).toBeNull();
  });
});
