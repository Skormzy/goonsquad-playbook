import { describe, expect, it, vi } from 'vitest';
import { importLeaguePlayers } from './import-league-players.mjs';

function database(players, readError = null) {
  const reads = [];
  const cloud = {
    from: vi.fn((table) => {
      expect(table).toBe('players');
      const query = {
        select: (columns) => {
          expect(columns).toBe('external_id,primary_position_updated_at');
          return query;
        },
        eq: (column, value) => {
          expect([column, value]).toEqual(['source', 'league']);
          return query;
        },
        in: async (column, ids) => {
          expect(column).toBe('external_id');
          reads.push(ids);
          return {
            data: players.filter((player) => player.source === 'league' && ids.includes(player.external_id)),
            error: readError,
          };
        },
      };
      return query;
    }),
  };
  const upsert = vi.fn(async (table, rows, conflict) => {
    expect(table).toBe('players');
    expect(conflict).toBe('source,external_id');
    // Match bulk SQL behavior: an omitted value for any supplied batch column
    // becomes null. This catches accidental mixing of protected/imported rows.
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    for (const row of rows) {
      let existing = players.find((player) => player.source === row.source && player.external_id === row.external_id);
      if (!existing) {
        existing = {};
        players.push(existing);
      }
      Object.assign(existing, Object.fromEntries(columns.map((column) => [column, row[column] ?? null])));
    }
  });
  return { cloud, upsert, reads };
}

function importedPlayer(externalId, primaryPosition = 'D') {
  return { externalId, displayName: `Imported ${externalId}`, primaryPosition, active: true, sourceUrl: `https://example.test/${externalId}` };
}

describe('league player import', () => {
  it('preserves assigned and explicitly cleared positions while updating other imported fields', async () => {
    const editedAt = '2026-09-23T12:00:00Z';
    const players = [
      { source: 'league', external_id: 'assigned', primary_position: 'C', primary_position_updated_at: editedAt, jersey_number: '88' },
      { source: 'league', external_id: 'cleared', primary_position: null, primary_position_updated_at: editedAt },
      { source: 'league', external_id: 'historical', primary_position: 'W', primary_position_updated_at: null },
    ];
    const { cloud, upsert } = database(players);
    await importLeaguePlayers(cloud, ['assigned', 'cleared', 'historical', 'new'].map((id) => importedPlayer(id)), upsert);

    expect(players.find((player) => player.external_id === 'assigned')).toMatchObject({
      primary_position: 'C', primary_position_updated_at: editedAt, jersey_number: '88',
      display_name: 'Imported assigned', active: true, source_url: 'https://example.test/assigned',
    });
    expect(players.find((player) => player.external_id === 'cleared')).toMatchObject({
      primary_position: null, primary_position_updated_at: editedAt, display_name: 'Imported cleared',
    });
    expect(players.find((player) => player.external_id === 'historical')).toMatchObject({
      primary_position: 'D', primary_position_updated_at: null,
    });
    expect(players.find((player) => player.external_id === 'new')).toMatchObject({ primary_position: 'D' });
    expect(upsert).toHaveBeenCalledTimes(2);
    const protectedRows = upsert.mock.calls.find(([, rows]) => rows.some((row) => row.external_id === 'assigned'))[1];
    expect(protectedRows.every((row) => !Object.hasOwn(row, 'primary_position'))).toBe(true);
    expect(upsert.mock.calls.flatMap(([, rows]) => rows).every((row) => !Object.hasOwn(row, 'primary_position_updated_at'))).toBe(true);
  });

  it('retains normal source updates for existing unassigned and new players, including an empty position', async () => {
    const players = [{ source: 'league', external_id: 'existing', primary_position: 'G' }];
    const { cloud, upsert } = database(players);
    await importLeaguePlayers(cloud, [importedPlayer('existing', null), importedPlayer('new', 'W')], upsert);
    expect(players.map((player) => player.primary_position)).toEqual([null, 'W']);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('checks every imported identity in bounded queries before making writes', async () => {
    const players = [{ source: 'league', external_id: '100', primary_position: 'C', primary_position_updated_at: '2026-09-23T12:00:00Z' }];
    const { cloud, upsert, reads } = database(players);
    await importLeaguePlayers(cloud, Array.from({ length: 101 }, (_, index) => importedPlayer(String(index))), upsert);
    expect(reads.map((ids) => ids.length)).toEqual([100, 1]);
    expect(players.find((player) => player.external_id === '100').primary_position).toBe('C');
  });

  it('fails closed without player writes when existing edit markers cannot be read', async () => {
    const { cloud, upsert } = database([], { message: 'Database unavailable' });
    await expect(importLeaguePlayers(cloud, [importedPlayer('one')], upsert))
      .rejects.toThrow('Player assignments could not be checked: Database unavailable');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('does no reads or writes when there are no source players', async () => {
    const { cloud, upsert } = database([]);
    await importLeaguePlayers(cloud, [], upsert);
    expect(cloud.from).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
