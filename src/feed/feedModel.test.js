import { describe, expect, it } from 'vitest';
import {
  canPublishFeedPost,
  extractFirstUrl,
  extractMentionUsernames,
  feedTextParts,
  formatFeedTime,
  normalizeExternalUrl,
  validateFeedMedia,
} from './feedModel';

describe('team feed model', () => {
  it('deduplicates normalized member mentions', () => {
    expect(extractMentionUsernames('Nice read @Seymour. @coach and @seymour again')).toEqual([
      'seymour',
      'coach',
    ]);
  });

  it('extracts and normalizes safe web links', () => {
    expect(extractFirstUrl('Watch https://example.com/clip.')).toBe('https://example.com/clip');
    expect(normalizeExternalUrl('goonsquad.app')).toBe('https://goonsquad.app/');
    expect(normalizeExternalUrl('javascript:alert(1)')).toBe('');
  });

  it('accepts supported media and rejects oversized files', () => {
    expect(validateFeedMedia({ type: 'image/jpeg', size: 100 }).kind).toBe('image');
    expect(validateFeedMedia({ type: 'video/mp4', size: 60 * 1024 * 1024 }).valid).toBe(false);
    expect(validateFeedMedia({ type: 'application/pdf', size: 100 }).valid).toBe(false);
  });

  it('requires at least one useful post payload', () => {
    expect(canPublishFeedPost({ body: 'Game tonight' })).toBe(true);
    expect(canPublishFeedPost({ body: '', linkUrl: '', file: null })).toBe(false);
  });

  it('formats recent activity without noisy timestamps', () => {
    const now = new Date('2026-07-30T12:00:00Z');
    expect(formatFeedTime('2026-07-30T11:58:00Z', now)).toBe('2m');
    expect(formatFeedTime('2026-07-29T12:00:00Z', now)).toBe('1d');
  });

  it('links known mentions while preserving surrounding text', () => {
    const parts = feedTextParts('Great pass @seymour!', [{
      id: 'u1',
      username: 'seymour',
      displayName: 'Seymour Korman',
    }]);
    expect(parts).toEqual([
      { type: 'text', value: 'Great pass ' },
      {
        type: 'mention',
        value: '@seymour',
        member: {
          id: 'u1',
          username: 'seymour',
          displayName: 'Seymour Korman',
        },
      },
      { type: 'text', value: '!' },
    ]);
  });
});
