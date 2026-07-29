const LEGACY_FAVORITES_KEY = 'gs_favs';
const FAVORITES_PREFIX = 'gs_favs_v2';
const PENDING_PREFIX = 'gs_favs_pending_v2';

function parseArray(value) {
  try {
    const parsed = JSON.parse(value ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function storageKey(userId) {
  return `${FAVORITES_PREFIX}:${userId ? `user:${userId}` : 'guest'}`;
}

function pendingKey(userId) {
  return `${PENDING_PREFIX}:user:${userId}`;
}

export function migrateLegacyFavorites(storage = globalThis.localStorage) {
  if (!storage) return;
  const legacy = parseArray(storage.getItem(LEGACY_FAVORITES_KEY));
  const guestKey = storageKey(null);
  if (legacy.length > 0 && storage.getItem(guestKey) == null) {
    storage.setItem(guestKey, JSON.stringify(legacy));
  }
  storage.removeItem(LEGACY_FAVORITES_KEY);
}

export function readFavoriteIds(userId, storage = globalThis.localStorage) {
  if (!storage) return [];
  migrateLegacyFavorites(storage);
  return parseArray(storage.getItem(storageKey(userId)));
}

export function writeFavoriteIds(userId, ids, storage = globalThis.localStorage) {
  if (!storage) return;
  storage.setItem(storageKey(userId), JSON.stringify([...new Set(ids)]));
}

export function readPendingFavoriteChanges(userId, storage = globalThis.localStorage) {
  if (!storage || !userId) return {};
  try {
    const parsed = JSON.parse(storage.getItem(pendingKey(userId)) ?? '{}');
    return Object.fromEntries(
      Object.entries(parsed).filter(([id, state]) => (
        typeof id === 'string' && typeof state === 'boolean'
      )),
    );
  } catch {
    return {};
  }
}

export function setPendingFavoriteChange(userId, playId, favorited, storage = globalThis.localStorage) {
  if (!storage || !userId) return;
  const pending = readPendingFavoriteChanges(userId, storage);
  pending[playId] = Boolean(favorited);
  storage.setItem(pendingKey(userId), JSON.stringify(pending));
}

export function clearPendingFavoriteChange(userId, playId, storage = globalThis.localStorage) {
  if (!storage || !userId) return;
  const pending = readPendingFavoriteChanges(userId, storage);
  delete pending[playId];
  if (Object.keys(pending).length === 0) storage.removeItem(pendingKey(userId));
  else storage.setItem(pendingKey(userId), JSON.stringify(pending));
}

export function applyPendingFavoriteChanges(ids, changes) {
  const next = new Set(ids);
  Object.entries(changes).forEach(([playId, favorited]) => {
    if (favorited) next.add(playId);
    else next.delete(playId);
  });
  return [...next];
}
