import { describe, expect, it } from 'vitest';
import {
  createCloudPlaymakerShareUrl,
  normalizeCloudPlaymakerRecord,
} from './playmakerCloud';
import { createPlaymakerDraft } from './playmakerModel';

describe('Playmaker cloud sharing', () => {
  it('creates a focused public link without leaking the current workspace state', () => {
    const url = new URL(createCloudPlaymakerShareUrl(
      'https://team.example.com/?content=plays&mode=3d&time=8.2#review',
      'public-token',
    ));
    expect(url.origin).toBe('https://team.example.com');
    expect(url.searchParams.get('content')).toBe('playmaker');
    expect(url.searchParams.get('cloudPlay')).toBe('public-token');
    expect(url.searchParams.get('time')).toBeNull();
    expect(url.hash).toBe('');
  });

  it('normalizes cloud metadata and preserves the authored receiver contract', () => {
    const draft = createPlaymakerDraft('breakout');
    const record = normalizeCloudPlaymakerRecord({
      id: 'cloud-id',
      title: draft.title,
      description: draft.description,
      visibility: 'public',
      share_slug: 'public-token',
      revision: 4,
      created_at: draft.createdAt,
      updated_at: draft.updatedAt,
      payload: draft,
    });
    expect(record).toMatchObject({ id: 'cloud-id', visibility: 'public', shareSlug: 'public-token', revision: 4 });
    expect(record.draft.frames[1].ball.receiverId).toBe(record.draft.frames[0].ball.ownerId);
  });
});
