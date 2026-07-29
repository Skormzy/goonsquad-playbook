import { describe, expect, it } from 'vitest';
import {
  applyPendingFavoriteChanges,
  clearPendingFavoriteChange,
  migrateLegacyFavorites,
  readFavoriteIds,
  readPendingFavoriteChanges,
  setPendingFavoriteChange,
  writeFavoriteIds,
} from './favoritesStorage';

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

describe('account-scoped favorite storage', () => {
  it('migrates legacy favorites to the guest without exposing them to accounts', () => {
    const local = storage();
    local.setItem('gs_favs', JSON.stringify(['brk', 'trap']));
    migrateLegacyFavorites(local);

    expect(readFavoriteIds(null, local)).toEqual(['brk', 'trap']);
    expect(readFavoriteIds('user-b', local)).toEqual([]);
    expect(local.getItem('gs_favs')).toBeNull();
  });

  it('keeps different account favorites isolated on a shared device', () => {
    const local = storage();
    writeFavoriteIds('user-a', ['brk'], local);
    writeFavoriteIds('user-b', ['trap'], local);

    expect(readFavoriteIds('user-a', local)).toEqual(['brk']);
    expect(readFavoriteIds('user-b', local)).toEqual(['trap']);
  });

  it('persists failed removals as pending changes until cloud retry succeeds', () => {
    const local = storage();
    setPendingFavoriteChange('user-a', 'brk', false, local);
    setPendingFavoriteChange('user-a', 'trap', true, local);
    const pending = readPendingFavoriteChanges('user-a', local);

    expect(applyPendingFavoriteChanges(['brk'], pending)).toEqual(['trap']);
    clearPendingFavoriteChange('user-a', 'brk', local);
    expect(readPendingFavoriteChanges('user-a', local)).toEqual({ trap: true });
  });
});
