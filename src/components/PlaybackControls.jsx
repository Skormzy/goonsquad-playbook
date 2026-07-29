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

export default function PlaybackControls({ compact = false }) {
  const { theme, themes } = useTheme();
  const t = themes[theme];
  const {
    currentReplayScene: scene,
    currentReplayPhases,
    currentPhase,
    setCurrentPhase,
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
  const atEnd = scene
    ? timelineValue >= timelineMax - timelineStep
    : currentPhase >= phaseCount - 1;
  const progress = timelineMax > 0 ? timelineValue / timelineMax * 100 : 0;

  const goPhase = (nextPhase) => {
    cancelPlaybackRestart();
    if (nextPhase < 0 || nextPhase >= phaseCount) return;
    setIsPlaying(false);
    setPreviousPositions(currentReplayPhases[currentPhase]?.pos || null);
    setCurrentPhase(nextPhase);
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
            onClick={() => goPhase(currentPhase - 1)}
            disabled={currentPhase === 0}
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
            onClick={() => goPhase(currentPhase + 1)}
            disabled={currentPhase >= phaseCount - 1}
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
                {value === 0.5 ? '½x' : `${value}x`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="playback-timeline-row">
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
                  className={index === currentPhase ? 'is-active' : ''}
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
