import { normalizePlaymakerDraft, PLAYMAKER_SCHEMA_VERSION } from './playmakerModel';

const MAX_LINK_LENGTH = 24000;

function bytesToBase64Url(bytes) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

function base64UrlToBytes(value) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export function encodePlaymakerDraft(value) {
  const draft = normalizePlaymakerDraft(value);
  const payload = JSON.stringify({ v: PLAYMAKER_SCHEMA_VERSION, draft });
  return bytesToBase64Url(new TextEncoder().encode(payload));
}

export function decodePlaymakerDraft(encoded) {
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encoded)));
    if (![1, PLAYMAKER_SCHEMA_VERSION].includes(payload.v)) return null;
    return normalizePlaymakerDraft(payload.draft);
  } catch {
    return null;
  }
}

export function playmakerDraftFromUrl(href) {
  try {
    const encoded = new URL(href).searchParams.get('draft');
    return encoded ? decodePlaymakerDraft(encoded) : null;
  } catch {
    return null;
  }
}

export function createPlaymakerShareUrl(href, value) {
  const url = new URL(href || 'http://localhost/');
  url.search = '';
  url.searchParams.set('content', 'playmaker');
  url.searchParams.set('draft', encodePlaymakerDraft(value));
  const result = url.toString();
  if (result.length > MAX_LINK_LENGTH) throw new Error('This play is too large for a link. Export the play file instead.');
  return result;
}

export function playmakerExportFilename(value) {
  const safeTitle = String(value.title || 'untitled-play')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .slice(0, 48);
  return `${safeTitle || 'untitled-play'}.gsplay.json`;
}
