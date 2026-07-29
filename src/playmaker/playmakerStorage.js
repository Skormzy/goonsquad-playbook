import { normalizePlaymakerDraft } from './playmakerModel';

export const PLAYMAKER_STORAGE_KEY = 'gs_playmaker_drafts_v1';
export const PLAYMAKER_ACTIVE_KEY = 'gs_playmaker_active_v1';
export const PLAYMAKER_GUEST_SCOPE = 'guest';

const PLAYMAKER_SCOPED_STORAGE_KEY = 'gs_playmaker_drafts_v2';
const PLAYMAKER_SCOPED_ACTIVE_KEY = 'gs_playmaker_active_v2';
const PLAYMAKER_OWNER_INDEX_KEY = 'gs_playmaker_draft_owners_v1';
const PLAYMAKER_LEGACY_MIGRATION_KEY = 'gs_playmaker_legacy_guest_migration_v1';
const PLAYMAKER_GUEST_CLAIM_KEY = 'gs_playmaker_guest_claim_v1';
const MAX_DRAFTS = 80;

let activeOwnerOverride;

function storageOrNull() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function normalizedOwnerId(ownerId) {
  const value = String(ownerId || '').trim();
  return value || null;
}

function scopeForOwner(ownerId) {
  const normalized = normalizedOwnerId(ownerId);
  return normalized ? `user:${normalized}` : PLAYMAKER_GUEST_SCOPE;
}

function scopedKey(baseKey, scope) {
  return `${baseKey}:${encodeURIComponent(scope)}`;
}

function parseJson(storage, key, fallback) {
  try {
    const parsed = JSON.parse(storage.getItem(key) || '');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function supabaseSessionOwnerId(storage) {
  if (!storage) return null;

  const candidateKeys = [];
  if (typeof storage.length === 'number' && typeof storage.key === 'function') {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (/^sb-.+-auth-token$/u.test(key || '')) candidateKeys.push(key);
    }
  }

  candidateKeys.push('sb-efupudunfkdykvqystdc-auth-token');
  for (const key of [...new Set(candidateKeys)]) {
    const session = parseJson(storage, key, null);
    const ownerId = session?.user?.id
      || session?.currentSession?.user?.id
      || session?.session?.user?.id;
    if (ownerId) return normalizedOwnerId(ownerId);
  }
  return null;
}

export function currentPlaymakerStorageOwnerId() {
  if (activeOwnerOverride !== undefined) return activeOwnerOverride;
  return supabaseSessionOwnerId(storageOrNull());
}

export function setPlaymakerStorageOwner(ownerId) {
  const previousOwnerId = currentPlaymakerStorageOwnerId();
  activeOwnerOverride = ownerId === undefined ? undefined : normalizedOwnerId(ownerId);
  return {
    changed: previousOwnerId !== activeOwnerOverride,
    ownerId: activeOwnerOverride,
    previousOwnerId,
  };
}

function draftsKey(scope) {
  return scopedKey(PLAYMAKER_SCOPED_STORAGE_KEY, scope);
}

function activeKey(scope) {
  return scopedKey(PLAYMAKER_SCOPED_ACTIVE_KEY, scope);
}

function guestClaimKey(ownerId) {
  return scopedKey(PLAYMAKER_GUEST_CLAIM_KEY, scopeForOwner(ownerId));
}

function normalizeDraftList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizePlaymakerDraft)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_DRAFTS);
}

