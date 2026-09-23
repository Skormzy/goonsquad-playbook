import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import handler, { normalizeManagedPlayerNumber } from '../api/account-admin.js';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

const playerId = '12345678-1234-1234-1234-123456789012';
const otherPlayerId = '12345678-1234-1234-1234-123456789013';

function databaseClient(role = 'admin', { mutationError = null } = {}) {
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
