import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas } from '@react-three/fiber';
import {
  ArrowRight,
  Crosshair,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  SkipBack,
} from 'lucide-react';
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three';
import { ACCEPTED_ATHLETE_ASSETS } from '../components/vnext3d/acceptedAthleteAssets';
import { useTheme } from '../context/ThemeContext';
import { productionRenderProfile } from '../vnext3d/renderProfile';
import TacticalReplayScene from '../tactical3d/TacticalReplayScene';
import { TACTICAL_LAYER_DEFAULTS } from '../tactical3d/tacticalLayers';
import { sampleTacticalReplay } from '../tactical3d/sampleTacticalReplay';

const CAMERAS = Object.freeze([
  { id: 'broadcast', label: 'Broadcast' },
  { id: 'overhead', label: 'Overhead' },
  { id: 'bench', label: 'Bench' },
  { id: 'player', label: 'Role' },
]);

export default function Playmaker3DPreview({
  isPlaying,
  onPlayingChange,
  onRestart,
  onSpeedChange,
  onTimeChange,
  scene,
  speed,
  time,
  workspaceLayout,
}) {
  const { theme } = useTheme();
  const stageRef = useRef(null);
  const [cameraId, setCameraId] = useState('broadcast');
  const [cameraFollowing, setCameraFollowing] = useState(true);
  const [cameraCommand, setCameraCommand] = useState({ revision: 0, type: 'reframe' });
  const [fullscreen, setFullscreen] = useState(false);
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const [tacticalLayers, setTacticalLayers] = useState({ ...TACTICAL_LAYER_DEFAULTS });
  const renderProfile = productionRenderProfile(workspaceLayout);
  const athleteAssets = ACCEPTED_ATHLETE_ASSETS;
  const sampled = useMemo(() => sampleTacticalReplay(scene, time), [scene, time]);
  const playerRoles = useMemo(
    () => new Map(scene.players.map((player) => [player.id, player.role])),
    [scene.players],
  );
  const ballRead = useMemo(() => {
    const { ball } = sampled;
    if (ball.segmentType === 'pass' || ball.segmentType === 'board-pass') {
      return {
        action: ball.segmentType === 'board-pass' ? 'BOARDS PASS' : 'PASS',
        from: playerRoles.get(ball.fromPlayerId) ?? '?',
        to: playerRoles.get(ball.toPlayerId) ?? '?',
      };
    }
    if (ball.segmentType === 'shot') {
      return { action: 'SHOT', from: playerRoles.get(ball.fromPlayerId) ?? '?', to: 'NET' };
    }
    if (ball.segmentType === 'loose') {
      return {
        action: 'LOOSE BALL',
        from: null,
        to: ball.toPlayerId ? playerRoles.get(ball.toPlayerId) ?? '?' : 'SPACE',
      };
    }
    return { action: 'CARRY', from: null, to: playerRoles.get(ball.ownerId) ?? '?' };
  }, [playerRoles, sampled]);

  const reframe = useCallback(() => {
    setCameraFollowing(true);
    setCameraCommand((current) => ({ revision: current.revision + 1, type: 'reframe' }));
  }, []);

  const selectCamera = (nextCamera) => {
    setCameraId(nextCamera);
    reframe();
  };

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === stageRef.current) await document.exitFullscreen();
      else if (stageRef.current?.requestFullscreen) await stageRef.current.requestFullscreen();
      else setFullscreen((value) => !value);
    } catch {
      setFullscreen((value) => !value);
    }
  };

  return (
    <section
      ref={stageRef}
      className={`playmaker-3d-stage ${fullscreen ? 'is-fullscreen' : ''}`}
      aria-label="Interactive 3D preview of the authored play"
      data-ball-from={sampled.ball.fromPlayerId ?? ''}
      data-ball-owner={sampled.ball.ownerId ?? ''}
      data-ball-segment={sampled.ball.segmentType}
      data-ball-to={sampled.ball.toPlayerId ?? ''}
      data-player-count={scene.players.length}
    >
      <Canvas
        key={renderProfile.id}
        dpr={renderProfile.dpr}
        gl={{ antialias: renderProfile.antialias, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = SRGBColorSpace;
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.06;
        }}
      >
        <Suspense fallback={null}>
          <TacticalReplayScene
            athleteAssets={athleteAssets}
            cameraCommand={cameraCommand}
            cameraFollowing={cameraFollowing}
            cameraId={cameraId}
            isPlaying={isPlaying}
            onFrameStats={() => {}}
            onManualCameraControl={() => setCameraFollowing(false)}
            onPlaybackEnd={() => onPlayingChange(false)}
            onTimeChange={onTimeChange}
            playbackTime={time}
            replay={scene}
            roleFocusMode="team"
            selectedPosition="C"
            speed={speed}
            tacticalLayers={tacticalLayers}
            theme={theme}
          />
        </Suspense>
      </Canvas>

      <div className="playmaker-3d-ball-read" data-testid="playmaker-3d-ball-read" aria-live="polite">
        <span>{ballRead.action}</span>
        <strong>
          {ballRead.from && <>{ballRead.from}<ArrowRight aria-hidden="true" /></>}
          {ballRead.to}
        </strong>
      </div>

      <div className="playmaker-3d-cameras" role="group" aria-label="3D preview camera">
        {CAMERAS.map((camera) => (
          <button
            key={camera.id}
            type="button"
            aria-pressed={cameraId === camera.id}
            onClick={() => selectCamera(camera.id)}
          >
            {camera.label}
          </button>
        ))}
      </div>

      <div className="playmaker-3d-tools" role="toolbar" aria-label="3D preview navigation">
        <button
          type="button"
          className={layerPanelOpen ? 'is-active' : ''}
          aria-label="Toggle coaching layers"
          aria-expanded={layerPanelOpen}
          onClick={() => setLayerPanelOpen((value) => !value)}
          title="Coaching layers"
        >
          <Settings2 aria-hidden="true" />
        </button>
        <button
          type="button"
          className={cameraFollowing ? 'is-active' : ''}
          aria-label={cameraFollowing ? 'Pause action camera follow' : 'Follow the action'}
          aria-pressed={cameraFollowing}
          onClick={() => setCameraFollowing((value) => !value)}
          title="Follow action"
        >
          <Crosshair aria-hidden="true" />
        </button>
        <button type="button" aria-label="Recenter camera" onClick={reframe} title="Recenter camera">
          <RotateCcw aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={fullscreen ? 'Exit full screen preview' : 'View preview full screen'}
          onClick={toggleFullscreen}
          title={fullscreen ? 'Exit full screen' : 'Full screen'}
        >
          {fullscreen ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
        </button>
      </div>

      {layerPanelOpen && (
        <div className="playmaker-layer-panel" aria-label="Coaching layers">
          {[
            ['routes', 'Routes'],
            ['matchups', 'Coverage'],
            ['passing', 'Ball path'],
            ['targets', 'Next targets'],
          ].map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={tacticalLayers[key]}
                onChange={(event) => setTacticalLayers((current) => ({
                  ...current,
                  [key]: event.target.checked,
                }))}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )}

      {fullscreen && (
        <div className="playmaker-fullscreen-transport">
          <button type="button" aria-label="Start over" onClick={onRestart}>
            <SkipBack aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
            onClick={() => onPlayingChange(!isPlaying)}
          >
            {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>
          <input
            type="range"
            min="0"
            max={scene.duration}
            step="0.01"
            value={time}
            aria-label="Preview timeline"
            onChange={(event) => onTimeChange(Number(event.target.value))}
          />
          <span>{time.toFixed(1)} / {scene.duration.toFixed(1)}</span>
          <select value={speed} aria-label="Preview speed" onChange={(event) => onSpeedChange(Number(event.target.value))}>
            <option value="0.5">0.5×</option>
            <option value="1">1×</option>
            <option value="1.5">1.5×</option>
          </select>
        </div>
      )}
    </section>
  );
}
