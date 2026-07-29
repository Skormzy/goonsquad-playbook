import { useState, useEffect, useCallback, useMemo } from 'react';
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
import CurriculumLaneSwitch from './CurriculumLaneSwitch';
import RinkSVG from './RinkSVG';

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
  const {
    selectedTactic: principle,
    selectedTacticId,
    setSelectedTacticId,
    strategyVariant: activeTab,
    setStrategyVariant,
    currentPhase,
    setCurrentPhase,
    playbackTime,
    setPlaybackTime,
    isPlaying,
    setIsPlaying,
    speed,
    setSpeed,
    setCurrentPlay,
    setActiveView,
    cancelPlaybackRestart,
    setPreviousPositions,
  } = useApp();
  const lane = principle?.lane ?? 'defence';
  const laneTactics = useMemo(
    () => itemsForCurriculumLane(TACTICS, lane),
    [lane],
  );
  const activePrinciple = Math.max(0, laneTactics.findIndex((tactic) => tactic.id === selectedTacticId));
  const scene = activeTab === 'mistake' ? principle.mistakeScene : principle.correctScene;
  const phase = scene.phases[currentPhase] ?? scene.phases[0];
  const totalPhases = scene.phases.length;
  const prevPhasePositions = currentPhase > 0 ? scene.phases[currentPhase - 1]?.our ?? null : null;

  const phaseData = { pos: phase.our, opp: phase.opp, ball: phase.ball, arrows: phase.arrows };
  const coverage = scene.coverage || null;
  const tabAccent = activeTab === 'mistake' ? TC.mistake : TC.defense;
  const rinkMax = isDesktop ? 420 : 430;

  const selectPrinciple = useCallback((i) => {
    cancelPlaybackRestart();
    setSelectedTacticId(laneTactics[i]?.id);
    setStrategyVariant('mistake');
  }, [cancelPlaybackRestart, laneTactics, setSelectedTacticId, setStrategyVariant]);

  const selectLane = useCallback((nextLane) => {
    if (nextLane === lane) return;
    const first = itemsForCurriculumLane(TACTICS, nextLane)[0];
    if (first) {
      cancelPlaybackRestart();
      setSelectedTacticId(first.id);
      setStrategyVariant('mistake');
    }
  }, [cancelPlaybackRestart, lane, setSelectedTacticId, setStrategyVariant]);

  const switchTab = useCallback((tab) => {
    cancelPlaybackRestart();
    setStrategyVariant(tab);
  }, [cancelPlaybackRestart, setStrategyVariant]);

  const goPhase = useCallback((n) => {
    cancelPlaybackRestart();
    if (n < 0 || n >= totalPhases) return;
    setIsPlaying(false);
    setCurrentPhase(n);
  }, [cancelPlaybackRestart, totalPhases, setCurrentPhase, setIsPlaying]);

  const togglePlay = useCallback(() => {
    cancelPlaybackRestart();
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (playbackTime >= scene.phases.reduce((sum, item) => sum + item.duration, 0) - 0.05) {
      setPlaybackTime(0);
    }
    setIsPlaying(true);
  }, [cancelPlaybackRestart, isPlaying, playbackTime, scene.phases, setIsPlaying, setPlaybackTime]);

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

  const FF = "'Trebuchet MS','Lucida Grande',sans-serif";
  const truncP = (title, n = 26) => title.length > n ? title.slice(0, n) + '…' : title;

  // ─── UI blocks ───

  const selectorBlock = (
    <div className="tactics-selector" style={{ width: '100%', padding: isDesktop ? '0 0 6px' : '0 6px 6px' }}>
      <CurriculumLaneSwitch
        compact
        items={TACTICS}
        onChange={selectLane}
        value={lane}
      />
      <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 2, color: t.td, fontFamily: 'monospace', marginBottom: 4 }}>
        {lane.toUpperCase()} PRINCIPLE {activePrinciple + 1} OF {laneTactics.length}
      </div>
      <select
        value={activePrinciple}
        onChange={(e) => selectPrinciple(Number(e.target.value))}
        aria-label="Strategy principle"
        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: `1px solid ${t.bd}`, background: t.cb, color: t.tx, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FF }}
      >
        {laneTactics.map((tactic, i) => (
          <option key={tactic.id} value={i}>{tactic.title}</option>
        ))}
      </select>
    </div>
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
            fontSize: isDesktop ? 9.5 : 10.5, fontWeight: 700, cursor: 'pointer',
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
    <div className="tactics-rink" style={{ width: '100%' }}>
      <RinkSVG
        mode="tactics"
        phaseData={phaseData}
        prevPhaseData={prevPhasePositions}
        coverage={coverage}
      />
    </div>
  );

  const captionBlock = (
    <div style={{
      textAlign: 'center', padding: '8px 12px', minHeight: 36,
      fontFamily: 'monospace', fontSize: isDesktop ? 10 : 11, fontWeight: 600,
      color: tabAccent, lineHeight: 1.4,
      background: `${tabAccent}0a`,
      borderRadius: 6, marginTop: 2, width: '100%',
    }} aria-live="polite">
      "{phase.caption}"
    </div>
  );

  const phaseIndicatorBlock = (
    <div style={{ fontSize: 8.5, color: t.tm, letterSpacing: 1, fontFamily: 'monospace', marginTop: 6, marginBottom: 3 }}>
      PHASE {currentPhase + 1} / {totalPhases}
    </div>
  );

  const controlsBlock = (
    <div className="tactics-playback" role="group" aria-label="Strategy playback" style={{ display: 'flex', gap: 5, alignItems: 'center', margin: '2px 0 4px' }}>
      <button
        type="button"
        className="tactics-playback-button"
        onClick={() => goPhase(currentPhase - 1)}
        disabled={currentPhase === 0}
        aria-label="Previous strategy phase"
        style={{ padding: '6px 10px', borderRadius: 5, fontFamily: FF, border: `1px solid ${t.bd}`, background: t.cb, color: currentPhase === 0 ? t.td : t.tx, cursor: currentPhase === 0 ? 'default' : 'pointer', fontSize: 11, fontWeight: 600 }}
      >◀</button>
      <button
        type="button"
        className="tactics-playback-button is-primary"
        onClick={togglePlay}
        aria-pressed={isPlaying}
        aria-label={isPlaying ? 'Pause strategy playback' : 'Play strategy playback'}
        style={{ padding: '6px 16px', borderRadius: 5, fontFamily: FF, border: `2px solid ${tabAccent}`, background: isPlaying ? tabAccent : 'transparent', color: isPlaying ? '#fff' : tabAccent, fontSize: 11, fontWeight: 800, boxShadow: isPlaying ? `0 0 10px ${tabAccent}44` : 'none', transition: 'all .12s' }}
      >
        {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
      </button>
      <button
        type="button"
        className="tactics-playback-button"
        onClick={() => goPhase(currentPhase + 1)}
        disabled={currentPhase >= totalPhases - 1}
        aria-label="Next strategy phase"
        style={{ padding: '6px 10px', borderRadius: 5, fontFamily: FF, border: `1px solid ${t.bd}`, background: t.cb, color: currentPhase >= totalPhases - 1 ? t.td : t.tx, cursor: currentPhase >= totalPhases - 1 ? 'default' : 'pointer', fontSize: 11, fontWeight: 600 }}
      >▶</button>
      <div role="group" aria-label="Strategy playback speed" style={{ display: 'flex' }}>
        {[0.5, 1, 2].map((s, i) => (
          <button
            type="button"
            className="tactics-speed-button"
            key={s}
            onClick={() => setSpeed(s)}
            aria-label={`${s}x strategy speed`}
            aria-pressed={speed === s}
            style={{ padding: '4px 7px', borderStyle: 'solid', borderWidth: 1, borderColor: speed === s ? tabAccent : t.bd, borderLeftWidth: i !== 0 ? 0 : 1, background: speed === s ? `${tabAccent}22` : t.cb, color: speed === s ? tabAccent : t.td, fontSize: 9, fontWeight: 700, fontFamily: 'monospace', cursor: 'pointer', borderRadius: i === 0 ? '4px 0 0 4px' : i === 2 ? '0 4px 4px 0' : '0', transition: 'all .1s' }}
          >
            {s === 0.5 ? '½×' : `${s}×`}
          </button>
        ))}
      </div>
    </div>
  );

  const phaseDotsBlock = (
    <div className="tactics-phase-dots" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2, padding: '0 4px', margin: '4px 0 8px', minWidth: 40 }}>
      {totalPhases > 1 && (
        <>
          <div style={{ position: 'absolute', left: 10, right: 10, top: '50%', height: 2, background: t.bd, transform: 'translateY(-50%)', borderRadius: 1, zIndex: 0 }} />
          <div style={{ position: 'absolute', left: 10, top: '50%', height: 2, width: `calc(${(currentPhase / Math.max(totalPhases - 1, 1)) * 100}% - 20px)`, background: tabAccent, transform: 'translateY(-50%)', borderRadius: 1, zIndex: 0, transition: 'width .3s ease', opacity: 0.7 }} />
        </>
      )}
      {scene.phases.map((_, i) => (
        <button
          type="button"
          className="tactics-phase-dot"
          data-active={i === currentPhase}
          data-complete={i < currentPhase}
          key={i}
          onClick={() => goPhase(i)}
          aria-label={`Go to strategy phase ${i + 1}`}
          aria-current={i === currentPhase ? 'step' : undefined}
          style={{ '--tactics-dot': i === currentPhase ? tabAccent : i < currentPhase ? `${t.tm}aa` : t.bd }}
        />
      ))}
    </div>
  );

  const navBlock = (
    <div className="tactics-neighbor-nav" style={{ display: 'flex', gap: 6, width: '100%', margin: '2px 0 8px', padding: isDesktop ? 0 : '0 8px' }}>
      {activePrinciple > 0 ? (
        <button onClick={() => selectPrinciple(activePrinciple - 1)} style={{ flex: 1, padding: '5px 8px', textAlign: 'left', borderRadius: 5, border: `1px solid ${t.bd}`, background: 'transparent', color: t.tm, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: FF }}>
          ← {truncP(laneTactics[activePrinciple - 1].title)}
        </button>
      ) : <div style={{ flex: 1 }} />}
      {activePrinciple < laneTactics.length - 1 ? (
        <button onClick={() => selectPrinciple(activePrinciple + 1)} style={{ flex: 1, padding: '5px 8px', textAlign: 'right', borderRadius: 5, border: `1px solid ${t.bd}`, background: 'transparent', color: t.tm, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: FF }}>
          {truncP(laneTactics[activePrinciple + 1].title)} →
        </button>
      ) : <div style={{ flex: 1 }} />}
    </div>
  );

  const laneAccent = principle.lane === 'offence' ? '#e3263f' : '#39d7ff';
  const categoryBadgeBlock = (
    <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 2, color: laneAccent, background: `${laneAccent}18`, border: `1px solid ${laneAccent}33`, padding: '2px 10px', borderRadius: 10, marginBottom: 4, fontFamily: 'monospace', alignSelf: isDesktop ? 'flex-start' : 'center' }}>
      {principle.lane.toUpperCase()} / {principle.situation.toUpperCase()}
    </div>
  );

  const titleBlock = (
    <div style={{ textAlign: isDesktop ? 'left' : 'center', marginBottom: 4 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: t.tx, lineHeight: 1.2 }}>{principle.title}</div>
      <div style={{ fontSize: 10, color: t.tm, marginTop: 2, fontFamily: FF }}>{principle.subtitle}</div>
    </div>
  );

  const principleTextBlock = (
    <div style={{ fontSize: 10, color: t.tm, textAlign: isDesktop ? 'left' : 'center', maxWidth: isDesktop ? undefined : 340, lineHeight: 1.5, margin: '2px 0 8px', fontFamily: FF }}>
      {principle.principle}
    </div>
  );

  const legendBlock = (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: isDesktop ? 'flex-start' : 'center', padding: '6px 0', fontSize: 9, color: t.tm, fontFamily: 'monospace', borderTop: `1px solid ${t.bd}`, width: '100%', marginBottom: isDesktop ? 0 : 8 }}>
      <LegendItem color={t.pc.C} label="Our Team" />
      <LegendItem color={t.oc} label="Opponent" />
      <LegendItem color={BALL_COLOR} label="Ball" />
      {coverage && <LegendItem color="#16a34a" label="Tight" />}
      {coverage && <LegendItem color="#d97706" label="Drifting" />}
      {coverage && <LegendItem color="#dc2626" label="Lost" />}
    </div>
  );

  const whyBlock = (
    <div style={{ width: '100%', paddingBottom: 4 }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 2, color: t.td, fontFamily: 'monospace', marginBottom: 4 }}>WHY IT MATTERS</div>
      <div style={{ fontSize: 11, color: t.tm, lineHeight: 1.55, fontFamily: FF }}>{principle.why}</div>
    </div>
  );

  const keyPointsBlock = (
    <div style={{ width: '100%', paddingBottom: isDesktop ? 8 : 16 }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 2, color: t.td, fontFamily: 'monospace', marginBottom: 6 }}>KEY POINTS</div>
      {principle.keyPoints.map((kp, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 7, fontSize: 11, color: t.tx, lineHeight: 1.4, fontFamily: FF }}>
          <span style={{ color: TC.defense, fontWeight: 800, flexShrink: 0, fontFamily: 'monospace', fontSize: 10.5 }}>{i + 1}.</span>
          <span>{kp}</span>
        </div>
      ))}
    </div>
  );

  const linkedPlaysBlock = principle.linkedPlays.length > 0 && (
    <div style={{ width: '100%', paddingBottom: isDesktop ? 8 : 24, borderTop: `1px solid ${t.bd}`, paddingTop: 10 }}>
      <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 2, color: t.td, fontFamily: 'monospace', marginBottom: 7 }}>SEE IT IN PLAYS</div>
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
                fontSize: 9.5, fontWeight: 700, fontFamily: FF,
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

          {/* Left column: selector, tabs, rink, caption, controls, legend, nav */}
          <div className="tactics-rink-column" style={{ width: rinkMax }}>
            {selectorBlock}
            {tabToggleBlock}
            {rinkBlock}
            {captionBlock}
            {phaseIndicatorBlock}
            {controlsBlock}
            {phaseDotsBlock}
            {legendBlock}
            {navBlock}
          </div>

          {/* Right column: principle info */}
          <div className="tactics-coaching-column">
            {categoryBadgeBlock}
            {titleBlock}
            {principleTextBlock}
            {whyBlock}
            {keyPointsBlock}
            {linkedPlaysBlock}
          </div>
        </div>
      ) : (
        // ─── MOBILE: single column ───
        <div className="tactics-mobile-workspace" style={{ width: '100%', maxWidth: 430, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {selectorBlock}
          {tabToggleBlock}
          <div className="tactics-mobile-rink" data-mobile-strategy-rink>
            {rinkBlock}
          </div>
          <div className="tactics-mobile-transport">
            {captionBlock}
            {phaseIndicatorBlock}
            {controlsBlock}
            {phaseDotsBlock}
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
