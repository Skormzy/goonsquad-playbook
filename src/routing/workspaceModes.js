export const WORKSPACE_CONTENT = Object.freeze(['plays', 'strategy', 'playmaker', 'stats', 'profile', 'account']);
export const WORKSPACE_VIEWS = Object.freeze(['2d', '3d']);

export function contentForActiveView(activeView) {
  if (activeView === 'playmaker') return 'playmaker';
  if (activeView === 'stats') return 'stats';
  if (activeView === 'profile') return 'profile';
  if (activeView === 'account') return 'account';
  return activeView === 'tactics' || activeView === 'strategy3d' ? 'strategy' : 'plays';
}

export function modeForActiveView(activeView) {
  return activeView === 'replay3d' || activeView === 'strategy3d' ? '3d' : '2d';
}

export function isWorkspaceModeAvailable(content, mode) {
  if (!WORKSPACE_CONTENT.includes(content) || !WORKSPACE_VIEWS.includes(mode)) return false;
  return !['playmaker', 'stats', 'profile', 'account'].includes(content) || mode === '2d';
}

export function activeViewForWorkspace(content, mode) {
  if (content === 'playmaker') return 'playmaker';
  if (content === 'stats') return 'stats';
  if (content === 'profile') return 'profile';
  if (content === 'account') return 'account';
  if (content === 'strategy') return mode === '3d' ? 'strategy3d' : 'tactics';
  return mode === '3d' ? 'replay3d' : 'playbook';
}
