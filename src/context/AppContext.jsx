import { createContext, useContext, useState } from 'react';

const AppContext = createContext();

export function AppProvider({ children }) {
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

  return (
    <AppContext.Provider value={{
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
