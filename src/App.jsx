import { useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from './context/ThemeContext';
import { useApp } from './context/AppContext';
import { CORE_PLAYS, CORE_TACTICS, itemsForCurriculumLane } from './data/coreCatalog';
import Header from './components/Header';
import SkipLink from './components/accessibility/SkipLink';
import Sidebar from './components/Sidebar';
import PlayViewer from './components/PlayViewer';
import StrategyModal from './components/StrategyModal';
import TacticsLearn from './components/TacticsLearn';
import KeyboardHelp from './components/KeyboardHelp';
import AccountDialog from './account/AccountDialog';
import { useWorkspaceLayout } from './hooks/useWorkspaceLayout';
import {
  PLAYBACK_STATE_PUBLISH_INTERVAL_MS,
  replayTimeFromMonotonicClock,
} from './play-engine/playbackClock';
const ThreeDReplayView = lazy(() => import('./components/vnext3d/VNextThreeDView'));
const PlaymakerWorkspace = lazy(() => import('./playmaker/PlaymakerWorkspace'));
const StatsWorkspace = lazy(() => import('./stats/StatsWorkspace'));
const ProfileWorkspace = lazy(() => import('./profile/ProfileWorkspace'));
const AccountWorkspace = lazy(() => import('./account/AccountWorkspace'));
const PlayerRigReviewView = import.meta.env.DEV
  ? lazy(() => import('./components/replay3d/PlayerRigReviewView'))
  : null;
const MotionDiv = motion.div;

export default function App() {
  const { theme, themes, toggleTheme } = useTheme();
  const t = themes[theme];
  const workspaceLayout = useWorkspaceLayout();
  const {
    activeView,
    currentPlay, setCurrentPlay, currentPhase, setCurrentPhase,
    currentReplayScene: currentScene,
    currentReplayPhases,
    playbackTime, setPlaybackTime,
    isPlaying, setIsPlaying, setIsMirrored,
    setShowOpponents, sidebarOpen,
    speed, setPreviousPositions, cancelPlaybackRestart,
    selectedTacticId, setSelectedTacticId,
    setKeyboardHelpOpen,
  } = useApp();

  const playbackTimeRef = useRef(playbackTime);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const tot = currentReplayPhases.length;
  const lanePlays = useMemo(
    () => itemsForCurriculumLane(CORE_PLAYS, currentPlay?.lane ?? 'defence'),
    [currentPlay?.lane],
  );
  const selectedTacticLane = CORE_TACTICS.find((tactic) => tactic.id === selectedTacticId)?.lane ?? 'defence';
  const laneTactics = useMemo(
    () => itemsForCurriculumLane(CORE_TACTICS, selectedTacticLane),
    [selectedTacticLane],
  );
  const playIdx = currentPlay ? lanePlays.findIndex(p => p.id === currentPlay.id) : -1;
  const tacticIdx = laneTactics.findIndex((tactic) => tactic.id === selectedTacticId);
  const appOwnsMainLandmark = activeView === 'playbook' || activeView === 'tactics';
  const mainLabel = activeView === 'tactics' ? 'Strategy workspace' : 'Playbook workspace';

  useEffect(() => {
    playbackTimeRef.current = playbackTime;
  }, [playbackTime]);

  // Initialize first play
  useEffect(() => {
    if (!currentPlay && CORE_PLAYS.length > 0) setCurrentPlay(CORE_PLAYS[0]);
  }, [currentPlay, setCurrentPlay]);

  // Navigate phases
  const go = useCallback((n) => {
    cancelPlaybackRestart();
    if (n < 0 || n >= tot) return;
    setPreviousPositions(currentReplayPhases[currentPhase]?.pos || null);
    setCurrentPhase(n);
  }, [currentPhase, currentReplayPhases, tot, setPreviousPositions, setCurrentPhase, cancelPlaybackRestart]);

  // Navigate plays
  const goPlay = useCallback((p) => {
    cancelPlaybackRestart();
    setPreviousPositions(null);
    setCurrentPlay(p);
    setCurrentPhase(0);
    setIsPlaying(false);
  }, [cancelPlaybackRestart, setPreviousPositions, setCurrentPlay, setCurrentPhase, setIsPlaying]);

  const goTactic = useCallback((tactic) => {
    if (!tactic) return;
    cancelPlaybackRestart();
    setSelectedTacticId(tactic.id);
    setIsPlaying(false);
  }, [cancelPlaybackRestart, setIsPlaying, setSelectedTacticId]);

  const restartPlayback = useCallback(() => {
    cancelPlaybackRestart();
    setPreviousPositions(null);
    if (currentScene) setPlaybackTime(0);
    else setCurrentPhase(0);
    setIsPlaying(true);
  }, [cancelPlaybackRestart, currentScene, setPlaybackTime, setCurrentPhase, setIsPlaying, setPreviousPositions]);

  const togglePlayback = useCallback(() => {
    cancelPlaybackRestart();
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    const atEnd = currentScene
      ? playbackTime >= currentScene.duration - 0.05
      : currentPhase >= tot - 1;
    if (atEnd) restartPlayback();
    else setIsPlaying(true);
  }, [cancelPlaybackRestart, currentPhase, currentScene, isPlaying, playbackTime, restartPlayback, setIsPlaying, tot]);

  // The app clock drives 2D playback and shared control state.
  useEffect(() => {
    if (!isPlaying || !currentScene) return undefined;

    // The 3D strategy runtime owns its high-frequency replay clock and only
    // publishes time back to React for the shared controls and URL state.
    if (activeView === 'replay3d' || activeView === 'strategy3d') return undefined;

    let frameId = 0;
    const startWallTime = performance.now();
    const startReplayTime = playbackTimeRef.current;
    const publishInterval = PLAYBACK_STATE_PUBLISH_INTERVAL_MS;
    let lastPublishedAt = startWallTime - publishInterval;
    const tick = (now) => {
      const next = replayTimeFromMonotonicClock({
        startReplayTime,
        startWallTime,
        wallTime: now,
        speed,
        duration: currentScene.duration,
      });
      playbackTimeRef.current = next;
      if (now - lastPublishedAt >= publishInterval || next >= currentScene.duration) {
        lastPublishedAt = now;
        setPlaybackTime(next);
      }
      if (next >= currentScene.duration) {
        setIsPlaying(false);
        return;
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [activeView, currentScene, isPlaying, setIsPlaying, setPlaybackTime, speed]);

  // Shared playback shortcuts in both play views.
  useEffect(() => {
    if (!['playbook', 'replay3d', 'tactics', 'strategy3d'].includes(activeView)) return;
    const handler = (e) => {
      if (e.target instanceof Element && e.target.closest('input,select,textarea,[contenteditable="true"]')) return;

      if (e.key === 'ArrowRight') go(currentPhase + 1);
      else if (e.key === 'ArrowLeft') go(currentPhase - 1);
      else if (e.key === ' ') {
        e.preventDefault();
        togglePlayback();
      }
      else if (e.key.toLowerCase() === 'r') restartPlayback();
      else if (e.key === 'm' && activeView === 'playbook') setIsMirrored(m => !m);
      else if (e.key === 'o' && activeView === 'playbook') setShowOpponents(o => !o);
      else if (e.key === 't') toggleTheme();
      else if (e.key === '[' && ['playbook', 'replay3d'].includes(activeView)) {
        if (playIdx > 0) goPlay(lanePlays[playIdx - 1]);
      }
      else if (e.key === ']' && ['playbook', 'replay3d'].includes(activeView)) {
        if (playIdx >= 0 && playIdx < lanePlays.length - 1) goPlay(lanePlays[playIdx + 1]);
      }
      else if (e.key === '[' && ['tactics', 'strategy3d'].includes(activeView)) {
        if (tacticIdx > 0) goTactic(laneTactics[tacticIdx - 1]);
      }
      else if (e.key === ']' && ['tactics', 'strategy3d'].includes(activeView)) {
        if (tacticIdx >= 0 && tacticIdx < laneTactics.length - 1) goTactic(laneTactics[tacticIdx + 1]);
      }
      else if (e.key === '?') { e.preventDefault(); setKeyboardHelpOpen(k => !k); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeView, currentPhase, lanePlays, laneTactics, playIdx, tacticIdx, go, goPlay, goTactic, restartPlayback, setIsMirrored, setKeyboardHelpOpen, setShowOpponents, togglePlayback, toggleTheme]);

  // Global ? shortcut (works outside playbook too)
  useEffect(() => {
    if (['playbook', 'replay3d', 'tactics', 'strategy3d'].includes(activeView)) return;
    const handler = (e) => {
      if (e.target instanceof Element && e.target.closest('input,select,textarea')) return;
      if (e.key === '?') { e.preventDefault(); setKeyboardHelpOpen(k => !k); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeView, setKeyboardHelpOpen]);

  // Swipe gestures for phase navigation (playbook mode)
  const handleTouchStart = useCallback((e) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback((e) => {
    if (activeView !== 'playbook') return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    // Must be primarily horizontal swipe, min 60px
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    // Don't fire on interactive elements
    const tag = e.target?.tagName?.toLowerCase();
    if (['button', 'input', 'select', 'a'].includes(tag)) return;
    if (dx < 0) go(currentPhase + 1);
    else go(currentPhase - 1);
  }, [activeView, go, currentPhase]);

  return (
    <div
      className="app-shell"
      data-theme={theme}
      style={{
        background: t.bg, color: t.tx, height: '100vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        transition: 'background .3s, color .3s',
      }}
    >
      <SkipLink />
      <StrategyModal />
      <KeyboardHelp />
      <AccountDialog />
      <Header />

      <div
        id="main-content"
        tabIndex={-1}
        role={appOwnsMainLandmark ? 'main' : undefined}
        aria-label={appOwnsMainLandmark ? mainLabel : undefined}
        className={`app-content ${activeView === 'replay3d' || activeView === 'strategy3d' || (import.meta.env.DEV && activeView === 'rigreview') ? 'app-content-replay3d' : ''} ${activeView === 'playmaker' ? 'app-content-playmaker' : ''} ${activeView === 'stats' ? 'app-content-stats' : ''} ${activeView === 'profile' ? 'app-content-profile' : ''} ${activeView === 'account' ? 'app-content-account' : ''}`}
        style={{ flex: 1, display: 'flex', position: 'relative', minHeight: 0, overflow: 'hidden' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence mode="wait">
          {activeView === 'playbook' && (
            <MotionDiv
              key="playbook"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ flex: 1, display: 'flex', position: 'relative', width: '100%', minHeight: 0 }}
            >
              <AnimatePresence>
                {sidebarOpen && workspaceLayout !== 'desktop' && <Sidebar key="sidebar" />}
              </AnimatePresence>
              <PlayViewer />
            </MotionDiv>
          )}
          {activeView === 'tactics' && (
            <MotionDiv
              key="tactics"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ flex: 1, width: '100%', display: 'flex' }}
            >
              <TacticsLearn />
            </MotionDiv>
          )}
          {activeView === 'replay3d' && (
            <MotionDiv
              key="replay3d"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ flex: 1, width: '100%', display: 'flex', minHeight: 0 }}
            >
              <Suspense fallback={
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.tm, fontSize: 11, letterSpacing: 2, fontFamily: 'monospace' }}>
                  LOADING 3D WORKSPACE...
                </div>
              }>
                <ThreeDReplayView />
              </Suspense>
            </MotionDiv>
          )}
          {activeView === 'strategy3d' && (
            <MotionDiv
              key="strategy3d"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ flex: 1, width: '100%', display: 'flex', minHeight: 0 }}
            >
              <Suspense fallback={
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.tm, fontSize: 11, letterSpacing: 2, fontFamily: 'monospace' }}>
                  LOADING 3D STRATEGY...
                </div>
              }>
                <ThreeDReplayView />
              </Suspense>
            </MotionDiv>
          )}
          {activeView === 'playmaker' && (
            <MotionDiv
              key="playmaker"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ flex: 1, width: '100%', display: 'flex', minHeight: 0 }}
            >
              <Suspense fallback={
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.tm, fontSize: 11, fontFamily: 'monospace' }}>
                  LOADING PLAYMAKER...
                </div>
              }>
                <PlaymakerWorkspace />
              </Suspense>
            </MotionDiv>
          )}
          {activeView === 'stats' && (
            <MotionDiv
              key="stats"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ flex: 1, width: '100%', display: 'flex', minHeight: 0 }}
            >
              <Suspense fallback={<div className="stats-loading">LOADING TEAM STATISTICS...</div>}>
                <StatsWorkspace />
              </Suspense>
            </MotionDiv>
          )}
          {activeView === 'profile' && (
            <MotionDiv
              key="profile"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ flex: 1, width: '100%', display: 'flex', minHeight: 0 }}
            >
              <Suspense fallback={<div className="profile-loading">LOADING PLAYER PROFILE...</div>}>
                <ProfileWorkspace />
              </Suspense>
            </MotionDiv>
          )}
          {activeView === 'account' && (
            <MotionDiv
              key="account"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ flex: 1, width: '100%', display: 'flex', minHeight: 0 }}
            >
              <Suspense fallback={<div className="profile-loading">LOADING ACCOUNT...</div>}>
                <AccountWorkspace />
              </Suspense>
            </MotionDiv>
          )}
          {import.meta.env.DEV && PlayerRigReviewView && activeView === 'rigreview' && (
            <MotionDiv
              key="rigreview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ flex: 1, width: '100%', display: 'flex', minHeight: 0 }}
            >
              <Suspense fallback={
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.tm, fontSize: 11, letterSpacing: 2, fontFamily: 'monospace' }}>
                  LOADING RIG REVIEW...
                </div>
              }>
                <PlayerRigReviewView />
              </Suspense>
            </MotionDiv>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
