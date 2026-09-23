import { describe, expect, it } from 'vitest';
import { mergeFieldOptions, mergePreviewCountItems, mergePreviewMessages, playerMergeTargets } from './playerMergeModel';

describe('manual player merge target selection', () => {
  const source = { id: 'wrong-public-id', identityId: 'wrong-identity', displayName: 'Abraham Saodzi', sourcePlayers: [{ id: 'wrong-archive-id' }] };
  const correct = { id: 'correct', displayName: 'Abraham Sadozi', jerseyNumber: 0, position: 'G', teams: 'Goon Squad', seasons: 'Summer 2026', searchExtra: 'Abraham Sadozie', externalId: 'ycbhl:25735' };
  const other = { id: 'other', displayName: 'Andrew Player', jerseyNumber: 22, teams: 'Other Team' };

  it('excludes the selected identity and every overlapping source record', () => {
    const rows = [source, { ...source, id: 'different-edit-id' }, { id: 'alias', sourcePlayers: [{ id: 'wrong-archive-id' }], displayName: 'Archive name' }, { id: 'wrong-public-id', displayName: 'Wrong' }, correct, other];
    expect(playerMergeTargets(rows, source).map((row) => row.id)).toEqual(['correct', 'other']);
  });

  it('suggests a close spelling without excluding unrelated names', () => {
    const rows = playerMergeTargets([other, correct], source);
    expect(rows.map((row) => [row.id, row.suggested])).toEqual([['correct', true], ['other', false]]);
  });

  it.each(['sadozi', '#0 goalie', '2026 goon', '25735', 'Sadozie'])(
    'finds the target by its name, number, source, or history: %s', (query) => {
      const rows = playerMergeTargets([{ ...correct, searchExtra: `${correct.searchExtra} goalie` }, other], source, query);
      expect(rows.map((row) => row.id)).toEqual(['correct']);
    },
  );

  it('keeps separate people with the same display name available for an explicit decision', () => {
    expect(playerMergeTargets([{ ...source, id: 'unrelated', identityId: 'unrelated', sourcePlayers: [] }], source)).toHaveLength(1);
  });

  it('allows keeping either number, zero, or deliberately clearing the field', () => {
    expect(mergeFieldOptions({ jerseyNumber: 9 }, { jerseyNumber: 0 }, 'jerseyNumber')).toEqual(['', '0', '9']);
    expect(mergeFieldOptions({ jerseyNumber: '9' }, { jerseyNumber: 9 }, 'jerseyNumber')).toEqual(['', '9']);
    expect(mergeFieldOptions({ position: 'G' }, { position: null }, 'position')).toEqual(['', 'G']);
  });

  it('only renders authoritative counts, retaining explicit zero and rejecting absent values', () => {
    expect(mergePreviewCountItems({ playerRecords: 4, goalieStats: 0, memberships: undefined, gameStats: '22' })).toEqual([
      { key: 'playerRecords', label: 'Player records', count: 4 },
      { key: 'goalieStats', label: 'Goalie game records', count: 0 },
    ]);
  });

  it('preserves human-readable server blockers and warnings', () => {
    expect(mergePreviewMessages(['Different accounts', { message: 'Same game', code: 'overlap' }, {}])).toEqual(['Different accounts', 'Same game']);
  });
});
