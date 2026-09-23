import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import handler, { normalizeManagedPlayerNumber, normalizeManagedPlayerPosition } from '../api/account-admin.js';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

const playerId = '12345678-1234-1234-1234-123456789012';
const otherPlayerId = '12345678-1234-1234-1234-123456789013';

function databaseClient(role = 'admin', { mutationError = null, publicPlayerIds = null, publicProfileError = null } = {}) {
  const user = { id: 'coach', email: 'coach@example.test', user_metadata: {} };
  const tables = {
    profiles: [{ id: user.id, display_name: 'Coach', username: 'coach', role }],
    players: [
      { id: playerId, display_name: 'Player One', jersey_number: '12', active: true },
      { id: otherPlayerId, display_name: 'Player Two', jersey_number: '19', active: true },
    ],
    roster_memberships: [{ player_id: playerId, season_team_id: 'team-1', jersey_number: '12', active: true }],
    season_teams: [{ id: 'team-1', season_id: 'season-1', schedule_label: 'Monday' }],
    seasons: [{ id: 'season-1', name: '2025', is_current: false }],
    member_player_claims: [],
  };
  const writes = [];
  const client = {
    rpc: vi.fn(async () => ({
      data: publicProfileError ? null : (publicPlayerIds ?? tables.players.map((player) => player.id)).map((id) => ({ player_id: id })),
      error: publicProfileError,
    })),
    auth: {
      getUser: vi.fn(async (token) => ({
        data: { user: token === 'admin-session' ? user : null },
        error: null,
      })),
      admin: { listUsers: vi.fn(async () => ({ data: { users: [user] }, error: null })) },
    },
    from: vi.fn((table) => {
      const filters = [];
      let patch = null;
      function result(single) {
        if (patch && mutationError) return { data: null, error: mutationError };
        const rows = (tables[table] || []).filter((row) => filters.every((filter) => filter(row)));
        if (patch) rows.forEach((row) => {
          Object.assign(row, patch);
          writes.push({ table, id: row.id, patch });
        });
        return { data: single ? rows[0] || null : rows, error: null };
      }
      const query = {
        select: () => query,
        update: (values) => { patch = values; return query; },
        eq: (key, value) => { filters.push((row) => row[key] === value); return query; },
        in: (key, values) => { filters.push((row) => values.includes(row[key])); return query; },
        order: () => query,
        limit: () => query,
        single: async () => result(true),
        maybeSingle: async () => result(true),
        then: (resolve, reject) => Promise.resolve(result(false)).then(resolve, reject),
      };
      return query;
    }),
  };
  vi.mocked(createClient).mockReturnValue(client);
  return { client, tables, writes };
}

async function request(body, token = 'admin-session', method = 'POST') {
  const response = {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  await handler({ method, headers: { authorization: token ? `Bearer ${token}` : '' }, body }, response);
  return response;
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-key');
  vi.stubEnv('ACCOUNT_OWNER_EMAIL', 'coach@example.test');
  vi.clearAllMocks();
});

afterEach(() => vi.unstubAllEnvs());

