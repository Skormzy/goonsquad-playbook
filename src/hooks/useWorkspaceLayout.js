import { useEffect, useState } from 'react';

export const DESKTOP_WORKSPACE_MIN = 1024;
export const TABLET_WORKSPACE_MIN = 700;

export function workspaceLayoutForWidth(width) {
  if (width >= DESKTOP_WORKSPACE_MIN) return 'desktop';
  if (width >= TABLET_WORKSPACE_MIN) return 'tablet';
  return 'mobile';
}

function currentLayout() {
  if (typeof window === 'undefined') return 'desktop';
  return workspaceLayoutForWidth(window.innerWidth);
}

export function useWorkspaceLayout() {
  const [layout, setLayout] = useState(currentLayout);

  useEffect(() => {
    const update = () => setLayout(currentLayout());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return layout;
}
