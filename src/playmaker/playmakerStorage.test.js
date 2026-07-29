import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createPlaymakerDraft } from './playmakerModel';
import {
  deletePlaymakerDraft,
  inspectGuestPlaymakerMigration,
  isPlaymakerDraftOwnedBy,
  loadActivePlaymakerDraft,
  loadPlaymakerDrafts,
  migrateGuestPlaymakerDraftsToAccount,
  savePlaymakerDraft,
  setPlaymakerStorageOwner,
} from './playmakerStorage';

const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let values;

beforeEach(() => {
  values = new Map();
  setPlaymakerStorageOwner(null);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
      key: (index) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
    },
  });
});

afterAll(() => {
  if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
  else delete globalThis.localStorage;
});

describe('playmaker local library', () => {
  it('saves, restores, activates, and deletes complete drafts', () => {
    const first = createPlaymakerDraft('breakout');
    first.title = 'First play';
    const second = createPlaymakerDraft('offensive-zone');
    second.title = 'Second play';

    savePlaymakerDraft(first);
    savePlaymakerDraft(second);

    expect(loadPlaymakerDrafts()).toHaveLength(2);
    expect(loadActivePlaymakerDraft()?.id).toBe(second.id);
    deletePlaymakerDraft(second.id);
    expect(loadPlaymakerDrafts().map((draft) => draft.id)).toEqual([first.id]);
  });

  it('keeps guest and account libraries isolated on the same browser', () => {
    const guest = createPlaymakerDraft('breakout');
    guest.title = 'Guest play';
    savePlaymakerDraft(guest);

    setPlaymakerStorageOwner('account-a');
    const accountA = createPlaymakerDraft('offensive-zone');
    accountA.title = 'Account A play';
    savePlaymakerDraft(accountA);

    setPlaymakerStorageOwner('account-b');
    const accountB = createPlaymakerDraft('defensive-zone');
    accountB.title = 'Account B play';
    savePlaymakerDraft(accountB);

    expect(loadPlaymakerDrafts().map((draft) => draft.title)).toEqual(['Account B play']);
    expect(loadPlaymakerDrafts('account-a').map((draft) => draft.title)).toEqual(['Account A play']);
    expect(loadPlaymakerDrafts(null).map((draft) => draft.title)).toEqual(['Guest play']);
  });

  it('migrates legacy global drafts into the guest library only', () => {
    const legacy = createPlaymakerDraft('breakout');
    values.set('gs_playmaker_drafts_v1', JSON.stringify([legacy]));
    values.set('gs_playmaker_active_v1', legacy.id);

    setPlaymakerStorageOwner('account-a');
    expect(loadPlaymakerDrafts()).toEqual([]);
    expect(values.has('gs_playmaker_drafts_v1')).toBe(true);

    setPlaymakerStorageOwner(null);
    expect(loadActivePlaymakerDraft()?.id).toBe(legacy.id);
    expect(values.has('gs_playmaker_drafts_v1')).toBe(false);
    expect(loadPlaymakerDrafts('account-a')).toEqual([]);
  });

  it('moves guest drafts once through an explicit account claim', () => {
    const guest = createPlaymakerDraft('breakout');
    savePlaymakerDraft(guest);

    expect(inspectGuestPlaymakerMigration('account-a')).toEqual({
      alreadyClaimed: false,
      draftCount: 1,
    });

    const result = migrateGuestPlaymakerDraftsToAccount('account-a');
    expect(result).toMatchObject({ importedCount: 1, status: 'claimed' });
    expect(result.activeDraft?.id).toBe(guest.id);
    expect(loadPlaymakerDrafts(null)).toEqual([]);
    expect(loadPlaymakerDrafts('account-a').map((draft) => draft.id)).toEqual([guest.id]);
    expect(isPlaymakerDraftOwnedBy(guest.id, 'account-a')).toBe(true);
    expect(inspectGuestPlaymakerMigration('account-a')).toEqual({
      alreadyClaimed: true,
      draftCount: 0,
    });

    expect(migrateGuestPlaymakerDraftsToAccount('account-a')).toMatchObject({
      importedCount: 0,
      status: 'already-claimed',
    });
  });

  it('refuses to persist an owned draft into another account scope', () => {
    setPlaymakerStorageOwner('account-a');
    const draft = savePlaymakerDraft(createPlaymakerDraft('breakout'));
    const originalTitle = loadActivePlaymakerDraft()?.title;

    setPlaymakerStorageOwner('account-b');
    savePlaymakerDraft({ ...draft, title: 'Wrong account edit' });

    expect(loadPlaymakerDrafts()).toEqual([]);
    expect(loadActivePlaymakerDraft('account-a')?.title).toBe(originalTitle);
    expect(isPlaymakerDraftOwnedBy(draft.id, 'account-b')).toBe(false);
  });

  it('detects the active Supabase owner without exposing another namespace', () => {
    setPlaymakerStorageOwner(undefined);
    values.set('sb-efupudunfkdykvqystdc-auth-token', JSON.stringify({
      user: { id: 'session-account' },
    }));
    const draft = savePlaymakerDraft(createPlaymakerDraft('breakout'));

    expect(isPlaymakerDraftOwnedBy(draft.id, 'session-account')).toBe(true);
    expect(loadPlaymakerDrafts(null)).toEqual([]);
  });
});
