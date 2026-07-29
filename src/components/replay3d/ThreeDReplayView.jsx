import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { getPlayScene } from '../../play-engine/sceneRegistry';
import { sampleReplayAt } from '../../replay3d/timeline';
import PlaybackControls from '../PlaybackControls';
import RoleFocusCard from '../RoleFocusCard';
import ReplayCanvas from './ReplayCanvas';
import { CAMERA_PRESETS } from './replayStyles';

function ThreeDUnavailable({ play }) {
  const { theme, themes } = useTheme();
  const t = themes[theme];
  const { setActiveView } = useApp();

  return (
    <main
      className="replay3d-view"
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        background: theme === 'dark' ? '#050816' : '#d9e2ec',
        color: theme === 'dark' ? '#e2e8f0' : '#0f172a',
      }}
    >
      <section className="replay3d-shell replay3d-shell-unavailable">
        <div className="replay3d-unavailable-stage" style={{ borderColor: t.bd }}>
          <div className="replay3d-unavailable-copy">
            <div style={{ fontSize: 10, letterSpacing: 2, color: t.ac, fontWeight: 900, fontFamily: 'monospace' }}>
              3D SCENE QUEUED
            </div>
            <h1>{play?.n ?? 'Selected play'}</h1>
            <p style={{ color: t.tm }}>
              This play remains selected while its production replay is authored. Your phase, speed, and role focus are preserved when you return to 2D.
            </p>
            <button
              type="button"
              onClick={() => setActiveView('playbook')}
              className="replay3d-button primary"
              style={{ borderColor: t.ac, background: t.ab, color: t.ac }}
            >
              Return to 2D
            </button>
          </div>
        </div>

        <section className="replay3d-caption" style={{ background: t.sf, borderColor: t.bd }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: t.ac, fontWeight: 900, fontFamily: 'monospace' }}>
              SELECTED CONTENT
            </div>
            <h2 style={{ margin: '3px 0 0', fontSize: 16 }}>{play?.n}</h2>
          </div>
          <p style={{ margin: 0, color: t.tm, fontSize: 12, lineHeight: 1.5 }}>{play?.desc}</p>
        </section>
      </section>
    </main>
  );
}

function AuthoredThreeDReplay({ replay }) {
  const { theme, themes } = useTheme();
  const t = themes[theme];
  const {
    setActiveView,
    playbackTime: time,
    replay3dCamera,
    setReplay3dCamera,
  } = useApp();
  const [showTeachingOverlays, setShowTeachingOverlays] = useState(false);
  const frame = useMemo(() => sampleReplayAt(replay, time), [replay, time]);

  return (
    <main
      className="replay3d-view"
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        background: theme === 'dark' ? '#050816' : '#d9e2ec',
        color: theme === 'dark' ? '#e2e8f0' : '#0f172a',
      }}
    >
      <section className="replay3d-shell">
        <div
          className="replay3d-stage"
          data-player-count={replay.players.length}
          style={{ borderColor: t.bd }}
        >
          <ReplayCanvas
            replay={replay}
            time={time}
            cameraId={replay3dCamera}
            showTeachingOverlays={showTeachingOverlays}
          />
        </div>

        <div className="replay3d-panel" style={{ background: t.sf, borderColor: t.bd }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: 2, color: t.ac, fontWeight: 900, fontFamily: 'monospace' }}>
              FLAGSHIP 3D REPLAY
            </div>
            <h1 style={{ margin: '4px 0 2px', fontSize: 22, lineHeight: 1.08 }}>
              {replay.title}
            </h1>
            <p style={{ margin: 0, color: t.tm, fontSize: 12, lineHeight: 1.45 }}>
              Deterministic Standard Breakout with a boards release, full 5v5 plus both goalies, and replayable camera angles.
            </p>
          </div>

          <div className="replay3d-transport">
            <PlaybackControls compact />
          </div>

          <div>
            <label className="replay3d-label" style={{ color: t.tm }}>Camera</label>
            <div className="replay3d-segments" role="group" aria-label="Camera angle">
              {Object.entries(CAMERA_PRESETS).map(([id, preset]) => (
                <button
                  type="button"
                  key={id}
                  onClick={() => setReplay3dCamera(id)}
                  className="replay3d-segment"
                  aria-pressed={replay3dCamera === id}
                  style={{
                    borderColor: replay3dCamera === id ? t.ac : t.bd,
                    background: replay3dCamera === id ? t.ab : 'transparent',
                    color: replay3dCamera === id ? t.ac : t.tm,
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="replay3d-aux-controls">
            <button
              type="button"
              onClick={() => setActiveView('playbook')}
              className="replay3d-button"
              style={{ borderColor: t.bd, color: t.tx }}
            >
              Open 2D View
            </button>
            <label className="replay3d-check" style={{ color: t.tx }}>
              <input
                type="checkbox"
                checked={showTeachingOverlays}
                onChange={(event) => setShowTeachingOverlays(event.target.checked)}
                aria-label="Coaching overlays"
              />
              Coaching overlays
            </label>
          </div>
        </div>

        <section className="replay3d-caption" style={{ background: t.sf, borderColor: t.bd }}>
          <div className="replay3d-current-read">
            <div style={{ fontSize: 10, letterSpacing: 2, color: t.ac, fontWeight: 900, fontFamily: 'monospace' }}>
              CURRENT READ
            </div>
            <h2 style={{ margin: '3px 0 0', fontSize: 16 }}>{frame.event?.label ?? 'Replay ready'}</h2>
          </div>
          <div className="replay3d-role-focus">
            <RoleFocusCard compact embedded />
          </div>
          <div className="replay3d-teaching">
            {replay.teachingPoints.map((point) => (
              <div key={point} style={{ borderColor: t.bd, color: t.tm }}>
                {point}
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

export default function ThreeDReplayView() {
  const { currentPlay } = useApp();
  const replay = getPlayScene(currentPlay?.id);

  if (!replay) return <ThreeDUnavailable play={currentPlay} />;
  return <AuthoredThreeDReplay replay={replay} />;
}
