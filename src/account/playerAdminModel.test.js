import { describe, expect, it } from 'vitest';
import { buildPlayerAdminRows, PLAYER_ADMIN_COLUMNS, playerAdminCsv, selectPlayerAdminRows } from './playerAdminModel';

const snapshot = {
  players: [
    { id: 'one', displayName: 'Émile Jones', jerseyNumber: '12', position: 'C', active: true, externalId: 'source-123', roster: [{ season: 'Fall 2026', schedule: 'Sunday', jerseyNumber: '19' }] },
    { id: 'two', displayName: 'Alex Smith', jerseyNumber: '2', position: 'G', active: false },
    { id: 'three', displayName: 'Casey Brown', jerseyNumber: 0, position: 'D', active: true },
    { id: 'four', displayName: 'Drew Hall', jerseyNumber: null, position: 'W', active: true },
    { id: 'five', displayName: 'Robin Reid', jerseyNumber: '12', position: 'C', active: true },
  ],
  accounts: [{ id: 'user', displayName: 'Em Jones', username: 'ejones', email: 'em@example.test', role: 'admin', emailConfirmed: true }],
  claims: [
    { playerId: 'one', userId: 'user', status: 'approved' },
    { playerId: 'four', userId: 'pending', status: 'pending', member: { email: 'drew@example.test' } },
  ],
};
const rows = buildPlayerAdminRows(snapshot);
const ids = (values) => values.map((row) => row.id);

describe('player administration directory', () => {
  it('keeps unlinked players and zero numbers while joining approved account details', () => {
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({ emails: 'em@example.test', linkStatus: 'Linked', seasons: 'Fall 2026', teams: 'Sunday' });
    expect(rows[2].jerseyNumber).toBe('0');
    expect(rows[3]).toMatchObject({ jerseyNumber: '', linkStatus: 'Pending', emails: '' });
  });
  it('searches across accents, multiple columns, source IDs and pending claims', () => {
    expect(ids(selectPlayerAdminRows(rows, { query: 'emile sunday #12' }))).toEqual(['one']);
    expect(ids(selectPlayerAdminRows(rows, { query: 'source-123' }))).toEqual(['one']);
    expect(ids(selectPlayerAdminRows(rows, { query: 'drew@example.test' }))).toEqual(['four']);
  });
  it('sorts numbers numerically with missing numbers last in both directions', () => {
    expect(ids(selectPlayerAdminRows(rows, { sort: { key: 'jerseyNumber', direction: 'asc' } }))).toEqual(['three', 'two', 'one', 'five', 'four']);
    expect(ids(selectPlayerAdminRows(rows, { sort: { key: 'jerseyNumber', direction: 'desc' } }))).toEqual(['one', 'five', 'two', 'three', 'four']);
  });
  it('combines global search with independent exact status and text filters', () => {
    expect(ids(selectPlayerAdminRows(rows, { query: '12', filters: { rosterStatus: 'Active', position: 'C', linkStatus: 'Linked' } }))).toEqual(['one']);
    expect(selectPlayerAdminRows(rows, { filters: { rosterStatus: 'Active' } })).toHaveLength(4);
    expect(ids(selectPlayerAdminRows(rows, { filters: { jerseyNumber: 'unassigned' } }))).toEqual(['four']);
  });
  it('finds missing/shared numbers without treating zero as missing', () => {
    expect(ids(selectPlayerAdminRows(rows, { quickFilter: 'unnumbered' }))).toEqual(['four']);
    expect(ids(selectPlayerAdminRows(rows, { quickFilter: 'shared' }))).toEqual(['one', 'five']);
    expect(ids(selectPlayerAdminRows(rows, { quickFilter: 'shared', query: 'Jones' }))).toEqual(['one']);
  });
  it('does not flag two league records for the same person as a shared number', () => {
    const aliases = buildPlayerAdminRows({ players: [
      { id: 'ycbhl-player-307', displayName: 'Ryan Hunt', jerseyNumber: '12', active: true },
      { id: 'gtbhl-player-84495', displayName: 'Ryan Hunt', jerseyNumber: '12', active: true },
    ] });
    expect(aliases.every((row) => !row.sharedNumber)).toBe(true);
  });
  it.each(PLAYER_ADMIN_COLUMNS)('supports sorting and filtering the $label column', ({ key }) => {
    const value = String(rows[0][key] || '');
    const filtered = selectPlayerAdminRows(rows, { filters: { [key]: value }, sort: { key, direction: 'desc' } });
    expect(filtered.some((row) => row.id === 'one')).toBe(true);
    expect(filtered.length).toBeLessThanOrEqual(rows.length);
  });
  it('exports the selected rows/columns and safely quotes spreadsheet text', () => {
    const csv = playerAdminCsv([{ displayName: '=HYPERLINK("bad")', jerseyNumber: '00' }], PLAYER_ADMIN_COLUMNS.slice(0, 2));
    expect(csv).toBe('"Player","Number"\r\n"\'=HYPERLINK(""bad"")","00"');
  });
});
