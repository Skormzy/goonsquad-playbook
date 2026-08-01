import { createElement, useEffect } from 'react';
import {
  BarChart3,
  BookOpenText,
  BrainCircuit,
  LockKeyhole,
  PencilRuler,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import GoonsquadHomeIcon from './GoonsquadHomeIcon';
import {
  activeViewForWorkspace,
  contentForActiveView,
  isWorkspaceModeAvailable,
  modeForActiveView,
} from '../routing/workspaceModes';
import { teamAccessPromptCopy } from '../account/teamAccess';

const DESTINATIONS = [
  { content: 'home', label: 'Home', icon: GoonsquadHomeIcon },
  { content: 'stats', label: 'Stats', icon: BarChart3 },
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
    hasTeamAccess,
    teamAccessState,
  } = useApp();
  const activeContent = contentForActiveView(activeView);
  const currentDestination = ['account', 'profile'].includes(activeContent)
    ? 'home'
    : activeContent;
  const activeMode = modeForActiveView(activeView);
  const currentLabel = DESTINATIONS.find(({ content }) => content === currentDestination)?.label;

  useEffect(() => {
    document.title = currentLabel ? `Goonsquad · ${currentLabel}` : 'Goonsquad';
  }, [currentLabel]);

  const navigate = (content) => {
    if (content === activeContent) return;
    const nextMode = isWorkspaceModeAvailable(content, activeMode) ? activeMode : '2d';
    const nextView = activeViewForWorkspace(content, nextMode);
    cancelPlaybackRestart();
    setIsPlaying(false);
    setSidebarOpen(false);
    if (setActiveView(nextView) === false) return;
    try {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('content', content);
      nextUrl.searchParams.set('mode', nextMode);
      if (content !== 'home') nextUrl.searchParams.delete('post');
      if (content !== 'stats') {
        ['game', 'player', 'opponent', 'fixture'].forEach((key) => {
          nextUrl.searchParams.delete(key);
        });
      }
      if (content === 'home' || content === 'stats') {
        [
          'playId',
          'tacticId',
          'scenario',
          'faceoff',
          'phase',
          'time',
          'speed',
          'role',
          'playing',
          'camera',
        ].forEach((key) => {
          nextUrl.searchParams.delete(key);
        });
      }
      window.history.pushState({ goonsquadDestination: content }, '', nextUrl);
    } catch { /* History is optional in embedded browsers. */ }
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
        const locked = ['plays', 'strategy', 'playmaker'].includes(content) && !hasTeamAccess;
        const lockedCopy = teamAccessPromptCopy(teamAccessState, label);
        const lockMessage = `${lockedCopy.title}. ${lockedCopy.detail}`;
        return (
          <button
            type="button"
            key={content}
            className={`${active ? 'is-active' : ''} ${locked ? 'is-locked' : ''}`.trim()}
            data-locked={locked || undefined}
            data-testid={`mobile-nav-${content}`}
            aria-current={active ? 'page' : undefined}
            aria-haspopup={locked ? 'dialog' : undefined}
            aria-label={locked ? `${label}, locked. ${lockMessage}` : label}
            title={locked ? lockMessage : label}
            onClick={() => navigate(content)}
          >
            <span className="mobile-bottom-nav-icon" aria-hidden="true">
              {createElement(icon)}
              {locked && <LockKeyhole className="mobile-bottom-nav-lock" />}
            </span>
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
