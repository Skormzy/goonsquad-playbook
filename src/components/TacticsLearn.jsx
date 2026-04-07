import { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { TACTICS, TACTICAL_COLORS } from '../data/tactics';
import { BALL_COLOR } from '../data/plays';
import RinkSVG from './RinkSVG';

const TC = TACTICAL_COLORS;

function LegendItem({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, border: '1px solid rgba(255,255,255,0.3)' }} />
      <span>{label}</span>
    </div>
  );
}

export default function TacticsLearn() {
  const { theme, themes } = useTheme();
  const t = themes[theme];

  const [activePrinciple, setActivePrinciple] = useState(0);
  const [activeTab, setActiveTab] = useState('mistake');
  const [currentPhase, setCurrentPhase] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [prevPhasePositions, setPrevPhasePositions] = useState(null);
  const restartTimerRef = useRef(null);
  const cancelRestartTimer = useCallback(() => {
    clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
  }, []);

  const principle = TACTICS[activePrinciple];
  const scene = activeTab === 'mistake' ? principle.mistakeScene : principle.correctScene;
  const phase = scene.phases[currentPhase];
  const totalPhases = scene.phases.length;

  const phaseData = {
    pos: phase.our,
    opp: phase.opp,
    ball: phase.ball,
    arrows: phase.arrows,
  };

  const coverage = scene.coverage || null;

  // Unmount cleanup: cancel any pending restart timer
  useEffect(() => cancelRestartTimer, [cancelRestartTimer]);

  useEffect(() => {
    if (!isPlaying) return;
    const ms = (phase.duration * 1000) / speed;
    const timer = setTimeout(() => {
      if (currentPhase < totalPhases - 1) {
        setPrevPhasePositions(scene.phases[currentPhase].our);
        setCurrentPhase(p => p + 1);
      } else {
        setIsPlaying(false);
      }
    }, ms);
    return () => clearTimeout(timer);
  }, [isPlaying, currentPhase, speed, phase.duration, totalPhases, scene]);

  const selectPrinciple = useCallback((i) => {
    cancelRestartTimer();
    setActivePrinciple(i);
    setCurrentPhase(0);
    setIsPlaying(false);
    setPrevPhasePositions(null);
  }, [cancelRestartTimer]);

  const switchTab = useCallback((tab) => {
    cancelRestartTimer();
    setActiveTab(tab);
    setCurrentPhase(0);
    setIsPlaying(false);
    setPrevPhasePositions(null);
  }, [cancelRestartTimer]);

  const goPhase = useCallback((n) => {
    // Cancel before bounds check: any navigation intent during the 80ms
    // restart window should suppress the pending restart.
    cancelRestartTimer();
    if (n < 0 || n >= totalPhases) return;
    setPrevPhasePositions(scene.phases[currentPhase].our);
    setCurrentPhase(n);
  }, [cancelRestartTimer, totalPhases, scene, currentPhase]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      cancelRestartTimer();
      setIsPlaying(false);
    } else {
      if (currentPhase >= totalPhases - 1) {
        setPrevPhasePositions(null);
        setCurrentPhase(0);
        cancelRestartTimer();
        const id = setTimeout(() => { if (restartTimerRef.current === id) { restartTimerRef.current = null; setIsPlaying(true); } }, 80);
        restartTimerRef.current = id;
      } else {
        setIsPlaying(true);
      }
    }
  }, [cancelRestartTimer, isPlaying, currentPhase, totalPhases]);

  useEffect(() => {
    const handler = (e) => {
      if (e.target instanceof Element && e.target.closest('button,input,select,textarea,[contenteditable="true"]')) return;
      if (e.key === 'ArrowRight') goPhase(currentPhase + 1);
      else if (e.key === 'ArrowLeft') goPhase(currentPhase - 1);
      else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentPhase, goPhase, togglePlay]);

  const tabAccent = activeTab === 'mistake' ? TC.mistake : TC.defense;
  const phaseColor = activeTab === 'mistake' ? TC.mistake : TC.defense;

  const btnBase = {
    borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600,
    fontFamily: "'Trebuchet MS','Lucida Grande',sans-serif",
  };

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '8px 6px', overflowY: 'auto', maxHeight: '100vh',
    }}>
      {/* Principle selector — full-width dropdown, works at any screen size */}
      <div style={{ width: '100%', maxWidth: 380, padding: '0 8px 8px' }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 2, color: t.td,
          fontFamily: 'monospace', marginBottom: 4,
        }}>
          PRINCIPLE {activePrinciple + 1} OF {TACTICS.length}
        </div>
        <select
          value={activePrinciple}
          onChange={(e) => selectPrinciple(Number(e.target.value))}
          style={{
            width: '100%', padding: '8px 10px', borderRadius: 6,
            border: `1px solid ${t.bd}`, background: t.cb,
            color: t.tx, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            fontFamily: "'Trebuchet MS','Lucida Grande',sans-serif",
          }}
        >
          {TACTICS.map((tactic, i) => (
            <option key={tactic.id} value={i}>
              {tactic.title}
            </option>
          ))}
        </select>
      </div>

      {/* Category badge */}
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 2, color: TC.defense,
        background: `${TC.defense}18`, padding: '2px 10px', borderRadius: 10,
        marginBottom: 4, fontFamily: 'monospace',
      }}>
        {principle.category.toUpperCase()}
      </div>

      {/* Title and subtitle */}
      <div style={{ textAlign: 'center', marginBottom: 2 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: t.tx, lineHeight: 1.2 }}>
          {principle.title}
        </div>
        <div style={{ fontSize: 10, color: t.tm, marginTop: 2 }}>
          {principle.subtitle}
        </div>
      </div>

      {/* Principle brief */}
      <div style={{
        fontSize: 10, color: t.tm, textAlign: 'center', maxWidth: 340,
        lineHeight: 1.45, margin: '4px 0 8px', padding: '0 8px',
      }}>
        {principle.principle}
      </div>

      {/* Tab toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button
          onClick={() => switchTab('mistake')}
          style={{
            ...btnBase,
            padding: '6px 14px',
            border: `2px solid ${activeTab === 'mistake' ? TC.mistake : t.bd}`,
            background: activeTab === 'mistake' ? `${TC.mistake}20` : 'transparent',
            color: activeTab === 'mistake' ? TC.mistake : t.tm,
          }}
        >
          The Mistake
        </button>
        <button
          onClick={() => switchTab('correct')}
          style={{
            ...btnBase,
            padding: '6px 14px',
            border: `2px solid ${activeTab === 'correct' ? TC.defense : t.bd}`,
            background: activeTab === 'correct' ? `${TC.defense}20` : 'transparent',
            color: activeTab === 'correct' ? TC.defense : t.tm,
          }}
        >
          The Right Way
        </button>
      </div>

      {/* Rink — same RinkSVG as the Plays section */}
      <div style={{ width: '100%', maxWidth: 380, margin: '0 auto' }}>
        <RinkSVG
          mode="tactics"
          phaseData={phaseData}
          prevPhaseData={prevPhasePositions}
          coverage={coverage}
        />
      </div>

      {/* Caption below rink */}
      <div style={{
        textAlign: 'center', padding: '8px 12px', minHeight: 36, maxWidth: 380,
        fontFamily: 'monospace', fontSize: 11, fontWeight: 600,
        color: tabAccent, lineHeight: 1.4,
      }}>
        &ldquo;{phase.caption}&rdquo;
      </div>

      {/* Phase indicator */}
      <div style={{
        fontSize: 9, color: t.tm, letterSpacing: 1, fontFamily: 'monospace', marginBottom: 4,
      }}>
        PHASE {currentPhase + 1}/{totalPhases}
      </div>

      {/* Playback controls */}
      <div style={{ display: 'flex', gap: 5, alignItems: 'center', margin: '2px 0' }}>
        <button
          onClick={() => goPhase(currentPhase - 1)}
          disabled={currentPhase === 0}
          style={{
            ...btnBase,
            padding: '6px 10px',
            border: `1px solid ${t.bd}`, background: t.cb,
            color: currentPhase === 0 ? t.td : t.tx,
            cursor: currentPhase === 0 ? 'default' : 'pointer',
          }}
        >&#9664;</button>
        <button
          onClick={togglePlay}
          style={{
            ...btnBase,
            padding: '6px 16px', fontWeight: 700,
            border: `2px solid ${tabAccent}`,
            background: isPlaying ? tabAccent : 'transparent',
            color: isPlaying ? '#fff' : tabAccent,
          }}
        >{isPlaying ? '\u23F8' : '\u25B6'}</button>
        <button
          onClick={() => goPhase(currentPhase + 1)}
          disabled={currentPhase >= totalPhases - 1}
          style={{
            ...btnBase,
            padding: '6px 10px',
            border: `1px solid ${t.bd}`, background: t.cb,
            color: currentPhase >= totalPhases - 1 ? t.td : t.tx,
            cursor: currentPhase >= totalPhases - 1 ? 'default' : 'pointer',
          }}
        >&#9654;</button>
        <select
          value={speed}
          onChange={e => setSpeed(Number(e.target.value))}
          style={{
            padding: '4px 6px', borderRadius: 4,
            border: `1px solid ${t.bd}`, background: t.cb,
            color: t.tm, fontSize: 10, cursor: 'pointer',
            fontFamily: 'monospace',
          }}
        >
          <option value={0.5}>0.5x</option>
          <option value={1}>1x</option>
          <option value={2}>2x</option>
        </select>
      </div>

      {/* Phase dots */}
      <div style={{ display: 'flex', gap: 6, margin: '6px 0 10px' }}>
        {scene.phases.map((_, i) => (
          <button
            key={i}
            onClick={() => goPhase(i)}
            style={{
              width: 10, height: 10, borderRadius: '50%',
              border: 'none', cursor: 'pointer', padding: 0,
              background: i === currentPhase ? phaseColor : i < currentPhase ? t.tm : t.bd,
              boxShadow: i === currentPhase ? `0 0 6px ${phaseColor}` : 'none',
              transition: 'all .2s',
            }}
          />
        ))}
      </div>

      {/* Color legend */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center',
        padding: '6px 10px', fontSize: 9, color: t.tm, fontFamily: 'monospace',
        borderTop: `1px solid ${t.bd}`, borderBottom: `1px solid ${t.bd}`,
        width: '100%', maxWidth: 380,
      }}>
        <LegendItem color={t.pc.C} label="Our Team" />
        <LegendItem color={t.oc} label="Opponent" />
        <LegendItem color={BALL_COLOR} label="Ball" />
        {coverage && <LegendItem color="#16a34a" label="Tight" />}
        {coverage && <LegendItem color="#d97706" label="Drifting" />}
        {coverage && <LegendItem color="#dc2626" label="Lost" />}
      </div>

      {/* Why it matters */}
      <div style={{ maxWidth: 380, width: '100%', padding: '10px 8px 4px' }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 2, color: t.td,
          fontFamily: 'monospace', marginBottom: 4,
        }}>
          WHY IT MATTERS
        </div>
        <div style={{ fontSize: 11, color: t.tm, lineHeight: 1.5 }}>
          {principle.why}
        </div>
      </div>

      {/* Key points */}
      <div style={{ maxWidth: 380, width: '100%', padding: '8px 8px 20px' }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 2, color: t.td,
          fontFamily: 'monospace', marginBottom: 6,
        }}>
          KEY POINTS
        </div>
        {principle.keyPoints.map((kp, i) => (
          <div key={i} style={{
            display: 'flex', gap: 8, marginBottom: 6, fontSize: 11,
            color: t.tx, lineHeight: 1.4,
          }}>
            <span style={{ color: TC.defense, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
            <span>{kp}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
