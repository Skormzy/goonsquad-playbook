import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { CORE_PLAYS, CORE_TACTICS } from '../data/coreCatalog';
import { normalizeFaceoffOutcome, resolveFaceoffPlayOutcome } from '../data/faceoffPlays';
import { getPlayScene, getStrategyScene } from '../play-engine/sceneRegistry';
import {
  createSynchronizedPlayback,
  synchronizedPlaybackReducer,
} from '../play-engine/synchronizePlayback';
import { createWorkspaceUrl, readWorkspaceUrl } from '../routing/workspaceUrlState';
import { useAccount } from '../account/AccountContext';
import {
  loadFavoritePlayIds,
  setFavoritePlayState,
} from '../account/accountCloud';
import {
  applyPendingFavoriteChanges,
  clearPendingFavoriteChange,
  readFavoriteIds,
  readPendingFavoriteChanges,
  setPendingFavoriteChange,
  writeFavoriteIds,
} from '../account/favoritesStorage';

const AppContext = createContext();

function isStrategyView(activeView) {
  return activeView === 'tactics' || activeView === 'strategy3d';
}

function replayPhasesForStrategy(tactic, variant) {
  if (!tactic) return [];
  const source = variant === 'mistake' ? tactic.mistakeScene : tactic.correctScene;
  return source.phases.map((phase, index) => ({
    id: index,
    t: phase.caption,
    desc: phase.caption,
    pos: phase.our,
  }));
}

function createInitialProviderState() {
  const href = typeof window === 'undefined' ? 'http://localhost/' : window.location.href;
  const urlState = readWorkspaceUrl(href, { includeInternal: import.meta.env.DEV });
  const initialPlayId = urlState.playId ?? 'trap';
  const currentPlay = CORE_PLAYS.find((play) => play.id === initialPlayId) ?? CORE_PLAYS[0] ?? null;
  const selectedTactic = CORE_TACTICS.find((tactic) => tactic.id === urlState.tacticId) ?? CORE_TACTICS[0] ?? null;
  const faceoffOutcome = currentPlay?.faceoff
    ? normalizeFaceoffOutcome(urlState.faceoffOutcome)
    : 'won';
  const currentReplayPlay = resolveFaceoffPlayOutcome(currentPlay, faceoffOutcome);
  const strategyVariant = urlState.strategyVariant;
  const strategyActive = isStrategyView(urlState.activeView);
  const phases = strategyActive
    ? replayPhasesForStrategy(selectedTactic, strategyVariant)
    : currentReplayPlay?.phases ?? [];
  const scene = strategyActive
    ? getStrategyScene(selectedTactic?.id, strategyVariant)
    : getPlayScene(currentPlay?.id, faceoffOutcome);

  return {
    ...urlState,
    currentPlay,
    faceoffOutcome,
    selectedTacticId: selectedTactic?.id ?? null,
    strategyVariant,
    playback: createSynchronizedPlayback({
      scene,
      phaseCount: phases.length,
      requestedPhase: urlState.phase,
      requestedTime: urlState.time,
    }),
  };
}

