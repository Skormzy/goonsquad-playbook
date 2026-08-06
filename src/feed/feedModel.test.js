import { describe, expect, it } from 'vitest';
import {
  canOpenFeedMemberProfile,
  canPublishFeedPost,
  extractFirstUrl,
  extractMentionUsernames,
  feedGameDetailsHref,
  feedCommentLikeDetails,
  feedMediaContentType,
  feedReactionDetails,
  feedTextParts,
  formatFeedTime,
  normalizeExternalUrl,
  summarizeFeedReactions,
  threadFeedComments,
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
    expect(feedMediaContentType({ name: 'iphone-clip.MOV', type: '' })).toBe('video/quicktime');
    expect(validateFeedMedia({ name: 'iphone-clip.MOV', type: '', size: 100 }).kind).toBe('video');
    expect(validateFeedMedia({ type: 'video/mp4', size: 60 * 1024 * 1024 }).valid).toBe(false);
    expect(validateFeedMedia({ type: 'application/pdf', size: 100 }).valid).toBe(false);
  });

  it('builds an internal game-details link for official result cards', () => {
    expect(feedGameDetailsHref('ycbhl-game-53057')).toBe(
      '/?content=stats&game=ycbhl-game-53057',
    );
    expect(feedGameDetailsHref('')).toBe('');
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

  it('summarizes supported emoji reactions in a stable display order', () => {
    expect(summarizeFeedReactions([
      { userId: 'a', reaction: 'fire' },
      { userId: 'b', reaction: 'like' },
      { userId: 'c', reaction: 'fire' },
      { userId: 'd', reaction: 'unsupported' },
    ])).toEqual([
      { id: 'like', emoji: '👍', label: 'Like', count: 1 },
      { id: 'fire', emoji: '🔥', label: 'Fire', count: 2 },
    ]);
  });

  it('resolves reactors to member identities and linked player profiles', () => {
    const members = [
      { id: 'u1', displayName: 'Ryan Hunt', playerId: 'ycbhl-player-307' },
      { id: 'u2', displayName: 'Coach', playerId: '' },
    ];
    const details = feedReactionDetails([
      { userId: 'u2', reaction: 'fire' },
      { userId: 'u1', reaction: 'like' },
      { userId: 'missing', reaction: 'unsupported' },
    ], members);

    expect(details).toEqual([
      {
        userId: 'u1',
        reaction: 'like',
        emoji: '👍',
        label: 'Like',
        member: members[0],
      },
      {
        userId: 'u2',
        reaction: 'fire',
        emoji: '🔥',
        label: 'Fire',
        member: members[1],
      },
    ]);
    expect(canOpenFeedMemberProfile(members[0])).toBe(true);
    expect(canOpenFeedMemberProfile(members[1])).toBe(false);
  });

  it('groups replies under their parent while keeping malformed replies visible', () => {
    const comments = [
      { id: 'root', body: 'Parent comment', parentCommentId: '' },
      { id: 'reply', body: 'Reply', parentCommentId: 'root' },
      { id: 'nested', body: 'Reply to reply', parentCommentId: 'reply' },
      { id: 'orphan', body: 'Still visible', parentCommentId: 'missing' },
    ];

    expect(threadFeedComments(comments)).toEqual([
      {
        id: 'root',
        body: 'Parent comment',
        parentCommentId: '',
        replies: [{
          id: 'reply',
          body: 'Reply',
          parentCommentId: 'root',
          replies: [],
        }, {
          id: 'nested',
          body: 'Reply to reply',
          parentCommentId: 'reply',
          replies: [],
        }],
      },
      {
        id: 'orphan',
        body: 'Still visible',
        parentCommentId: 'missing',
        replies: [],
      },
    ]);
  });

  it('resolves comment likes to member identities for profile navigation', () => {
    const members = [
      { id: 'u2', displayName: 'Seymour Korman', playerId: 'player-2' },
      { id: 'u1', displayName: 'Ryan Hunt', playerId: 'player-1' },
    ];

    expect(feedCommentLikeDetails([
      { userId: 'u2', createdAt: '2026-08-05T10:00:00Z' },
      { userId: 'u1', createdAt: '2026-08-05T09:00:00Z' },
    ], members)).toEqual([
      {
        userId: 'u1',
        createdAt: '2026-08-05T09:00:00Z',
        member: members[1],
      },
      {
        userId: 'u2',
        createdAt: '2026-08-05T10:00:00Z',
        member: members[0],
      },
    ]);
  });
});
