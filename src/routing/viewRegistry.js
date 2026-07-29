export const PUBLIC_VIEW_IDS = Object.freeze(['playbook', 'tactics', 'replay3d', 'strategy3d', 'playmaker', 'stats', 'profile', 'account']);
export const INTERNAL_VIEW_IDS = Object.freeze(['rigreview']);

export function createViewRegistry({ includeInternal = false } = {}) {
  return new Set([
    ...PUBLIC_VIEW_IDS,
    ...(includeInternal ? INTERNAL_VIEW_IDS : []),
  ]);
}

export function resolveInitialView(href, { includeInternal = false } = {}) {
  const validViews = createViewRegistry({ includeInternal });

  try {
    const url = new URL(href);
    const queryView = url.searchParams.get('view');
    const hashView = url.hash.replace('#', '');
    if (validViews.has(queryView)) return queryView;
    if (validViews.has(hashView)) return hashView;

    const content = url.searchParams.get('content');
    const mode = url.searchParams.get('mode');
    if (content === 'playmaker') return 'playmaker';
    if (content === 'stats') return 'stats';
    if (content === 'profile') return 'profile';
    if (content === 'account') return 'account';
    if (content === 'strategy') return mode === '3d' ? 'strategy3d' : 'tactics';
    if (content === 'plays') return mode === '3d' ? 'replay3d' : 'playbook';
  } catch { /* URL unavailable */ }

  return 'stats';
}
