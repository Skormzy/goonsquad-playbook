import { describe, expect, it } from 'vitest';
import { createPlaymakerDraft } from './playmakerModel';
import {
  createPlaymakerShareUrl,
  decodePlaymakerDraft,
  encodePlaymakerDraft,
  playmakerDraftFromUrl,
} from './playmakerShare';

function encodeLegacyPayload(draft) {
  const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, draft }));
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

describe('playmaker sharing', () => {
  it('round trips a portable Unicode-safe play payload', () => {
    const draft = createPlaymakerDraft('offensive-zone');
    draft.title = 'Late cut / quick finish';
    draft.description = 'Center carries, winger receives.';
    const encoded = encodePlaymakerDraft(draft);

    expect(decodePlaymakerDraft(encoded)).toMatchObject({
      id: draft.id,
      title: draft.title,
      description: draft.description,
    });
  });

  it('upgrades a version-one shared pass without changing its receiver', () => {
    const draft = createPlaymakerDraft('breakout');
    draft.schemaVersion = 1;
    draft.frames[1].ball.transition = 'pass';
    draft.frames[1].ball.ownerId = 'US_RW';
    delete draft.frames[1].ball.receiverId;

    const decoded = decodePlaymakerDraft(encodeLegacyPayload(draft));

    expect(decoded.schemaVersion).toBe(2);
    expect(decoded.frames[1].ball).toMatchObject({
      ownerId: 'US_RW',
      receiverId: 'US_RW',
    });
  });

  it('creates a self-contained Playmaker URL', () => {
    const draft = createPlaymakerDraft();
    const href = createPlaymakerShareUrl('https://example.com/?content=plays&mode=3d', draft);
    const url = new URL(href);

    expect(url.searchParams.get('content')).toBe('playmaker');
    expect(url.searchParams.get('mode')).toBeNull();
    expect(playmakerDraftFromUrl(href)?.id).toBe(draft.id);
  });
});