function loadOwnerIndex(storage) {
  const parsed = parseJson(storage, PLAYMAKER_OWNER_INDEX_KEY, {});
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function saveOwnerIndex(storage, value) {
  storage.setItem(PLAYMAKER_OWNER_INDEX_KEY, JSON.stringify(value));
}

function indexDraftsForScope(storage, drafts, scope) {
  const index = loadOwnerIndex(storage);
  let changed = false;
  drafts.forEach((draft) => {
    if (!index[draft.id]) {
      index[draft.id] = scope;
      changed = true;
    }
  });
  if (changed) saveOwnerIndex(storage, index);
}

function migrateLegacyDraftsToGuest(storage) {
  if (storage.getItem(PLAYMAKER_LEGACY_MIGRATION_KEY)) return;

  const legacyDrafts = normalizeDraftList(parseJson(storage, PLAYMAKER_STORAGE_KEY, []));
  const existingGuestDrafts = normalizeDraftList(parseJson(
    storage,
    draftsKey(PLAYMAKER_GUEST_SCOPE),
    [],
  ));
  const existingIds = new Set(existingGuestDrafts.map((draft) => draft.id));
  const merged = normalizeDraftList([
    ...existingGuestDrafts,
    ...legacyDrafts.filter((draft) => !existingIds.has(draft.id)),
  ]);

  storage.setItem(draftsKey(PLAYMAKER_GUEST_SCOPE), JSON.stringify(merged));
  const existingActiveId = storage.getItem(activeKey(PLAYMAKER_GUEST_SCOPE));
  const legacyActiveId = storage.getItem(PLAYMAKER_ACTIVE_KEY);
  const activeId = existingActiveId
    || (merged.some((draft) => draft.id === legacyActiveId) ? legacyActiveId : null);
  if (activeId) storage.setItem(activeKey(PLAYMAKER_GUEST_SCOPE), activeId);

  indexDraftsForScope(storage, merged, PLAYMAKER_GUEST_SCOPE);
  storage.removeItem(PLAYMAKER_STORAGE_KEY);
  storage.removeItem(PLAYMAKER_ACTIVE_KEY);
  storage.setItem(PLAYMAKER_LEGACY_MIGRATION_KEY, 'complete');
}

function loadDraftsForScope(storage, scope) {
  if (scope === PLAYMAKER_GUEST_SCOPE) migrateLegacyDraftsToGuest(storage);
  const drafts = normalizeDraftList(parseJson(storage, draftsKey(scope), []));
  indexDraftsForScope(storage, drafts, scope);
  return drafts;
}

function resolvedOwnerId(ownerId) {
  return ownerId === undefined ? currentPlaymakerStorageOwnerId() : normalizedOwnerId(ownerId);
}

export function loadPlaymakerDrafts(ownerId = undefined) {
  const storage = storageOrNull();
  if (!storage) return [];
  return loadDraftsForScope(storage, scopeForOwner(resolvedOwnerId(ownerId)));
}

export function savePlaymakerDraft(value, ownerId = undefined) {
  const storage = storageOrNull();
  const draft = normalizePlaymakerDraft({ ...value, updatedAt: new Date().toISOString() });
  if (!storage) return draft;

  const requestedScope = scopeForOwner(resolvedOwnerId(ownerId));
  const drafts = loadDraftsForScope(storage, requestedScope)
    .filter((item) => item.id !== draft.id);
  const ownerIndex = loadOwnerIndex(storage);
  const existingScope = ownerIndex[draft.id];
  if (existingScope && existingScope !== requestedScope) return draft;

  storage.setItem(
    draftsKey(requestedScope),
    JSON.stringify([draft, ...drafts].slice(0, MAX_DRAFTS)),
  );
  storage.setItem(activeKey(requestedScope), draft.id);
  ownerIndex[draft.id] = requestedScope;
  saveOwnerIndex(storage, ownerIndex);
  return draft;
}

export function deletePlaymakerDraft(draftId, ownerId = undefined) {
  const storage = storageOrNull();
  if (!storage) return;

  const scope = scopeForOwner(resolvedOwnerId(ownerId));
  const drafts = loadDraftsForScope(storage, scope)
    .filter((draft) => draft.id !== draftId);
  storage.setItem(draftsKey(scope), JSON.stringify(drafts));
  if (storage.getItem(activeKey(scope)) === draftId) storage.removeItem(activeKey(scope));

  const ownerIndex = loadOwnerIndex(storage);
  if (ownerIndex[draftId] === scope) {
    delete ownerIndex[draftId];
    saveOwnerIndex(storage, ownerIndex);
  }
}

export function loadActivePlaymakerDraft(ownerId = undefined) {
  const storage = storageOrNull();
  const resolvedOwner = resolvedOwnerId(ownerId);
  const drafts = loadPlaymakerDrafts(resolvedOwner);
  if (!storage) return drafts[0] ?? null;
  const activeId = storage.getItem(activeKey(scopeForOwner(resolvedOwner)));
  return drafts.find((draft) => draft.id === activeId) ?? drafts[0] ?? null;
}

export function isPlaymakerDraftOwnedBy(draftId, ownerId) {
  const storage = storageOrNull();
  const normalizedOwner = normalizedOwnerId(ownerId);
  if (!storage || !draftId || !normalizedOwner) return false;
  const scope = scopeForOwner(normalizedOwner);
  return loadDraftsForScope(storage, scope).some((draft) => draft.id === draftId);
}

export function inspectGuestPlaymakerMigration(ownerId) {
  const storage = storageOrNull();
  const normalizedOwner = normalizedOwnerId(ownerId);
  if (!storage || !normalizedOwner) {
    return { alreadyClaimed: false, draftCount: 0 };
  }
  const guestDrafts = loadDraftsForScope(storage, PLAYMAKER_GUEST_SCOPE);
  return {
    alreadyClaimed: Boolean(storage.getItem(guestClaimKey(normalizedOwner))),
    draftCount: guestDrafts.length,
  };
}

export function migrateGuestPlaymakerDraftsToAccount(ownerId) {
  const storage = storageOrNull();
  const normalizedOwner = normalizedOwnerId(ownerId);
  if (!storage || !normalizedOwner) {
    throw new Error('Sign in before moving guest drafts.');
  }

  const markerKey = guestClaimKey(normalizedOwner);
  if (storage.getItem(markerKey)) {
    return { activeDraft: loadActivePlaymakerDraft(normalizedOwner), importedCount: 0, status: 'already-claimed' };
  }

  const accountScope = scopeForOwner(normalizedOwner);
  const guestDrafts = loadDraftsForScope(storage, PLAYMAKER_GUEST_SCOPE);
  const accountDrafts = loadDraftsForScope(storage, accountScope);
  const accountIds = new Set(accountDrafts.map((draft) => draft.id));
  const importedDrafts = guestDrafts.filter((draft) => !accountIds.has(draft.id));
  const merged = normalizeDraftList([...accountDrafts, ...importedDrafts]);
  const guestActiveId = storage.getItem(activeKey(PLAYMAKER_GUEST_SCOPE));
  const accountActiveId = storage.getItem(activeKey(accountScope));
  const nextActiveId = accountActiveId
    || (merged.some((draft) => draft.id === guestActiveId) ? guestActiveId : merged[0]?.id);

  storage.setItem(draftsKey(accountScope), JSON.stringify(merged));
  if (nextActiveId) storage.setItem(activeKey(accountScope), nextActiveId);
  storage.setItem(draftsKey(PLAYMAKER_GUEST_SCOPE), '[]');
  storage.removeItem(activeKey(PLAYMAKER_GUEST_SCOPE));

  const ownerIndex = loadOwnerIndex(storage);
  guestDrafts.forEach((draft) => {
    ownerIndex[draft.id] = accountScope;
  });
  saveOwnerIndex(storage, ownerIndex);
  storage.setItem(markerKey, new Date().toISOString());

  return {
    activeDraft: merged.find((draft) => draft.id === nextActiveId) ?? merged[0] ?? null,
    importedCount: importedDrafts.length,
    status: 'claimed',
  };
}
