import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createPlaymakerDraft } from './playmakerModel';
import {
  deletePlaymakerDraft,
  loadActivePlaymakerDraft,
  loadPlaymakerDrafts,
  savePlaymakerDraft,
} from './playmakerStorage';

const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let values;

beforeEach(() => {
  values = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
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
});
