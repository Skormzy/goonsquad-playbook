import { createContext, useContext, useRef, useState } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [activeView, setActiveView] = useState('playbook');
  const [selectedPosition, setSelectedPosition] = useState('C');
  const [currentPlay, setCurrentPlay] = useState(null);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMirrored, setIsMirrored] = useState(false);
  const [showOpponents, setShowOpponents] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [previousPositions, setPreviousPositions] = useState(null);
  const playbackTimerRef = useRef(null);
  const cancelPlaybackRestart = () => {
    if (playbackTimerRef.current) { clearTimeout(playbackTimerRef.current); playbackTimerRef.current = null; }
  };
  const schedulePlaybackRestart = (cb) => {
    cancelPlaybackRestart();
    playbackTimerRef.current = setTimeout(() => { playbackTimerRef.current = null; cb(); }, 80);
  };

  return (
    <AppContext.Provider value={{
      activeView, setActiveView,
      selectedPosition, setSelectedPosition,
      currentPlay, setCurrentPlay,
      currentPhase, setCurrentPhase,
      isPlaying, setIsPlaying,
      isMirrored, setIsMirrored,
      showOpponents, setShowOpponents,
      sidebarOpen, setSidebarOpen,
      strategyOpen, setStrategyOpen,
      speed, setSpeed,
      previousPositions, setPreviousPositions,
      cancelPlaybackRestart, schedulePlaybackRestart,
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