export function AppProvider({ children }) {
  const { configured: accountConfigured, user } = useAccount();
  const accountUserId = user?.id;
  const [initial] = useState(createInitialProviderState);
  const [activeView, setActiveViewState] = useState(initial.activeView);
  const activeViewRef = useRef(initial.activeView);
  const [selectedPosition, setSelectedPosition] = useState(initial.role);
  const [roleFocusMode, setRoleFocusMode] = useState('team');
  const [currentPlay, setCurrentPlayState] = useState(initial.currentPlay);
  const currentPlayRef = useRef(initial.currentPlay);
  const [faceoffOutcome, setFaceoffOutcomeState] = useState(initial.faceoffOutcome);
  const faceoffOutcomeRef = useRef(initial.faceoffOutcome);
  const [selectedTacticId, setSelectedTacticIdState] = useState(initial.selectedTacticId);
  const selectedTacticIdRef = useRef(initial.selectedTacticId);
  const [strategyVariant, setStrategyVariantState] = useState(initial.strategyVariant);
  const strategyVariantRef = useRef(initial.strategyVariant);
  const [playback, dispatchPlayback] = useReducer(synchronizedPlaybackReducer, initial.playback);
  const [isPlaying, setIsPlaying] = useState(initial.playing);
  const [isMirrored, setIsMirrored] = useState(false);
  const [showOpponents, setShowOpponents] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [speed, setSpeed] = useState(initial.speed);
  const [previousPositions, setPreviousPositions] = useState(null);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [playmakerTutorialOpen, setPlaymakerTutorialOpen] = useState(false);
  const [pendingTactic, setPendingTactic] = useState(null);
  const [replay3dCamera, setReplay3dCamera] = useState(initial.camera || 'broadcast');
  const selectedTactic = CORE_TACTICS.find((tactic) => tactic.id === selectedTacticId) ?? CORE_TACTICS[0] ?? null;
  const currentReplayPlay = useMemo(
    () => resolveFaceoffPlayOutcome(currentPlay, faceoffOutcome),
    [currentPlay, faceoffOutcome],
  );
  const currentReplayPhases = useMemo(() => (
    isStrategyView(activeView)
      ? replayPhasesForStrategy(selectedTactic, strategyVariant)
      : currentReplayPlay?.phases ?? []
  ), [activeView, currentReplayPlay, selectedTactic, strategyVariant]);
  const currentReplayScene = isStrategyView(activeView)
    ? getStrategyScene(selectedTactic?.id, strategyVariant)
    : getPlayScene(currentPlay?.id, faceoffOutcome);
  const phaseCount = currentReplayPhases.length;
  const currentPhase = playback.phase;
  const playbackTime = playback.time;

  const setActiveView = useCallback((value) => {
    const next = typeof value === 'function' ? value(activeViewRef.current) : value;
    const contentChanged = isStrategyView(next) !== isStrategyView(activeViewRef.current);
    activeViewRef.current = next;
    setActiveViewState(next);
    if (contentChanged) {
      dispatchPlayback({ type: 'reset' });
      setIsPlaying(false);
    }
  }, []);

  const setCurrentPlay = useCallback((value) => {
    const next = typeof value === 'function' ? value(currentPlayRef.current) : value;
    const changed = next?.id !== currentPlayRef.current?.id;
    currentPlayRef.current = next;
    setCurrentPlayState(next);
    if (changed) {
      dispatchPlayback({ type: 'reset' });
      faceoffOutcomeRef.current = 'won';
      setFaceoffOutcomeState('won');
      setRoleFocusMode('team');
    }
  }, []);

  const setFaceoffOutcome = useCallback((value) => {
    const requested = typeof value === 'function' ? value(faceoffOutcomeRef.current) : value;
    const next = normalizeFaceoffOutcome(requested);
    if (next === faceoffOutcomeRef.current || !currentPlayRef.current?.faceoff) return;
    faceoffOutcomeRef.current = next;
    setFaceoffOutcomeState(next);
    dispatchPlayback({ type: 'reset' });
    setIsPlaying(false);
  }, []);

  const setSelectedTacticId = useCallback((value) => {
    const next = typeof value === 'function' ? value(selectedTacticIdRef.current) : value;
    const valid = CORE_TACTICS.some((tactic) => tactic.id === next) ? next : CORE_TACTICS[0]?.id ?? null;
    if (valid === selectedTacticIdRef.current) return;
    selectedTacticIdRef.current = valid;
    setSelectedTacticIdState(valid);
    dispatchPlayback({ type: 'reset' });
    setIsPlaying(false);
    setRoleFocusMode('team');
  }, []);

  const setStrategyVariant = useCallback((value) => {
    const requested = typeof value === 'function' ? value(strategyVariantRef.current) : value;
    const next = requested === 'mistake' ? 'mistake' : 'correct';
    if (next === strategyVariantRef.current) return;
    strategyVariantRef.current = next;
    setStrategyVariantState(next);
    dispatchPlayback({ type: 'reset' });
    setIsPlaying(false);
  }, []);

  const setCurrentPhase = useCallback((value) => {
    dispatchPlayback({
      type: 'phase',
      value,
      scene: currentReplayScene,
      phaseCount,
    });
  }, [currentReplayScene, phaseCount]);

  const setPlaybackTime = useCallback((value) => {
    dispatchPlayback({
      type: 'time',
      value,
      scene: currentReplayScene,
      phaseCount,
    });
  }, [currentReplayScene, phaseCount]);

  // Favorites — persisted to localStorage
  const [favorites, setFavorites] = useState(() => new Set(readFavoriteIds(null)));
  const favoritesRef = useRef(favorites);

  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);

  useEffect(() => {
    if (!accountConfigured || !accountUserId) {
      let active = true;
      queueMicrotask(() => {
        if (active) setFavorites(new Set(readFavoriteIds(null)));
      });
      return () => { active = false; };
    }
    let active = true;
    const pending = readPendingFavoriteChanges(accountUserId);
    loadFavoritePlayIds(accountUserId).then(async (cloudIds) => {
      if (!active) return;
      const resolved = applyPendingFavoriteChanges(cloudIds, pending);
      setFavorites(new Set(resolved));
      writeFavoriteIds(accountUserId, resolved);
      await Promise.all(Object.entries(pending).map(async ([playId, favorited]) => {
        await setFavoritePlayState(accountUserId, playId, favorited);
        clearPendingFavoriteChange(accountUserId, playId);
      }));
    }).catch(() => {
      if (!active) return;
      setFavorites(new Set(readFavoriteIds(accountUserId)));
    });
    return () => { active = false; };
  }, [accountConfigured, accountUserId]);

  const pendingUrlStateRef = useRef(null);
  const urlWriteTimerRef = useRef(null);
  const lastUrlWriteRef = useRef(0);

  useEffect(() => {
    pendingUrlStateRef.current = {
      activeView,
      playId: currentPlay?.id,
      faceoffOutcome: currentPlay?.faceoff ? faceoffOutcome : null,
      tacticId: selectedTactic?.id,
      strategyVariant,
      phase: currentPhase,
      time: playbackTime,
      speed,
      role: selectedPosition,
      playing: isPlaying,
      camera: replay3dCamera,
    };

    const writeUrl = () => {
      urlWriteTimerRef.current = null;
      lastUrlWriteRef.current = Date.now();
      try {
        const nextUrl = createWorkspaceUrl(window.location.href, pendingUrlStateRef.current);
        window.history.replaceState(null, '', nextUrl);
      } catch { /* URL unavailable */ }
    };

    const delay = Math.max(0, 160 - (Date.now() - lastUrlWriteRef.current));
    if (delay === 0) writeUrl();
    else if (!urlWriteTimerRef.current) urlWriteTimerRef.current = setTimeout(writeUrl, delay);
  }, [activeView, currentPlay?.id, currentPlay?.faceoff, faceoffOutcome, selectedTactic?.id, strategyVariant, currentPhase, playbackTime, speed, selectedPosition, isPlaying, replay3dCamera]);

  useEffect(() => () => {
    if (urlWriteTimerRef.current) clearTimeout(urlWriteTimerRef.current);
  }, []);

  const toggleFavorite = useCallback((id) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      writeFavoriteIds(accountUserId ?? null, next);
      if (accountConfigured && accountUserId) {
        const favorited = next.has(id);
        setPendingFavoriteChange(accountUserId, id, favorited);
        setFavoritePlayState(accountUserId, id, favorited)
          .then(() => clearPendingFavoriteChange(accountUserId, id))
          .catch(() => {
            // The account-specific pending change is retried on the next session.
          });
      }
      return next;
    });
  }, [accountConfigured, accountUserId]);

  const playbackTimerRef = useRef(null);
  const cancelPlaybackRestart = useCallback(() => {
    if (playbackTimerRef.current) { clearTimeout(playbackTimerRef.current); playbackTimerRef.current = null; }
  }, []);
  const schedulePlaybackRestart = useCallback((cb) => {
    cancelPlaybackRestart();
    const id = setTimeout(() => {
      if (playbackTimerRef.current !== id) return;
      playbackTimerRef.current = null;
      cb();
    }, 80);
    playbackTimerRef.current = id;
  }, [cancelPlaybackRestart]);
  useEffect(() => cancelPlaybackRestart, [cancelPlaybackRestart]);

  return (
    <AppContext.Provider value={{
      activeView, setActiveView,
      selectedPosition, setSelectedPosition,
      roleFocusMode, setRoleFocusMode,
      currentPlay, setCurrentPlay,
      currentReplayPlay,
      faceoffOutcome, setFaceoffOutcome,
      selectedTactic, selectedTacticId, setSelectedTacticId,
      strategyVariant, setStrategyVariant,
      currentReplayScene, currentReplayPhases,
      currentPhase, setCurrentPhase,
      playbackTime, setPlaybackTime,
      isPlaying, setIsPlaying,
      isMirrored, setIsMirrored,
      showOpponents, setShowOpponents,
      sidebarOpen, setSidebarOpen,
      strategyOpen, setStrategyOpen,
      speed, setSpeed,
      previousPositions, setPreviousPositions,
      cancelPlaybackRestart, schedulePlaybackRestart,
      keyboardHelpOpen, setKeyboardHelpOpen,
      playmakerTutorialOpen, setPlaymakerTutorialOpen,
      pendingTactic, setPendingTactic,
      replay3dCamera, setReplay3dCamera,
      favorites, toggleFavorite,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