describe('admin directed player merges', () => {
  const fingerprint = 'abc123abc123abc123abc123abc123ab';
  const preview = {
    fingerprint,
    counts: { combined: { players: 2, memberships: 3, fieldAppearances: 7, goalieAppearances: 2, seasonRows: 4, approvedClaims: 1 } },
    fields: {
      jerseyNumber: { source: '12', target: '19', suggested: '19', conflict: true },
      primaryPosition: { source: 'W', target: 'C', suggested: 'C', conflict: true },
    },
    blockers: [],
    canMerge: true,
  };
  const mergeBody = {
    action: 'merge-players', sourcePlayerId: playerId, targetPlayerId: otherPlayerId,
    previewToken: fingerprint, jerseyNumber: '19', position: 'C',
  };

  function mergeClient() {
    const result = databaseClient();
    result.client.rpc.mockImplementation(async (name) => ({
      data: name === 'preview_player_merge' ? preview
        : name === 'merge_players' ? { merged: true }
          : result.tables.players.map((player) => ({ player_id: player.id })),
      error: null,
    }));
    return result;
  }

  it.each(['member', 'stat_manager'])('denies %s preview and merge access', async (role) => {
    const { client, writes } = databaseClient(role);
    for (const action of ['preview-player-merge', 'merge-players']) {
      const response = await request({ ...mergeBody, action });
      expect(response.statusCode).toBe(403);
    }
    expect(client.rpc).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });

  it('requires an authenticated session before previewing or merging', async () => {
    const { client } = mergeClient();
    expect((await request(mergeBody, '')).statusCode).toBe(401);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it.each([
    { sourcePlayerId: 'not-a-player' },
    { targetPlayerId: playerId },
    { sourcePlayerId: null },
  ])('rejects invalid player choices %j', async (change) => {
    const { client } = mergeClient();
    const response = await request({ ...mergeBody, action: 'preview-player-merge', ...change });
    expect(response.statusCode).toBe(400);
    expect(client.rpc).not.toHaveBeenCalledWith('preview_player_merge', expect.anything());
  });

  it('returns the exact source and survivor plus authoritative counts and conflicts', async () => {
    const { client, writes } = mergeClient();
    const response = await request({ ...mergeBody, action: 'preview-player-merge' });
    expect(response.statusCode).toBe(200);
    expect(response.body.preview).toMatchObject({
      source: { id: playerId, displayName: 'Player One', jerseyNumber: '12', position: 'W' },
      target: { id: otherPlayerId, displayName: 'Player Two', jerseyNumber: '19', position: 'C' },
      counts: { playerRecords: 2, gameStats: 7, goalieStats: 2, memberships: 3, accounts: 1, seasonRecords: 4 },
      defaults: { jerseyNumber: '19', position: 'C' },
      conflicts: { jerseyNumber: true, position: true },
      previewToken: fingerprint,
    });
    expect(client.rpc).not.toHaveBeenCalledWith('merge_players', expect.anything());
    expect(writes).toEqual([]);
  });

  it('expands reviewed aliases on the server and ignores browser-supplied identity sets', async () => {
    const { client, tables } = mergeClient();
    Object.assign(tables.players[0], { external_id: '307', source_url: 'https://www.yorkcentralbhl.com/player/307', display_name: 'Ryan Hunt' });
    const aliasId = '12345678-1234-1234-1234-123456789014';
    tables.players.push({ id: aliasId, external_id: 'gtbhl:84495', display_name: 'Ryan Hunt' });
    await request({ ...mergeBody, action: 'preview-player-merge', sourceIds: [otherPlayerId], targetIds: [playerId], targetName: 'Forged name' });
    expect(client.rpc).toHaveBeenCalledWith('preview_player_merge', {
      p_actor_id: 'coach', p_source_ids: [playerId, aliasId], p_target_ids: [otherPlayerId],
      p_target_id: otherPlayerId, p_target_display_name: 'Player Two',
    });
    const sameIdentity = await request({ ...mergeBody, action: 'preview-player-merge', targetPlayerId: aliasId });
    expect(sameIdentity.statusCode).toBe(400);
    expect(sameIdentity.body.error).toContain('already belong to the same player');
  });

  it('reports missing players instead of submitting an empty identity', async () => {
    mergeClient();
    const response = await request({ ...mergeBody, targetPlayerId: '12345678-1234-1234-1234-123456789099' });
    expect(response.statusCode).toBe(404);
  });

  it.each([
    { previewToken: undefined }, { previewToken: 'tampered' },
    { jerseyNumber: undefined }, { jerseyNumber: '1000' },
    { position: undefined }, { position: 'FORWARD' },
  ])('requires a preview and valid explicit field choices %j', async (change) => {
    const { client } = mergeClient();
    expect((await request({ ...mergeBody, ...change })).statusCode).toBe(400);
    expect(client.rpc).not.toHaveBeenCalledWith('merge_players', expect.anything());
  });

  it('submits the chosen survivor and deliberate clears to one atomic RPC', async () => {
    const { client, writes } = mergeClient();
    const response = await request({ ...mergeBody, jerseyNumber: null, position: null });
    expect(response.statusCode).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(client.rpc).toHaveBeenCalledWith('merge_players', {
      p_actor_id: 'coach', p_source_ids: [playerId], p_target_ids: [otherPlayerId],
      p_target_id: otherPlayerId, p_target_display_name: 'Player Two',
      p_preview_fingerprint: fingerprint, p_jersey_number: null, p_primary_position: null,
    });
    expect(writes).toEqual([]);
  });

  it('keeps database blockers visible and propagates stale-preview failures', async () => {
    const { client } = mergeClient();
    const previous = client.rpc.getMockImplementation();
    client.rpc.mockImplementation(async (name, args) => {
      if (name === 'preview_player_merge') return { data: { ...preview, canMerge: false, blockers: [{ code: 'overlapping-games', message: 'Both players appear in the same game.' }] }, error: null };
      if (name === 'merge_players') return { data: null, error: { message: 'Player information changed. Review a fresh preview.' } };
      return previous(name, args);
    });
    const response = await request({ ...mergeBody, action: 'preview-player-merge' });
    expect(response.body.preview.blockers).toEqual(['Both players appear in the same game.']);
    const commit = await request(mergeBody);
    expect(commit.statusCode).toBe(400);
    expect(commit.body.error).toContain('Review a fresh preview');
  });
});

describe('admin player profile visibility', () => {
  it('preserves distinct public visibility for a hidden canonical record and its visible alias', async () => {
    const { client, tables, writes } = databaseClient('admin', { publicPlayerIds: [otherPlayerId] });
    Object.assign(tables.players[0], {
      external_id: '307', display_name: 'Ryan Hunt',
      source_url: 'https://www.yorkcentralbhl.com/player/307',
    });
    Object.assign(tables.players[1], {
      external_id: 'gtbhl:84495', display_name: 'Ryan Hunt',
      source_url: 'https://www.greatertorontobhl.com/player/84495',
    });
    const response = await request({ action: 'list' });
    expect(response.statusCode).toBe(200);
    expect(client.rpc).toHaveBeenCalledWith('list_public_player_avatars');
    expect(response.body.players.map(({ id, publicProfile }) => ({ id, publicProfile }))).toEqual([
      { id: playerId, publicProfile: false },
      { id: otherPlayerId, publicProfile: true },
    ]);
    expect(writes).toEqual([]);
  });

  it('keeps all players in the admin directory when no profiles are public', async () => {
    databaseClient('admin', { publicPlayerIds: [] });
    const response = await request({ action: 'list' });
    expect(response.statusCode).toBe(200);
    expect(response.body.players).toHaveLength(2);
    expect(response.body.players.every((player) => player.publicProfile === false)).toBe(true);
  });

  it('fails the directory request if public visibility cannot be loaded', async () => {
    const { writes } = databaseClient('admin', { publicProfileError: { message: 'Public profile lookup failed.' } });
    const response = await request({ action: 'list' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Public profile lookup failed.' });
    expect(writes).toEqual([]);
  });

  it('fails the directory request instead of interpreting an invalid response as hidden profiles', async () => {
    const { client, writes } = databaseClient();
    client.rpc.mockResolvedValue({ data: null, error: null });
    const response = await request({ action: 'list' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Player profile visibility is temporarily unavailable.' });
    expect(writes).toEqual([]);
  });
});

describe('managed player number validation', () => {
  it.each([
    [' 07 ', '07'], ['000', '000'], [0, '0'], [999, '999'], ['', null], ['  ', null], [null, null],
  ])('normalizes %j to %j', (value, expected) => {
    expect(normalizeManagedPlayerNumber(value)).toBe(expected);
  });

  it.each([undefined, false, [], ['7'], {}, -1, 1.5, '1234', '1e2', '#7', '七'])('rejects %j', (value) => {
    expect(() => normalizeManagedPlayerNumber(value)).toThrow('Use up to three digits');
  });
});

describe('admin player number endpoint', () => {
  it.each(['member', 'stat_manager'])('denies %s access before reading or updating players', async (role) => {
    const { client, writes } = databaseClient(role);
    const response = await request({ action: 'update-player-number', playerId, jerseyNumber: '7' });
    expect(response.statusCode).toBe(403);
    expect(response.body.error).toBe('Admin access is required.');
    expect(client.from).not.toHaveBeenCalledWith('players');
    expect(writes).toEqual([]);
  });

  it.each(['', 'expired-session'])('denies an unauthenticated session %j', async (token) => {
    const { writes } = databaseClient();
    const response = await request({ action: 'update-player-number', playerId, jerseyNumber: '7' }, token);
    expect(response.statusCode).toBe(401);
    expect(writes).toEqual([]);
  });

  it('persists an unlinked player number for a delegated admin and returns the refreshed directory', async () => {
    vi.stubEnv('ACCOUNT_OWNER_EMAIL', 'owner@example.test');
    const { tables, writes } = databaseClient();
    const response = await request({ action: 'update-player-number', playerId, jerseyNumber: ' 007 ' });
    expect(response.statusCode).toBe(200);
    expect(response.body.permissions.isOwner).toBe(false);
    expect(response.body.players.find((player) => player.id === playerId)).toMatchObject({
      jerseyNumber: '007', linked: false,
    });
    expect(writes).toEqual([{
      table: 'players', id: playerId,
      patch: { jersey_number: '007', jersey_number_updated_at: expect.any(String) },
    }]);
    expect(Number.isNaN(Date.parse(writes[0].patch.jersey_number_updated_at))).toBe(false);
    expect(tables.players[1].jersey_number).toBe('19');
    expect(tables.roster_memberships[0].jersey_number).toBe('12');

    const reload = await request({ action: 'list' });
    expect(reload.body.players.find((player) => player.id === playerId).jerseyNumber).toBe('007');
  });

  it('clears the assigned number without falling back to a historical roster number', async () => {
    const { tables } = databaseClient();
    const response = await request({ action: 'update-player-number', playerId, jerseyNumber: '' });
    expect(response.statusCode).toBe(200);
    expect(response.body.players.find((player) => player.id === playerId)).toMatchObject({
      jerseyNumber: null, roster: [{ jerseyNumber: '12' }],
    });
    expect(tables.players[0].jersey_number).toBeNull();
    expect(tables.players[0].jersey_number_updated_at).toEqual(expect.any(String));
  });

  it('returns the same effective number and clear for reviewed source aliases and account links', async () => {
    const { tables } = databaseClient();
    Object.assign(tables.players[0], {
      external_id: '307',
      display_name: 'Ryan Hunt',
      source_url: 'https://www.yorkcentralbhl.com/player/307',
    });
    Object.assign(tables.players[1], {
      external_id: 'gtbhl:84495',
      display_name: 'Ryan Hunt',
      source_url: 'https://www.greatertorontobhl.com/player/84495',
    });
    tables.member_player_claims.push({ user_id: 'coach', player_id: playerId, status: 'approved' });

    const assigned = await request({ action: 'update-player-number', playerId: otherPlayerId, jerseyNumber: '87' });
    expect(assigned.statusCode).toBe(200);
    expect(assigned.body.players.map((player) => player.jerseyNumber)).toEqual(['87', '87']);
    expect(assigned.body.claims[0].player.jerseyNumber).toBe('87');
    expect(tables.players[0].jersey_number).toBe('12');

    const cleared = await request({ action: 'update-player-number', playerId: otherPlayerId, jerseyNumber: null });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.body.players.map((player) => player.jerseyNumber)).toEqual([null, null]);
    expect(cleared.body.claims[0].player.jerseyNumber).toBeNull();
    expect(tables.roster_memberships[0].jersey_number).toBe('12');
  });

  it.each([
    { playerId: 'invalid', jerseyNumber: '7' },
    { playerId, jerseyNumber: '1000' },
    { playerId },
  ])('rejects invalid input without writes: %j', async (payload) => {
    const { writes } = databaseClient();
    const response = await request({ action: 'update-player-number', ...payload });
    expect(response.statusCode).toBe(400);
    expect(writes).toEqual([]);
  });

  it('reports a deleted player instead of returning success', async () => {
    const { tables, writes } = databaseClient();
    tables.players = [];
    const response = await request({ action: 'update-player-number', playerId, jerseyNumber: '7' });
    expect(response.statusCode).toBe(404);
    expect(response.body.error).toBe('That player profile no longer exists.');
    expect(writes).toEqual([]);
  });

  it('surfaces a failed save without reporting success or changing player data', async () => {
    const { tables, writes } = databaseClient('admin', { mutationError: { message: 'Unable to save player number.' } });
    const response = await request({ action: 'update-player-number', playerId, jerseyNumber: '7' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Unable to save player number.' });
    expect(tables.players[0].jersey_number).toBe('12');
    expect(writes).toEqual([]);
  });
});

describe('managed player position validation', () => {
  it.each([
    [' g ', 'G'], ['D', 'D'], ['c', 'C'], ['W', 'W'], ['', null], ['  ', null], [null, null],
  ])('normalizes %j to %j', (value, expected) => {
    expect(normalizeManagedPlayerPosition(value)).toBe(expected);
  });

  it.each([undefined, false, [], ['G'], {}, 0, 'LW', 'RW', 'Goalie', 'D/C'])('rejects %j', (value) => {
    expect(() => normalizeManagedPlayerPosition(value)).toThrow('Choose goalie, defense, center, or wing');
  });
});

describe('admin player position endpoint', () => {
  it('keeps the existing primary position ahead of roster history before an explicit edit', async () => {
    const { tables, writes } = databaseClient();
    tables.players[0].primary_position = 'D';
    tables.roster_memberships[0].position = 'W';

    const response = await request({ action: 'list' });

    expect(response.statusCode).toBe(200);
    expect(response.body.players.find((player) => player.id === playerId)).toMatchObject({
      primaryPosition: 'D', position: 'D', primaryPositionUpdatedAt: null,
      roster: [{ position: 'W' }],
    });
    expect(writes).toEqual([]);
  });

  it.each(['member', 'stat_manager'])('denies %s access before reading or updating players', async (role) => {
    const { client, writes } = databaseClient(role);
    const response = await request({ action: 'update-player-position', playerId, position: 'C' });
    expect(response.statusCode).toBe(403);
    expect(response.body.error).toBe('Admin access is required.');
    expect(client.from).not.toHaveBeenCalledWith('players');
    expect(writes).toEqual([]);
  });

  it.each(['', 'expired-session'])('denies an unauthenticated session %j', async (token) => {
    const { writes } = databaseClient();
    const response = await request({ action: 'update-player-position', playerId, position: 'C' }, token);
    expect(response.statusCode).toBe(401);
    expect(writes).toEqual([]);
  });

  it('persists a position for a delegated admin without changing the number or roster history', async () => {
    vi.stubEnv('ACCOUNT_OWNER_EMAIL', 'owner@example.test');
    const { tables, writes } = databaseClient();
    tables.roster_memberships[0].position = 'D';
    const response = await request({ action: 'update-player-position', playerId, position: ' c ' });
    expect(response.statusCode).toBe(200);
    expect(response.body.permissions.isOwner).toBe(false);
    expect(response.body.players.find((player) => player.id === playerId)).toMatchObject({
      primaryPosition: 'C', position: 'C', primaryPositionUpdatedAt: expect.any(String),
      jerseyNumber: '12', jerseyNumberUpdatedAt: null, roster: [{ position: 'D' }],
    });
    expect(writes).toEqual([{
      table: 'players', id: playerId,
      patch: { primary_position: 'C', primary_position_updated_at: expect.any(String) },
    }]);
    expect(Number.isNaN(Date.parse(writes[0].patch.primary_position_updated_at))).toBe(false);
    expect(tables.players[0].jersey_number).toBe('12');
    expect(tables.players[1].primary_position).toBeUndefined();
    expect(tables.roster_memberships[0].position).toBe('D');

    const reload = await request({ action: 'list' });
    expect(reload.body.players.find((player) => player.id === playerId).position).toBe('C');
  });

  it('uses historical position only until a position is explicitly cleared', async () => {
    const { tables } = databaseClient();
    tables.roster_memberships[0].position = 'D';
    const before = await request({ action: 'list' });
    expect(before.body.players.find((player) => player.id === playerId).position).toBe('D');

    const cleared = await request({ action: 'update-player-position', playerId, position: '' });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.body.players.find((player) => player.id === playerId)).toMatchObject({
      primaryPosition: null, position: null, primaryPositionUpdatedAt: expect.any(String),
      roster: [{ position: 'D' }],
    });
    expect(tables.players[0].primary_position).toBeNull();
    expect(tables.players[0].jersey_number_updated_at).toBeUndefined();
  });

  it('returns the same effective position and clear for reviewed source aliases and account links', async () => {
    const { tables } = databaseClient();
    Object.assign(tables.players[0], {
      external_id: '307',
      display_name: 'Ryan Hunt',
      primary_position: 'D',
      source_url: 'https://www.yorkcentralbhl.com/player/307',
    });
    Object.assign(tables.players[1], {
      external_id: 'gtbhl:84495',
      display_name: 'Ryan Hunt',
      source_url: 'https://www.greatertorontobhl.com/player/84495',
    });
    tables.member_player_claims.push({ user_id: 'coach', player_id: playerId, status: 'approved' });

    const assigned = await request({ action: 'update-player-position', playerId: otherPlayerId, position: 'W' });
    expect(assigned.statusCode).toBe(200);
    expect(assigned.body.players.map((player) => player.position)).toEqual(['W', 'W']);
    expect(assigned.body.claims[0].player.position).toBe('W');
    expect(tables.players[0].primary_position).toBe('D');

    const cleared = await request({ action: 'update-player-position', playerId: otherPlayerId, position: null });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.body.players.map((player) => player.position)).toEqual([null, null]);
    expect(cleared.body.claims[0].player.position).toBeNull();
    expect(tables.players.map((player) => player.jersey_number)).toEqual(['12', '19']);
  });

  it.each([
    { playerId: 'invalid', position: 'G' },
    { playerId, position: 'Left Wing' },
    { playerId, position: ['G'] },
    { playerId },
  ])('rejects invalid input without writes: %j', async (payload) => {
    const { writes } = databaseClient();
    const response = await request({ action: 'update-player-position', ...payload });
    expect(response.statusCode).toBe(400);
    expect(writes).toEqual([]);
  });

  it('reports a deleted player instead of returning success', async () => {
    const { tables, writes } = databaseClient();
    tables.players = [];
    const response = await request({ action: 'update-player-position', playerId, position: 'G' });
    expect(response.statusCode).toBe(404);
    expect(response.body.error).toBe('That player profile no longer exists.');
    expect(writes).toEqual([]);
  });

  it('surfaces a failed save without reporting success or changing player data', async () => {
    const { tables, writes } = databaseClient('admin', { mutationError: { message: 'Unable to save player position.' } });
    const response = await request({ action: 'update-player-position', playerId, position: 'G' });
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: 'Unable to save player position.' });
    expect(tables.players[0].primary_position).toBeUndefined();
    expect(writes).toEqual([]);
  });
});
