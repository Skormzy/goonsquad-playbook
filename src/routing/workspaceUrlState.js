import { normalizePlaybackSpeed } from '../play-engine/playbackSpeeds';
import { resolveInitialView } from './viewRegistry';
import {
  activeViewForWorkspace,
  contentForActiveView,
  isWorkspaceModeAvailable,
  modeForActiveView,
} from './workspaceModes';

const ROLES = new Set(['LW', 'C', 'RW', 'LD', 'RD', 'G']);
const CAMERAS = new Set(['broadcast', 'bench', 'overhead', 'player']);

function optionalNumber(params, key) {
  if (!params.has(key)) return null;
  const value = Number(params.get(key));
  return Number.isFinite(value) ? value : null;
}

function booleanParam(params, key) {
  const value = params.get(key);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

export function readWorkspaceUrl(href, { includeInternal = false } = {}) {
  const fallbackHref = 'http://localhost/';
  let url;
  try {
    url = new URL(href || fallbackHref);
  } catch {
    url = new URL(fallbackHref);
  }

  const params = url.searchParams;
  const resolvedView = resolveInitialView(url.href, { includeInternal });
  const content = contentForActiveView(resolvedView);
  const requestedMode = modeForActiveView(resolvedView);
  const mode = isWorkspaceModeAvailable(content, requestedMode) ? requestedMode : '2d';
  const activeView = resolvedView === 'rigreview'
    ? resolvedView
    : activeViewForWorkspace(content, mode);
  const requestedRole = params.get('role');
  const requestedCamera = params.get('camera');
  const time = optionalNumber(params, 'time');
  const canonicalPlaying = booleanParam(params, 'playing');
  const legacyPlaying = booleanParam(params, 'play');

  return {
    activeView,
    content,
    mode,
    playId: params.get('playId'),
    tacticId: params.get('tacticId'),
    faceoffOutcome: params.get('faceoff') === 'lost' ? 'lost' : 'won',
    strategyVariant: params.get('scenario') === 'mistake' ? 'mistake' : 'correct',
    phase: optionalNumber(params, 'phase'),
    time,
    speed: normalizePlaybackSpeed(params.get('speed')),
    role: ROLES.has(requestedRole) ? requestedRole : 'C',
    playing: canonicalPlaying ?? legacyPlaying ?? (['replay3d', 'strategy3d'].includes(activeView) && time == null),
    camera: CAMERAS.has(requestedCamera) ? requestedCamera : null,
  };
}

function roundedTime(value) {
  const rounded = Number(Number(value || 0).toFixed(2));
  return String(rounded);
}

export function createWorkspaceUrl(href, state) {
  const url = new URL(href || 'http://localhost/');
  const { activeView } = state;

  if (activeView === 'rigreview') {
    url.searchParams.set('view', 'rigreview');
    return `${url.pathname}${url.search}${url.hash}`;
  }

  const content = contentForActiveView(activeView);
  const requestedMode = modeForActiveView(activeView);
  const mode = isWorkspaceModeAvailable(content, requestedMode) ? requestedMode : '2d';

  url.searchParams.delete('view');
  url.searchParams.delete('play');
  url.searchParams.set('content', content);
  url.searchParams.set('mode', mode);
  if (content === 'plays' && state.playId) url.searchParams.set('playId', state.playId);
  else url.searchParams.delete('playId');
  if (content === 'strategy' && state.tacticId) url.searchParams.set('tacticId', state.tacticId);
  else url.searchParams.delete('tacticId');
  if (content === 'strategy') url.searchParams.set('scenario', state.strategyVariant === 'mistake' ? 'mistake' : 'correct');
  else url.searchParams.delete('scenario');
  if (content === 'plays' && state.faceoffOutcome === 'lost') url.searchParams.set('faceoff', 'lost');
  else url.searchParams.delete('faceoff');
  if (content === 'stats' || content === 'profile' || content === 'account') {
    ['phase', 'time', 'speed', 'role', 'playing', 'camera'].forEach((key) => url.searchParams.delete(key));
    if (content === 'profile' || content === 'account') ['season', 'team', 'stage', 'game'].forEach((key) => url.searchParams.delete(key));
    return `${url.pathname}${url.search}${url.hash}`;
  }
  ['season', 'team', 'stage'].forEach((key) => url.searchParams.delete(key));
  url.searchParams.set('phase', String(Math.max(0, Math.trunc(state.phase || 0))));
  url.searchParams.set('time', roundedTime(state.time));
  url.searchParams.set('speed', String(normalizePlaybackSpeed(state.speed)));
  url.searchParams.set('role', ROLES.has(state.role) ? state.role : 'C');
  url.searchParams.set('playing', String(Boolean(state.playing)));
  if (state.camera) url.searchParams.set('camera', state.camera);
  else url.searchParams.delete('camera');

  return `${url.pathname}${url.search}${url.hash}`;
}
