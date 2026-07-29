import { normalizePlaymakerDraft } from './playmakerModel';

export const PLAYMAKER_STORAGE_KEY = 'gs_playmaker_drafts_v1';
export const PLAYMAKER_ACTIVE_KEY = 'gs_playmaker_active_v1';

function storageOrNull() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function loadPlaymakerDrafts() {
  const storage = storageOrNull();
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(PLAYMAKER_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizePlaymakerDraft)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function savePlaymakerDraft(value) {
  const storage = storageOrNull();
  const draft = normalizePlaymakerDraft({ ...value, updatedAt: new Date().toISOString() });
  if (!storage) return draft;
  const drafts = loadPlaymakerDrafts().filter((item) => item.id !== draft.id);
  storage.setItem(PLAYMAKER_STORAGE_KEY, JSON.stringify([draft, ...drafts].slice(0, 80)));
  storage.setItem(PLAYMAKER_ACTIVE_KEY, draft.id);
  return draft;
}

export function deletePlaymakerDraft(draftId) {
  const storage = storageOrNull();
  if (!storage) return;
  const drafts = loadPlaymakerDrafts().filter((draft) => draft.id !== draftId);
  storage.setItem(PLAYMAKER_STORAGE_KEY, JSON.stringify(drafts));
  if (storage.getItem(PLAYMAKER_ACTIVE_KEY) === draftId) storage.removeItem(PLAYMAKER_ACTIVE_KEY);
}

export function loadActivePlaymakerDraft() {
  const storage = storageOrNull();
  const drafts = loadPlaymakerDrafts();
  if (!storage) return drafts[0] ?? null;
  const activeId = storage.getItem(PLAYMAKER_ACTIVE_KEY);
  return drafts.find((draft) => draft.id === activeId) ?? drafts[0] ?? null;
}
