import { useState } from 'react';
import { FlipHorizontal2, UsersRound } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { CAT_COLORS } from '../context/ThemeContext';
import { CORE_PLAYS, itemsForCurriculumLane } from '../data/coreCatalog';
import { useWorkspaceLayout } from '../hooks/useWorkspaceLayout';
import { roleLensLabel } from '../play-engine/teamJobs';
import PhaseControls from './PhaseControls';
import FaceoffOutcomeControl from './FaceoffOutcomeControl';
import ResponsibilityPanel from './ResponsibilityPanel';
import SceneRink2D from './SceneRink2D';
import Sidebar from './Sidebar';

function truncate(value, limit = 20) {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function phaseColor(title, accent) {
  if (title?.includes('✅')) return '#22c55e';
  if (title?.includes('❌')) return '#ef4444';
  return accent;
}

function PlayNavigation({ playIdx, plays, goPlay, muted, border }) {
  const previous = playIdx > 0 ? plays[playIdx - 1] : null;
  const next = playIdx >= 0 && playIdx < plays.length - 1 ? plays[playIdx + 1] : null;

  return (
    <nav className="play-neighbor-nav" aria-label="Adjacent plays">
      {previous ? (
        <button type="button" onClick={() => goPlay(previous)} title={previous.n} style={{ color: muted, borderColor: border }}>
          <span aria-hidden="true">←</span>
          <span>{truncate(previous.n)}</span>
        </button>
      ) : <span />}
      {next ? (
        <button type="button" onClick={() => goPlay(next)} title={next.n} style={{ color: muted, borderColor: border }}>
          <span>{truncate(next.n)}</span>
          <span aria-hidden="true">→</span>
        </button>
      ) : <span />}
    </nav>
  );
}

function PlayIdentity({ play, color, text, muted }) {
  return (
    <div className="play-identity">
      <small style={{ color }}>
        {play?.lane?.toUpperCase()} / {play?.situation?.toUpperCase()}
      </small>
      <div>
        <span style={{ background: color }} />
        <h1 style={{ color: text }}>{play?.n}</h1>
      </div>
      <p style={{ color: muted }}>{play?.desc}</p>
    </div>
  );
}

function PhaseHeader({ phase, currentPhase, total, color, mirrored }) {
  return (
    <div className="play-phase-summary" style={{ '--phase-color': color }}>
      <div className="play-phase-copy">
        <span>PHASE {currentPhase + 1} / {total}</span>
        <strong>{phase?.t}{mirrored ? ' ↔' : ''}</strong>
      </div>
      <FaceoffOutcomeControl compact />
    </div>
  );
}

function StrategyButton({ color, onClick }) {
  return (
    <button
      type="button"
      className="play-strategy-button"
      onClick={onClick}
      style={{ color, borderColor: `${color}66`, background: `${color}12` }}
    >
      <span aria-hidden="true">▤</span>
      Strategy
    </button>
  );
}

export default function PlayViewer() {
  const { theme, themes } = useTheme();
  const t = themes[theme];
  const {
    currentPlay,
    currentReplayPlay,
    currentReplayScene,
    currentReplayPhases,
    setCurrentPlay,
    currentPhase,
    setCurrentPhase,
    isMirrored,
    setIsMirrored,
    showOpponents,
    setShowOpponents,
    setStrategyOpen,
    setIsPlaying,
    setPreviousPositions,
    cancelPlaybackRestart,
    selectedPosition,
    roleFocusMode,
    playbackTime,
  } = useApp();
  const layout = useWorkspaceLayout();
  const [sheetOpen, setSheetOpen] = useState(false);
  const lanePlays = itemsForCurriculumLane(CORE_PLAYS, currentPlay?.lane ?? 'defence');
  const playIdx = currentPlay ? lanePlays.findIndex((play) => play.id === currentPlay.id) : -1;
  const phase = currentReplayPhases[currentPhase];
  const total = currentReplayPhases.length;
  const currentPhaseColor = phaseColor(phase?.t, t.ac);
  const categoryColor = CAT_COLORS[currentPlay?.cat] || t.ac;

  const goPlay = (play) => {
    cancelPlaybackRestart();
    setPreviousPositions(null);
    setCurrentPlay(play);
    setCurrentPhase(0);
    setIsPlaying(false);
  };

  const workspaceStyle = {
    '--play-surface': t.sf,
    '--play-canvas': t.bg,
    '--play-panel': t.cb,
    '--play-border': t.bd,
    '--play-text': t.tx,
    '--play-muted': t.tm,
    '--play-dim': t.td,
    '--play-accent': t.ac,
  };

  if (layout === 'desktop') {
    return (
      <div
        className="play-workspace play-workspace-desktop"
        data-testid="play-workspace-desktop"
        style={workspaceStyle}
      >
        <aside className="play-region play-region-library" data-region="library">
          <Sidebar embedded />
        </aside>

        <header className="play-region play-region-title">
          <PlayNavigation plays={lanePlays} playIdx={playIdx} goPlay={goPlay} muted={t.tm} border={t.bd} />
          <PlayIdentity play={currentReplayPlay} color={categoryColor} text={t.tx} muted={t.td} />
        </header>

        <section className="play-region play-region-rink" data-region="rink" aria-label="Rink view">
          <div className="play-rink-frame">
            <SceneRink2D
              scene={currentReplayScene}
              time={playbackTime}
              roleFocusMode={roleFocusMode}
              selectedPosition={selectedPosition}
              showOpponents={showOpponents}
              mirrored={isMirrored}
            />
          </div>
        </section>

        <aside className="play-region play-region-detail" data-region="detail" style={{ borderColor: t.bd }}>
          <div className="play-region-label" style={{ color: t.td }}>TEAM PLAN</div>
          <ResponsibilityPanel compact embedded />
          <StrategyButton color={categoryColor} onClick={() => setStrategyOpen(true)} />
        </aside>

        <section className="play-region play-region-timeline" data-region="timeline" style={{ borderColor: t.bd }}>
          <PhaseHeader
            phase={phase}
            currentPhase={currentPhase}
            total={total}
            color={currentPhaseColor}
            mirrored={isMirrored}
          />
          <PhaseControls />
        </section>
      </div>
    );
  }

  return (
    <div
      className={`play-workspace play-workspace-${layout}`}
      data-testid={`play-workspace-${layout}`}
      style={workspaceStyle}
    >
      <header className="play-mobile-title">
        <PlayIdentity play={currentReplayPlay} color={categoryColor} text={t.tx} muted={t.td} />
      </header>

      <section className="play-mobile-rink" data-region="rink" aria-label="Rink view">
        <div className="play-rink-frame">
          <SceneRink2D
            scene={currentReplayScene}
            time={playbackTime}
            roleFocusMode={roleFocusMode}
            selectedPosition={selectedPosition}
            showOpponents={showOpponents}
            mirrored={isMirrored}
          />
        </div>
      </section>

      <section className="play-mobile-timeline" data-region="timeline">
        <PhaseHeader
          phase={phase}
          currentPhase={currentPhase}
          total={total}
          color={currentPhaseColor}
          mirrored={isMirrored}
        />
        <PhaseControls />
        <PlayNavigation plays={lanePlays} playIdx={playIdx} goPlay={goPlay} muted={t.tm} border={t.bd} />
      </section>

      <section
        className={`play-bottom-sheet ${sheetOpen ? 'is-open' : ''}`}
        data-region="detail"
        data-testid="play-bottom-sheet"
        style={{ background: t.sf, borderColor: t.bd }}
      >
        <button
          type="button"
          className="play-bottom-sheet-toggle"
          onClick={() => setSheetOpen((open) => !open)}
          aria-expanded={sheetOpen}
          aria-controls="mobile-coaching-detail"
          aria-label={`${sheetOpen ? 'Close' : 'Open'} team plan and view tools`}
          style={{ color: t.tx }}
        >
          <span className="play-bottom-sheet-handle" style={{ background: t.bd }} />
          <span className="play-bottom-sheet-title">
            <span style={{ color: t.td }}>TEAM PLAN</span>
            <strong style={{ color: roleFocusMode === 'team' ? t.ac : t.pc[selectedPosition] }}>
              {roleLensLabel(roleFocusMode)}
            </strong>
          </span>
          <span aria-hidden="true" style={{ color: t.tm }}>{sheetOpen ? '⌄' : '⌃'}</span>
        </button>

        {sheetOpen && (
          <div id="mobile-coaching-detail" className="play-bottom-sheet-content">
            <ResponsibilityPanel embedded />
            <div className="play-mobile-view-tools" role="group" aria-label="2D rink view tools">
              <button
                type="button"
                aria-pressed={showOpponents}
                onClick={() => setShowOpponents(!showOpponents)}
              >
                <UsersRound aria-hidden="true" />
                <span>{showOpponents ? 'Opponents on' : 'Opponents off'}</span>
              </button>
              <button
                type="button"
                aria-pressed={isMirrored}
                onClick={() => setIsMirrored(!isMirrored)}
              >
                <FlipHorizontal2 aria-hidden="true" />
                <span>{isMirrored ? 'Mirrored' : 'Mirror rink'}</span>
              </button>
            </div>
            <StrategyButton color={categoryColor} onClick={() => setStrategyOpen(true)} />
          </div>
        )}
      </section>
    </div>
  );
}
