import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { CORE_PLAYS } from '../data/coreCatalog';
import {
  CircleHelp,
  FlipHorizontal2,
  Menu,
  Moon,
  Sun,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import skullUpper from '../assets/skull_upper.png';
import {
  activeViewForWorkspace,
  contentForActiveView,
  isWorkspaceModeAvailable,
  modeForActiveView,
} from '../routing/workspaceModes';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import { useWorkspaceLayout } from '../hooks/useWorkspaceLayout';
import { useAccount } from '../account/AccountContext';

export default function Header() {
  const { theme, themes, toggleTheme } = useTheme();
  const t = themes[theme];
  const workspaceLayout = useWorkspaceLayout();
  const account = useAccount();
  const {
    activeView, setActiveView,
    showOpponents, setShowOpponents,
    isMirrored, setIsMirrored,
    sidebarOpen, setSidebarOpen,
    setIsPlaying, cancelPlaybackRestart,
    keyboardHelpOpen, setKeyboardHelpOpen,
    favorites,
  } = useApp();

  const activateView = (view, { preservePlayback = false } = {}) => {
    if (view === activeView) return;
    cancelPlaybackRestart();
    if (!preservePlayback) setIsPlaying(false);
    if (view === 'tactics' || view === 'replay3d' || view === 'strategy3d' || view === 'playmaker' || view === 'stats' || view === 'profile' || view === 'account') setSidebarOpen(false);
    setActiveView(view);
  };

  const contentMode = contentForActiveView(activeView);
  const viewMode = modeForActiveView(activeView);
  const brandMeta = contentMode === 'playmaker'
    ? 'PLAYMAKER / AUTHORING'
    : contentMode === 'stats'
      ? 'TEAM HOME / PERFORMANCE'
    : contentMode === 'profile'
      ? 'PLAYER PROFILE / MY TEAM'
    : contentMode === 'account'
      ? 'GOONSQUAD ID / ACCOUNT'
    : contentMode === 'strategy'
      ? 'TACTICAL IQ / STRATEGY'
      : `PLAYBOOK / OFFENCE + DEFENCE`;

  const switchContent = (content) => {
    const nextMode = isWorkspaceModeAvailable(content, viewMode) ? viewMode : '2d';
    activateView(activeViewForWorkspace(content, nextMode));
  };

  const switchMode = (mode) => {
    if (!isWorkspaceModeAvailable(contentMode, mode)) return;
    activateView(activeViewForWorkspace(contentMode, mode), { preservePlayback: true });
  };
  const visibleFavoriteCount = CORE_PLAYS.filter((play) => favorites.has(play.id)).length;
  const openAccountOrProfile = () => {
    if (!account.user || activeView === 'profile') activateView('account');
    else if (activeView !== 'account') activateView('profile');
  };

  return (
    <header
      className="app-header"
      style={{
        '--header-surface': t.sf,
        '--header-border': t.bd,
        '--header-text': t.tx,
        '--header-muted': t.td,
        '--header-accent': t.ac,
        '--header-accent-bg': t.ab,
        '--header-brand': t.br,
      }}
    >
      <div className="app-header-main">
        <div className="app-header-left">
          {activeView === 'playbook' && workspaceLayout !== 'desktop' && (
            <button
              type="button"
              className={`app-header-icon-button app-header-menu ${sidebarOpen ? 'is-active' : ''}`}
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title="Browse plays"
              aria-label={sidebarOpen ? 'Close play library' : 'Open play library'}
              aria-expanded={sidebarOpen}
            >
              {sidebarOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
              {!sidebarOpen && visibleFavoriteCount > 0 && (
                <span className="app-header-badge">{visibleFavoriteCount}</span>
              )}
            </button>
          )}

          <div className="app-brand-lockup" aria-label="Goonsquad ball hockey playbook">
            <span className="app-brand-crest" aria-hidden="true">
              <img src={skullUpper} alt="" />
            </span>
            <span className="app-brand-copy">
              <span className="app-brand-name"><b>GOON</b><em>SQUAD</em></span>
              <span className="app-brand-meta">{brandMeta}</span>
            </span>
          </div>
        </div>

        <div className="app-header-workspace">
          <WorkspaceSwitcher
            allowStrategy3d
            content={contentMode}
            mode={viewMode}
            onContentChange={switchContent}
            onModeChange={switchMode}
            colors={{
              accent: t.ac,
              accentBackground: t.ab,
              brand: t.br,
              border: t.bd,
              track: t.cb,
              text: t.tx,
              muted: t.td,
            }}
          />
        </div>

        <div className="app-header-actions" role="toolbar" aria-label="Workspace actions">
          {activeView === 'playbook' && workspaceLayout === 'desktop' && (
            <>
              <button
                type="button"
                className={`app-header-icon-button is-opponent ${showOpponents ? 'is-active' : ''}`}
                onClick={() => setShowOpponents(!showOpponents)}
                title={showOpponents ? 'Hide opponents' : 'Show opponents'}
                aria-label={showOpponents ? 'Hide opponents' : 'Show opponents'}
                aria-pressed={showOpponents}
              >
                <UsersRound aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`app-header-icon-button ${isMirrored ? 'is-active' : ''}`}
                onClick={() => setIsMirrored(!isMirrored)}
                title="Mirror the rink (M)"
                aria-label="Mirror the rink"
                aria-pressed={isMirrored}
              >
                <FlipHorizontal2 aria-hidden="true" />
              </button>
            </>
          )}
          <button
            type="button"
            className={`app-header-icon-button ${account.user ? 'is-account-active' : ''} ${activeView === 'profile' || activeView === 'account' ? 'is-active' : ''}`}
            onClick={openAccountOrProfile}
            title={account.user ? activeView === 'profile' ? 'Account settings' : `Open ${account.displayName}'s profile` : 'Create account or sign in'}
            aria-label={account.user ? activeView === 'profile' ? `Open account settings for ${account.displayName}` : `Open player profile for ${account.displayName}` : 'Create account or sign in'}
            aria-pressed={account.dialogOpen || activeView === 'profile' || activeView === 'account'}
          >
            <UserRound aria-hidden="true" />
            {account.user && <span className="app-header-status-dot" aria-hidden="true" />}
          </button>
          <button
            type="button"
            className={`app-header-icon-button ${keyboardHelpOpen ? 'is-active' : ''}`}
            onClick={() => setKeyboardHelpOpen(true)}
            title="Open guide (?)"
            aria-label="Open product guide"
            aria-pressed={keyboardHelpOpen}
          >
            <CircleHelp aria-hidden="true" />
          </button>
          <button
            type="button"
            className="app-header-icon-button"
            onClick={toggleTheme}
            title="Toggle theme (T)"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
