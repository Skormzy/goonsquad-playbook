import { createElement } from 'react';
import { Box, Map as MapIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  activeViewForWorkspace,
  contentForActiveView,
  modeForActiveView,
} from '../routing/workspaceModes';

const MODES = [
  { id: '2d', label: '2D', icon: MapIcon },
  { id: '3d', label: '3D', icon: Box },
];

export default function MobileViewModeSwitch({ className = '' }) {
  const {
    activeView,
    setActiveView,
    setIsPlaying,
    setReplay3dCamera,
    setSidebarOpen,
    cancelPlaybackRestart,
  } = useApp();
  const content = contentForActiveView(activeView);
  const activeMode = modeForActiveView(activeView);

  if (!['plays', 'strategy'].includes(content)) return null;

  const selectMode = (mode) => {
    if (mode === activeMode) return;
    cancelPlaybackRestart();
    setIsPlaying(false);
    setSidebarOpen(false);
    if (mode === '3d') setReplay3dCamera('overhead');

    try {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('content', content);
      nextUrl.searchParams.set('mode', mode);
      if (mode === '3d') nextUrl.searchParams.set('camera', 'overhead');
      else nextUrl.searchParams.delete('camera');
      window.history.pushState({ goonsquadMode: mode }, '', nextUrl);
    } catch {
      // Embedded browsers may not expose history. App state remains authoritative.
    }

    setActiveView(activeViewForWorkspace(content, mode));
  };

  return (
    <div
      className={`mobile-view-mode-switch ${className}`.trim()}
      role="group"
      aria-label="Choose rink view"
      data-testid="mobile-view-mode-switch"
    >
      {MODES.map(({ id, label, icon }) => (
        <button
          type="button"
          key={id}
          className={activeMode === id ? 'is-active' : ''}
          aria-pressed={activeMode === id}
          aria-label={`Open ${label} rink view`}
          onClick={() => selectMode(id)}
        >
          {createElement(icon, { 'aria-hidden': true })}
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
