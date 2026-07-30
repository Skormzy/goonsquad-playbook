import { createElement, useEffect } from 'react';
import {
  BookOpenText,
  BrainCircuit,
  House,
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
    setSidebarOpen,
    cancelPlaybackRestart,
  } = useApp();
  const activeContent = contentForActiveView(activeView);
  const currentDestination = ['account', 'profile'].includes(activeContent)
    ? 'stats'
    : activeContent;
  const activeMode = modeForActiveView(activeView);
  const currentLabel = DESTINATIONS.find(({ content }) => content === currentDestination)?.label;

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

  return (
    <nav
      className="mobile-bottom-nav"
      aria-label="Main app navigation"
      data-testid="mobile-bottom-nav"
    >
      {DESTINATIONS.map(({ content, label, icon }) => {
        const active = currentDestination === content;
        return (
          <button
            type="button"
            key={content}
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
        );
      })}
    </nav>
  );
}
