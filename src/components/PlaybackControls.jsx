import { useEffect, useRef } from 'react';
import {
  Pause,
  Play,
  Rewind,
  RotateCcw,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { formatPlaybackTime } from '../play-engine/formatPlaybackTime';
import { PLAYBACK_SPEEDS } from '../play-engine/playbackSpeeds';
import { sceneTimeForPhase } from '../play-engine/synchronizePlayback';

function playbackSpeedLabel(value) {
  if (value === 0.25) return '¼x';
  if (value === 0.5) return '½x';
  return `${value}x`;
}

export default function PlaybackControls({ compact = false }) {
  const phaseRailRef = useRef(null);
  const phaseButtonRefs = useRef([]);
  const { theme, themes } = useTheme();
  const t = themes[theme];
  const {
    currentReplayScene: scene,
    currentReplayPhases,
    currentPhase,
    instructionPhase,
    setCurrentPhase,
    transitionToPhase,
    stepPhase,
    phaseTransitionTarget,
    playbackTime,
    setPlaybackTime,
    isPlaying,
    setIsPlaying,
    speed,
    setSpeed,
    setPreviousPositions,
    cancelPlaybackRestart,
  } = useApp();

  const phaseCount = currentReplayPhases.length;
  const timelineMax = scene?.duration ?? Math.max(phaseCount - 1, 1);
  const timelineValue = scene ? playbackTime : currentPhase;
  const timelineStep = scene ? 0.05 : 1;
  const navigationPhase = instructionPhase;
  const atEnd = scene
    ? timelineValue >= timelineMax - timelineStep
    : currentPhase >= phaseCount - 1;
  const progress = timelineMax > 0 ? timelineValue / timelineMax * 100 : 0;

  useEffect(() => {
    if (!compact || phaseCount <= 1) return;
    const rail = phaseRailRef.current;
    const activeButton = phaseButtonRefs.current[navigationPhase];
    if (!rail || !activeButton) return;
    const targetLeft = activeButton.offsetLeft
      - (rail.clientWidth - activeButton.offsetWidth) / 2;
    const reducedMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    rail.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  }, [compact, navigationPhase, phaseCount]);

  const goPhase = (nextPhase) => {
    if (nextPhase < 0 || nextPhase >= phaseCount) return;
    setIsPlaying(false);
    setPreviousPositions(currentReplayPhases[currentPhase]?.pos || null);
    transitionToPhase(nextPhase);
  };

  const goRelativePhase = (delta) => {
    setIsPlaying(false);
    setPreviousPositions(currentReplayPhases[currentPhase]?.pos || null);
    stepPhase(delta);
  };

  const replay = () => {
    cancelPlaybackRestart();
    setPreviousPositions(null);
    if (scene) setPlaybackTime(0);
    else setCurrentPhase(0);
    setIsPlaying(true);
  };

  const rewind = () => {
    cancelPlaybackRestart();
    if (!scene) return;
    setIsPlaying(false);
    setPlaybackTime(Math.max(0, playbackTime - 2));
  };

  const togglePlayback = () => {
    cancelPlaybackRestart();
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (atEnd) replay();
    else setIsPlaying(true);
  };

  const seek = (rawValue) => {
    cancelPlaybackRestart();
    setIsPlaying(false);
    setPreviousPositions(currentReplayPhases[currentPhase]?.pos || null);
    if (scene) setPlaybackTime(Number(rawValue));
    else setCurrentPhase(Math.round(Number(rawValue)));
  };

  const timeLabel = scene
    ? `${formatPlaybackTime(timelineValue)} / ${formatPlaybackTime(timelineMax)}`
    : `PHASE ${Math.min(currentPhase + 1, phaseCount)} / ${phaseCount}`;

  return (
    <div
      className={`playback-controls ${compact ? 'is-compact' : ''}`}
      data-testid="playback-controls"
      data-phase-transitioning={phaseTransitionTarget !== null}
      style={{
        '--playback-accent': t.ac,
        '--playback-accent-bg': t.ab,
        '--playback-border': t.bd,
        '--playback-panel': t.cb,
        '--playback-text': t.tx,
        '--playback-muted': t.td,
        '--playback-progress': `${Math.max(0, Math.min(100, progress))}%`,
      }}
    >
      {compact && phaseCount > 1 && (
        <nav
          className="playback-phase-selector"
          aria-label="Replay phases"
          data-testid="playback-phase-selector"
        >
          <div className="playback-phase-selector-summary" aria-hidden="true">
            <span>PHASE</span>
            <strong>{navigationPhase + 1}/{phaseCount}</strong>
          </div>
          <div className="playback-phase-rail" ref={phaseRailRef}>
            {currentReplayPhases.map((phase, index) => {
              const label = phase.t || phase.desc || `Phase ${index + 1}`;
              return (
                <button
                  type="button"
                  key={phase.id ?? index}
                  ref={(node) => { phaseButtonRefs.current[index] = node; }}
                  className={[
                    index === navigationPhase ? 'is-active' : '',
                    index < navigationPhase ? 'is-complete' : '',
                  ].filter(Boolean).join(' ')}
                  aria-current={index === navigationPhase ? 'step' : undefined}
                  onClick={() => goPhase(index)}
                  title={`Phase ${index + 1}: ${label}`}
                  data-testid={`playback-phase-${index}`}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{label}</strong>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      <div className="playback-transport-row">
        <div className="playback-transport-buttons">
          <button
            type="button"
            className="playback-icon-button"
            onClick={replay}
            title="Replay (R)"
            aria-label="Replay from start"
            data-testid="playback-replay"
          >
            <RotateCcw aria-hidden="true" />
          </button>
          <button
            type="button"
            className="playback-icon-button"
            onClick={rewind}
            disabled={!scene || playbackTime <= 0}
            title="Rewind 2 seconds"
            aria-label="Rewind 2 seconds"
            data-testid="playback-rewind"
          >
            <Rewind aria-hidden="true" />
          </button>
          <button
            type="button"
            className="playback-icon-button"
            onClick={() => goRelativePhase(-1)}
            disabled={navigationPhase === 0}
            title="Previous phase (Left arrow)"
            aria-label="Previous phase"
            data-testid="playback-previous"
          >
            <SkipBack aria-hidden="true" />
          </button>
          <button
            type="button"
            className="playback-play-button"
            onClick={togglePlayback}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            aria-label={isPlaying ? 'Pause replay' : 'Play replay'}
            aria-pressed={isPlaying}
            data-testid="playback-play-toggle"
          >
            {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
          </button>
          <button
            type="button"
            className="playback-icon-button"
            onClick={() => goRelativePhase(1)}
            disabled={navigationPhase >= phaseCount - 1}
            title="Next phase (Right arrow)"
            aria-label="Next phase"
            data-testid="playback-next"
          >
            <SkipForward aria-hidden="true" />
          </button>
        </div>

        <label className="playback-speed-control">
          <span className="sr-only">Replay speed</span>
          <select
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
            aria-label="Replay speed"
            title="Replay speed"
            data-testid="playback-speed"
          >
            {PLAYBACK_SPEEDS.map((value) => (
              <option key={value} value={value}>
                {playbackSpeedLabel(value)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="playback-timeline-row">
        {compact && phaseCount > 1 && (
          <label className="playback-phase-jump">
            <span className="sr-only">Jump to replay phase</span>
            <select
              value={navigationPhase}
              onChange={(event) => goPhase(Number(event.target.value))}
              aria-label="Jump to replay phase"
              title="Jump to phase"
            >
              {currentReplayPhases.map((phase, index) => (
                <option key={phase.id ?? index} value={index}>
                  Phase {index + 1}: {phase.t || phase.desc || `Phase ${index + 1}`}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="playback-range-wrap">
          <input
            type="range"
            min="0"
            max={timelineMax}
            step={timelineStep}
            value={timelineValue}
            onPointerDown={() => setIsPlaying(false)}
            onInput={(event) => seek(event.currentTarget.value)}
            aria-label="Replay timeline"
            aria-valuetext={timeLabel}
            data-testid="playback-timeline"
          />
          <div className="playback-phase-markers">
            {currentReplayPhases.map((phase, index) => {
              const markerValue = scene
                ? sceneTimeForPhase(scene, index, phaseCount)
                : index;
              const markerPosition = timelineMax > 0 ? markerValue / timelineMax * 100 : 0;
              return (
                <button
                  type="button"
                  key={phase.id ?? index}
                  className={index === instructionPhase ? 'is-active' : ''}
                  style={{ '--playback-marker-position': `${markerPosition}%` }}
                  onClick={() => goPhase(index)}
                  title={phase.t}
                  aria-label={`Go to phase ${index + 1}: ${phase.t}`}
                />
              );
            })}
          </div>
        </div>
        <output className="playback-timecode" data-testid="playback-timecode">
          {timeLabel}
        </output>
      </div>
    </div>
  );
}
