import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { TACTICAL_COLORS } from '../data/tactics';
import { BALL_COLOR } from '../data/plays';
import {
  CORE_PLAYS as PLAYS,
  CORE_TACTICS as TACTICS,
  itemsForCurriculumLane,
} from '../data/coreCatalog';
import { CAT_COLORS } from '../context/ThemeContext';
import {
  contextualCoverageForReplay,
  coverageAssignmentsForReplay,
  hasCoverageAssignments,
} from '../play-engine/coverageAssignments';
import CoverageVisibilityControl from './CoverageVisibilityControl';
import CurriculumLaneSwitch from './CurriculumLaneSwitch';
import MobileTeamPlan from './MobileTeamPlan';
import MobileViewModeSwitch from './MobileViewModeSwitch';
import PlaybackControls from './PlaybackControls';
import ReplayTeachingCue from './ReplayTeachingCue';
import SceneRink2D from './SceneRink2D';
import TeamJobsPanel from './TeamJobsPanel';
import { teamJobsForActivePhase } from '../play-engine/teamJobs';

const TC = TACTICAL_COLORS;

const TABS = [
  { id: 'mistake', label: 'The Mistake', color: TC.mistake },
  { id: 'correct', label: 'The Right Way', color: TC.defense },
];

function LegendItem({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, border: '1px solid rgba(255,255,255,0.25)' }} />
      <span>{label}</span>
    </div>
  );
}

