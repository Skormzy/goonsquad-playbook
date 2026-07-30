import { createElement, Fragment, useEffect } from 'react';
import {
  BookOpenText,
  Box,
  BrainCircuit,
  House,
  Map as MapIcon,
  PencilRuler,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  activeViewForWorkspace,
  contentForActiveView,
  isWorkspaceModeAvailable,
  modeForActiveView,
} from '../routing/workspaceModes';

const DESTINATIONS = [
  { content: 'stats', label: 'Home', icon: House },
  { content: 'plays', label: 'Plays', icon: BookOpenText },
  { content: 'strategy', label: 'Strategy', icon: BrainCircuit },
  { content: 'playmaker', label: 'Create', icon: PencilRuler },
];

export default function MobileBottomNav() {
  const {
    activeView,
    setActiveView,
    setIsPlaying,
    setReplay3dCamera,
    setSidebarOpen,
    cancelPlaybackRestart,
  } = useApp();
  const activeContent = contentForActiveView(activeView);
  const currentDestination = ['account', 'profile'].includes(activeContent)
    ? 'stats'
    : activeContent;
  const activeMode = modeForActiveView(activeView);
  const currentLabel = DESTINATIONS.find(({ content }) => content === currentDestination)?.label;
  const hasModeSwitch = ['plays', 'strategy'].includes(activeContent);

  useEffect(() => {
    document.title = currentLabel ? `Goonsquad · ${currentLabel}` : 'Goonsquad';
  }, [currentLabel]);

  const navigate = (content) => {
    if (content === activeContent) return;
    const nextMode = isWorkspaceModeAvailable(content, activeMode) ? activeMode : '2d';
    cancelPlaybackRestart();
    setIsPlaying(false);
    setSidebarOpen(false);
    try {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('content', content);
      nextUrl.searchParams.set('mode', nextMode);
      window.history.pushState({ goonsquadDestination: content }, '', nextUrl);
    } catch { /* History is optional in embedded browsers. */ }
    setActiveView(activeViewForWorkspace(content, nextMode));
    requestAnimationFrame(() => {
      document.getElementById('main-content')?.focus({ preventScroll: true });
    });
  };

  const toggleViewMode = () => {
    if (!hasModeSwitch) return;
    const nextMode = activeMode === '3d' ? '2d' : '3d';
    cancelPlaybackRestart();
    setIsPlaying(false);
    setSidebarOpen(false);
    if (nextMode === '3d') setReplay3dCamera('overhead');
    try {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('content', activeContent);
      nextUrl.searchParams.set('mode', nextMode);
      if (nextMode === '3d') nextUrl.searchParams.set('camera', 'overhead');
      else nextUrl.searchParams.delete('camera');
      window.history.pushState({ goonsquadMode: nextMode }, '', nextUrl);
    } catch { /* History is optional in embedded browsers. */ }
    setActiveView(activeViewForWorkspace(activeContent, nextMode));
  };

  return (
    <nav
      className="mobile-bottom-nav"
      aria-label="Main app navigation"
      data-testid="mobile-bottom-nav"
      data-has-mode-switch={hasModeSwitch}
    >
      {DESTINATIONS.map(({ content, label, icon }) => {
        const active = currentDestination === content;
        return (
          <Fragment key={content}>
            <button
              type="button"
              className={active ? 'is-active' : ''}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
              onClick={() => navigate(content)}
            >
              <span className="mobile-bottom-nav-icon" aria-hidden="true">
                {createElement(icon)}
              </span>
              <span>{label}</span>
            </button>
            {content === 'plays' && hasModeSwitch && (
              <button
                type="button"
                className="mobile-bottom-nav-mode"
                aria-label={`Switch to ${activeMode === '3d' ? '2D' : '3D'} view`}
                title={`Switch to ${activeMode === '3d' ? '2D' : '3D'} view`}
                onClick={toggleViewMode}
              >
                <span className="mobile-bottom-nav-icon" aria-hidden="true">
                  {activeMode === '3d' ? <Box /> : <MapIcon />}
                </span>
                <span>{activeMode.toUpperCase()}</span>
              </button>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
