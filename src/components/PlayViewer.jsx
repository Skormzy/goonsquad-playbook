import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, FlipHorizontal2, UsersRound } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { CAT_COLORS } from '../context/ThemeContext';
import { CORE_PLAYS, itemsForCurriculumLane } from '../data/coreCatalog';
import { useWorkspaceLayout } from '../hooks/useWorkspaceLayout';
import { teamJobsFromPhase } from '../play-engine/teamJobs';
import {
  coverageAssignmentsForReplay,
  hasCoverageAssignments,
} from '../play-engine/coverageAssignments';
import CoverageVisibilityControl from './CoverageVisibilityControl';
import PhaseControls from './PhaseControls';
import FaceoffOutcomeControl from './FaceoffOutcomeControl';
import MobileTeamPlan from './MobileTeamPlan';
import MobileViewModeSwitch from './MobileViewModeSwitch';
import ReplayTeachingCue from './ReplayTeachingCue';
import ResponsibilityPanel from './ResponsibilityPanel';
import SceneRink2D from './SceneRink2D';
import Sidebar from './Sidebar';

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
          <span>{previous.n}</span>
        </button>
      ) : <span />}
      {next ? (
        <button type="button" onClick={() => goPlay(next)} title={next.n} style={{ color: muted, borderColor: border }}>
          <span>{next.n}</span>
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
    instructionPhase,
    setCurrentPhase,
    isMirrored,
    setIsMirrored,
    showOpponents,
    setShowOpponents,
    showCoverage,
    setShowCoverage,
    setStrategyOpen,
    setIsPlaying,
    setPreviousPositions,
    cancelPlaybackRestart,
    sidebarOpen,
    setSidebarOpen,
    selectedPosition,
    roleFocusMode,
    playbackTime,
  } = useApp();
  const layout = useWorkspaceLayout();
  const [sheetOpen, setSheetOpen] = useState(false);
  const lanePlays = itemsForCurriculumLane(CORE_PLAYS, currentPlay?.lane ?? 'defence');
  const playIdx = currentPlay ? lanePlays.findIndex((play) => play.id === currentPlay.id) : -1;
  const phase = currentReplayPhases[instructionPhase];
  const currentPhaseColor = phaseColor(phase?.t, t.ac);
  const categoryColor = CAT_COLORS[currentPlay?.cat] || t.ac;
  const teamJobs = useMemo(
    () => teamJobsFromPhase(phase, isMirrored),
    [isMirrored, phase],
  );
  const coverageAvailable = currentReplayPlay?.lane === 'defence'
    && hasCoverageAssignments(coverageAssignmentsForReplay(currentReplayScene, playbackTime));

  useEffect(() => {
    const query = window.matchMedia('(max-height: 520px) and (orientation: landscape)');
    const syncSheet = () => setSheetOpen(query.matches);
    syncSheet();
    if (query.addEventListener) query.addEventListener('change', syncSheet);
    else query.addListener(syncSheet);
    return () => {
      if (query.removeEventListener) query.removeEventListener('change', syncSheet);
      else query.removeListener(syncSheet);
    };
  }, []);

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
              coverageEnabled={showCoverage}
              coverageLane={currentReplayPlay?.lane}
            />
          </div>
        </section>

        <aside className="play-region play-region-detail" data-region="detail" style={{ borderColor: t.bd }}>
          {currentPlay?.faceoff ? (
            <div className="play-detail-faceoff">
              <FaceoffOutcomeControl compact />
            </div>
          ) : null}
          <ResponsibilityPanel compact embedded />
          {coverageAvailable ? (
            <CoverageVisibilityControl
              enabled={showCoverage}
              onChange={setShowCoverage}
            />
          ) : null}
          <StrategyButton color={categoryColor} onClick={() => setStrategyOpen(true)} />
        </aside>

        <section className="play-region play-region-timeline" data-region="timeline" style={{ borderColor: t.bd }}>
          <PhaseControls />
        </section>
      </div>
    );
  }

  return (
    <div
      className={`play-workspace play-workspace-${layout} ${sheetOpen ? 'is-coaching-open' : ''}`}
      data-testid={`play-workspace-${layout}`}
      style={workspaceStyle}
    >
      <header className="play-mobile-title">
        <button
          type="button"
          className="play-mobile-library-trigger"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? 'Hide play library' : 'Open play library'}
          aria-expanded={sidebarOpen}
        >
          <PlayIdentity play={currentReplayPlay} color={categoryColor} text={t.tx} muted={t.td} />
          <span className="play-mobile-library-hint" aria-hidden="true">
            Browse <ChevronDown />
          </span>
        </button>
        <MobileViewModeSwitch />
      </header>

      <section className="play-mobile-rink" data-region="rink" aria-label="Rink view">
        <ReplayTeachingCue accent={currentPhaseColor}>
          {currentPlay?.faceoff ? <FaceoffOutcomeControl compact /> : null}
        </ReplayTeachingCue>
        <div className="play-rink-frame">
          <SceneRink2D
            scene={currentReplayScene}
            time={playbackTime}
            roleFocusMode={roleFocusMode}
            selectedPosition={selectedPosition}
            showOpponents={showOpponents}
            mirrored={isMirrored}
            coverageEnabled={showCoverage}
            coverageLane={currentReplayPlay?.lane}
          />
        </div>
      </section>

      <section className="play-mobile-timeline" data-region="timeline">
        <PhaseControls compact />
      </section>

      <MobileTeamPlan
        aria-label="team plan and view tools"
        className="play-bottom-sheet"
        contentClassName="play-bottom-sheet-content"
        fallbackText={phase?.desc}
        jobs={teamJobs}
        onToggle={() => setSheetOpen((open) => !open)}
        open={sheetOpen}
      >
        <ResponsibilityPanel embedded jobs={teamJobs} />
        <div
          className="play-mobile-view-tools"
          role="group"
          aria-label="2D rink view tools"
          style={{ '--play-tool-count': coverageAvailable ? 3 : 2 }}
        >
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
          {coverageAvailable ? (
            <CoverageVisibilityControl
              compact
              enabled={showCoverage}
              onChange={setShowCoverage}
            />
          ) : null}
        </div>
        <StrategyButton color={categoryColor} onClick={() => setStrategyOpen(true)} />
        <PlayNavigation plays={lanePlays} playIdx={playIdx} goPlay={goPlay} muted={t.tm} border={t.bd} />
      </MobileTeamPlan>
    </div>
  );
}