function useIsDesktop() {
  const [v, setV] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const h = (e) => setV(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return v;
}

export default function TacticsLearn() {
  const { theme, themes } = useTheme();
  const t = themes[theme];
  const isDesktop = useIsDesktop();
  const mobileBrowserSummaryRef = useRef(null);
  const {
    selectedTactic: principle,
    selectedTacticId,
    setSelectedTacticId,
    strategyVariant: activeTab,
    setStrategyVariant,
    currentPhase,
    setCurrentPhase,
    currentReplayPhases,
    currentReplayScene,
    isMirrored,
    playbackTime,
    roleFocusMode,
    selectedPosition,
    setIsPlaying,
    setCurrentPlay,
    setActiveView,
    cancelPlaybackRestart,
    setPreviousPositions,
    showCoverage,
    setShowCoverage,
  } = useApp();
  const lane = principle?.lane ?? 'defence';
  const laneTactics = useMemo(
    () => itemsForCurriculumLane(TACTICS, lane),
    [lane],
  );
  const activePrinciple = Math.max(0, laneTactics.findIndex((tactic) => tactic.id === selectedTacticId));
  const scene = activeTab === 'mistake' ? principle.mistakeScene : principle.correctScene;
  const phase = scene.phases[currentPhase] ?? scene.phases[0];
  const availableCoverage = coverageAssignmentsForReplay(currentReplayScene, playbackTime);
  const coverage = contextualCoverageForReplay({
    enabled: showCoverage,
    lane,
    replay: currentReplayScene,
    time: playbackTime,
  });
  const coverageAvailable = lane === 'defence' && hasCoverageAssignments(availableCoverage);
  const tabAccent = activeTab === 'mistake' ? TC.mistake : TC.defense;
  const [rolePlanOpen, setRolePlanOpen] = useState(false);
  const teamJobs = useMemo(
    () => teamJobsForActivePhase(currentReplayPhases, currentPhase, {
      isMirrored,
      fallbackResponsibilities: currentReplayScene?.presentation?.responsibilities ?? [],
    }),
    [currentPhase, currentReplayPhases, currentReplayScene, isMirrored],
  );

  const selectPrinciple = useCallback((i) => {
    cancelPlaybackRestart();
    setSelectedTacticId(laneTactics[i]?.id);
  }, [cancelPlaybackRestart, laneTactics, setSelectedTacticId]);

  const selectLane = useCallback((nextLane) => {
    if (nextLane === lane) return;
    const first = itemsForCurriculumLane(TACTICS, nextLane)[0];
    if (first) {
      cancelPlaybackRestart();
      setSelectedTacticId(first.id);
    }
  }, [cancelPlaybackRestart, lane, setSelectedTacticId]);

  const switchTab = useCallback((tab) => {
    cancelPlaybackRestart();
    setStrategyVariant(tab);
  }, [cancelPlaybackRestart, setStrategyVariant]);

  const navigateToPlay = useCallback((playId) => {
    const play = PLAYS.find(p => p.id === playId);
    if (!play) return;
    cancelPlaybackRestart();
    setPreviousPositions(null);
    setCurrentPlay(play);
    setCurrentPhase(0);
    setIsPlaying(false);
    setActiveView('playbook');
  }, [cancelPlaybackRestart, setPreviousPositions, setCurrentPlay, setCurrentPhase, setIsPlaying, setActiveView]);

  const FF = 'var(--font-body)';
  // ─── UI blocks ───

  const selectorBlock = (
    <div className="tactics-selector" style={{ width: '100%', padding: isDesktop ? '0 0 6px' : '0 6px 6px' }}>
      <CurriculumLaneSwitch
        compact
        items={TACTICS}
        onChange={selectLane}
        value={lane}
      />
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0, color: t.td, fontFamily: 'var(--font-display)', marginBottom: 5 }}>
        {lane.toUpperCase()} PRINCIPLE {activePrinciple + 1} OF {laneTactics.length}
      </div>
      <select
        value={activePrinciple}
        onChange={(e) => {
          selectPrinciple(Number(e.target.value));
          const details = e.currentTarget.closest('details');
          if (details) {
            details.removeAttribute('open');
            requestAnimationFrame(() => mobileBrowserSummaryRef.current?.focus({ preventScroll: true }));
          }
        }}
        aria-label="Strategy principle"
        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${t.bd}`, background: t.cb, color: t.tx, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-display)' }}
      >
        {laneTactics.map((tactic, i) => (
          <option key={tactic.id} value={i}>{tactic.title}</option>
        ))}
      </select>
    </div>
  );

  const mobileStrategyBrowser = (
    <details className="tactics-mobile-browser">
      <summary ref={mobileBrowserSummaryRef} aria-label="Browse strategy principles">
        <span>
          {lane.toUpperCase()} {activePrinciple + 1} / {laneTactics.length}
        </span>
        <strong>{principle.title}</strong>
        <ChevronDown aria-hidden="true" />
      </summary>
      <div>
        {selectorBlock}
      </div>
    </details>
  );

  const tabToggleBlock = (
    <div className="tactics-comparison" role="group" aria-label="Strategy comparison" style={{ display: 'flex', background: t.cb, borderRadius: 8, padding: 2, marginBottom: 8, width: '100%' }}>
      {TABS.map(tab => (
        <button
          type="button"
          key={tab.id}
          onClick={() => switchTab(tab.id)}
          aria-pressed={activeTab === tab.id}
          style={{
            flex: 1, padding: '6px 8px', borderRadius: 6,
            fontSize: 13.5, fontWeight: 800, cursor: 'pointer',
            border: activeTab === tab.id ? `1px solid ${tab.color}44` : '1px solid transparent',
            background: activeTab === tab.id ? `${tab.color}22` : 'transparent',
            color: activeTab === tab.id ? tab.color : t.td,
            transition: 'all .15s', fontFamily: FF,
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  const rinkBlock = (
    <div className="tactics-rink-stage">
      {!isDesktop && <ReplayTeachingCue accent={tabAccent} />}
      <div className="tactics-rink" style={{ width: '100%' }}>
        <SceneRink2D
          scene={currentReplayScene}
          time={playbackTime}
          tactical
          roleFocusMode={roleFocusMode}
          selectedPosition={selectedPosition}
          coverageEnabled={showCoverage}
          coverageLane={lane}
          arrows={phase.arrows}
        />
      </div>
    </div>
  );

  const controlsBlock = (
    <div className="tactics-playback-shell" aria-label="Strategy playback">
      <PlaybackControls compact />
    </div>
  );

  const navBlock = (
    <div className="tactics-neighbor-nav" style={{ display: 'flex', gap: 6, width: '100%', margin: '2px 0 8px', padding: isDesktop ? 0 : '0 8px' }}>
      {activePrinciple > 0 ? (
        <button onClick={() => selectPrinciple(activePrinciple - 1)} style={{ flex: 1, padding: '7px 9px', textAlign: 'left', borderRadius: 5, border: `1px solid ${t.bd}`, background: 'transparent', color: t.tm, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FF }}>
          ← {laneTactics[activePrinciple - 1].title}
        </button>
      ) : <div style={{ flex: 1 }} />}
      {activePrinciple < laneTactics.length - 1 ? (
        <button onClick={() => selectPrinciple(activePrinciple + 1)} style={{ flex: 1, padding: '7px 9px', textAlign: 'right', borderRadius: 5, border: `1px solid ${t.bd}`, background: 'transparent', color: t.tm, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: FF }}>
          {laneTactics[activePrinciple + 1].title} →
        </button>
      ) : <div style={{ flex: 1 }} />}
    </div>
  );

  const laneAccent = principle.lane === 'offence' ? '#e3263f' : '#39d7ff';
  const categoryBadgeBlock = (
    <div className="tactics-category-badge" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0, color: laneAccent, background: `${laneAccent}18`, border: `1px solid ${laneAccent}33`, padding: '4px 10px', borderRadius: 5, marginBottom: 7, fontFamily: 'var(--font-display)', alignSelf: isDesktop ? 'flex-start' : 'center' }}>
      {principle.lane.toUpperCase()} / {principle.situation.toUpperCase()}
    </div>
  );

  const titleBlock = (
    <div className="tactics-title-block" style={{ textAlign: isDesktop ? 'left' : 'center', marginBottom: 7 }}>
      <div style={{ fontSize: isDesktop ? 28 : 22, fontFamily: 'var(--font-display)', fontWeight: 800, color: t.tx, lineHeight: 1.05 }}>{principle.title}</div>
      <div style={{ fontSize: isDesktop ? 14.5 : 14, color: t.tm, marginTop: 4, lineHeight: 1.4, fontFamily: FF }}>{principle.subtitle}</div>
    </div>
  );

  const principleTextBlock = (
    <div className="tactics-principle-copy" style={{ fontSize: isDesktop ? 15 : 14, color: t.tm, textAlign: isDesktop ? 'left' : 'center', maxWidth: isDesktop ? undefined : 340, lineHeight: 1.6, margin: '2px 0 12px', fontFamily: FF }}>
      {principle.principle}
    </div>
  );

  const legendBlock = (
    <div className="tactics-legend" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: isDesktop ? 'flex-start' : 'center', padding: '8px 0', fontSize: 12.5, color: t.tm, fontFamily: FF, borderTop: `1px solid ${t.bd}`, width: '100%', marginBottom: isDesktop ? 0 : 8 }}>
      <LegendItem color={t.pc.C} label="Our Team" />
      <LegendItem color={t.oc} label="Opponent" />
      <LegendItem color={BALL_COLOR} label="Ball" />
      {coverage && <LegendItem color="#16a34a" label="Tight" />}
      {coverage && <LegendItem color="#d97706" label="Drifting" />}
      {coverage && <LegendItem color="#dc2626" label="Lost" />}
      {coverageAvailable ? (
        <CoverageVisibilityControl
          compact
          enabled={showCoverage}
          onChange={setShowCoverage}
        />
      ) : null}
    </div>
  );

  const whyBlock = (
    <div className="tactics-why" style={{ width: '100%', paddingBottom: 4 }}>
      <div className="tactics-section-label" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0, color: t.td, fontFamily: 'var(--font-display)', marginBottom: 6 }}>WHY IT MATTERS</div>
      <div style={{ fontSize: isDesktop ? 15 : 14, color: t.tm, lineHeight: 1.6, fontFamily: FF }}>{principle.why}</div>
    </div>
  );

  const keyPointsBlock = (
    <div className="tactics-key-points" style={{ width: '100%', paddingBottom: isDesktop ? 8 : 16 }}>
      <div className="tactics-section-label" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0, color: t.td, fontFamily: 'var(--font-display)', marginBottom: 8 }}>KEY POINTS</div>
      <div className="tactics-key-points-list">
        {principle.keyPoints.map((kp, i) => (
          <div className="tactics-key-point" key={i} style={{ display: 'flex', gap: 8, marginBottom: 9, fontSize: 14, color: t.tx, lineHeight: 1.5, fontFamily: FF }}>
            <span style={{ color: TC.defense, fontWeight: 800, flexShrink: 0, fontFamily: 'var(--font-display)', fontSize: 14 }}>{i + 1}.</span>
            <span>{kp}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const linkedPlaysBlock = principle.linkedPlays.length > 0 && (
    <div className="tactics-linked-plays" style={{ width: '100%', paddingBottom: isDesktop ? 8 : 24, borderTop: `1px solid ${t.bd}`, paddingTop: 10 }}>
      <div className="tactics-section-label" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0, color: t.td, fontFamily: 'var(--font-display)', marginBottom: 8 }}>SEE IT IN PLAYS</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {principle.linkedPlays.map(playId => {
          const play = PLAYS.find(p => p.id === playId);
          if (!play) return null;
          const cc = CAT_COLORS[play.cat] || t.ac;
          return (
            <button
              className="tactics-linked-play"
              key={playId}
              onClick={() => navigateToPlay(playId)}
              style={{
                padding: '3px 10px', borderRadius: 12,
                border: `1px solid ${cc}55`,
                background: `${cc}14`,
                color: cc, cursor: 'pointer',
                fontSize: 13, fontWeight: 800, fontFamily: FF,
                transition: 'all .15s',
              }}
            >
              {play.n}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="tactics-learn" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 6px', overflowY: 'auto', maxHeight: '100%' }}>

      {isDesktop ? (
        // ─── DESKTOP: two-column ───
        <div className="tactics-desktop-workspace">

          {/* Left column: command deck, transport, rink, and legend */}
          <div className="tactics-rink-column">
            <div className="tactics-desktop-command-row">
              {selectorBlock}
              {tabToggleBlock}
            </div>
            <div className="tactics-desktop-transport">
              {controlsBlock}
            </div>
            <div className="tactics-desktop-rink">
              {rinkBlock}
            </div>
            <div className="tactics-desktop-legend">
              {legendBlock}
            </div>
          </div>

          {/* Right column: principle info */}
          <div className="tactics-coaching-column">
            <div className="tactics-coaching-intro">
              {categoryBadgeBlock}
              {titleBlock}
              {principleTextBlock}
            </div>
            <div className="tactics-role-plan">
              <TeamJobsPanel
                compact
                eyebrow={`PHASE ${currentPhase + 1} ROLE PLAN`}
                jobs={teamJobs}
                meta={phase?.caption ?? null}
                summary={phase?.title ?? principle.title}
              />
            </div>
            <div className="tactics-coaching-detail">
              {whyBlock}
              {keyPointsBlock}
            </div>
            {linkedPlaysBlock}
          </div>
        </div>
      ) : (
        // ─── MOBILE: single column ───
        <div className="tactics-mobile-workspace" style={{ width: '100%', maxWidth: 430, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="tactics-mobile-topbar">
            {mobileStrategyBrowser}
            <MobileViewModeSwitch />
          </div>
          {tabToggleBlock}
          <div className="tactics-mobile-rink" data-mobile-strategy-rink>
            {rinkBlock}
          </div>
          <MobileTeamPlan
            className="tactics-mobile-role-plan"
            fallbackText={phase?.caption}
            jobs={teamJobs}
            onToggle={() => setRolePlanOpen((open) => !open)}
            open={rolePlanOpen}
          >
            <TeamJobsPanel
              compact
              eyebrow={`PHASE ${currentPhase + 1} ROLE PLAN`}
              jobs={teamJobs}
              meta={phase?.caption ?? null}
              summary={phase?.title ?? principle.title}
            />
          </MobileTeamPlan>
          <div className="tactics-mobile-transport">
            {controlsBlock}
          </div>
          {navBlock}
          <details className="tactics-mobile-coaching">
            <summary>Coaching notes</summary>
            <div>
              {principleTextBlock}
              {legendBlock}
              {whyBlock}
              {keyPointsBlock}
              {linkedPlaysBlock}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
