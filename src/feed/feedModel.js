export const FEED_POST_MAX_LENGTH = 3000;
export const FEED_COMMENT_MAX_LENGTH = 1000;
export const FEED_MEDIA_MAX_BYTES = 50 * 1024 * 1024;

export const FEED_REACTIONS = Object.freeze([
  { id: 'like', emoji: '👍', label: 'Like' },
  { id: 'heart', emoji: '❤️', label: 'Love it' },
  { id: 'fire', emoji: '🔥', label: 'Fire' },
  { id: 'celebrate', emoji: '🙌', label: 'Celebrate' },
  { id: 'laugh', emoji: '😂', label: 'Laugh' },
  { id: 'wow', emoji: '😮', label: 'Wow' },
]);

export const FEED_REACTION_IDS = Object.freeze(
  FEED_REACTIONS.map((reaction) => reaction.id),
);

export const FEED_MEDIA_TYPES = Object.freeze({
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
});

const FEED_MEDIA_EXTENSION_TYPES = Object.freeze({
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  png: 'image/png',
  webm: 'video/webm',
  webp: 'image/webp',
});

const USERNAME_PATTERN = /(^|[^\w])@([a-z0-9_]{3,24})\b/giu;
const URL_PATTERN = /\bhttps?:\/\/[^\s<>()]+/iu;

export function extractMentionUsernames(value) {
  const usernames = new Set();
  String(value || '').replace(USERNAME_PATTERN, (_match, _prefix, username) => {
    usernames.add(username.toLowerCase());
    return _match;
  });
  return [...usernames];
}

export function extractFirstUrl(value) {
  const match = String(value || '').match(URL_PATTERN);
  return match?.[0]?.replace(/[.,!?;:]+$/u, '') || '';
}

export function normalizeExternalUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const candidate = /^https?:\/\//iu.test(raw) ? raw : `https://${raw}`;
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

export function feedMediaContentType(file) {
  const declaredType = String(file?.type || '').trim().toLowerCase();
  if (FEED_MEDIA_TYPES[declaredType]) return declaredType;
  const extension = String(file?.name || '')
    .split('.')
    .pop()
    ?.trim()
    .toLowerCase();
  return FEED_MEDIA_EXTENSION_TYPES[extension] || '';
}

export function linkDomain(value) {
  try {
    return new URL(value).hostname.replace(/^www\./u, '');
  } catch {
    return '';
  }
}

export function validateFeedMedia(file) {
  if (!file) return { valid: true, kind: null, message: '' };
  const kind = FEED_MEDIA_TYPES[feedMediaContentType(file)];
  if (!kind) {
    return {
      valid: false,
      kind: null,
      message: 'Use a JPG, PNG, WebP, GIF, MP4, WebM, or MOV file.',
    };
  }
  if (file.size > FEED_MEDIA_MAX_BYTES) {
    return {
      valid: false,
      kind: null,
      message: 'Keep photos and videos under 50 MB.',
    };
  }
  return { valid: true, kind, message: '' };
}

export function canPublishFeedPost({ body, linkUrl, file }) {
  const text = String(body || '').trim();
  return Boolean(text || normalizeExternalUrl(linkUrl) || file);
}

export function summarizeFeedReactions(reactions = []) {
  const counts = new Map();
  reactions.forEach(({ reaction }) => {
    if (!FEED_REACTION_IDS.includes(reaction)) return;
    counts.set(reaction, (counts.get(reaction) || 0) + 1);
  });
  return FEED_REACTIONS
    .filter(({ id }) => counts.has(id))
    .map((reaction) => ({
      ...reaction,
      count: counts.get(reaction.id),
    }));
}

export function formatFeedTime(value, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (elapsedSeconds < 45) return 'now';
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m`;
  if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)}h`;
  if (elapsedSeconds < 604800) return `${Math.floor(elapsedSeconds / 86400)}d`;
  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function initialsForMember(member) {
  const source = String(member?.displayName || member?.username || 'GS').trim();
  return source
    .split(/\s+/u)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'GS';
}

export function feedTextParts(value, members = []) {
  const memberByUsername = new Map(
    members.map((member) => [String(member.username || '').toLowerCase(), member]),
  );
  const parts = [];
  const text = String(value || '');
  let cursor = 0;
  const matcher = new RegExp(USERNAME_PATTERN.source, 'giu');
  let match = matcher.exec(text);
  while (match) {
    const prefixLength = match[1]?.length || 0;
    const mentionStart = match.index + prefixLength;
    if (mentionStart > cursor) parts.push({ type: 'text', value: text.slice(cursor, mentionStart) });
    const username = match[2].toLowerCase();
    parts.push({
      type: 'mention',
      value: `@${match[2]}`,
      member: memberByUsername.get(username) || null,
    });
    cursor = mentionStart + match[2].length + 1;
    match = matcher.exec(text);
  }
  if (cursor < text.length) parts.push({ type: 'text', value: text.slice(cursor) });
  return parts.length ? parts : [{ type: 'text', value: text }];
}
