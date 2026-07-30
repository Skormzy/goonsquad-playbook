import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import {
  Camera,
  ChevronDown,
  Crosshair,
  Maximize2,
  Minimize2,
  RotateCcw,
  Settings2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
} from 'three';
import PlaybackControls from '../components/PlaybackControls';
import FaceoffOutcomeControl from '../components/FaceoffOutcomeControl';
import MobileViewModeSwitch from '../components/MobileViewModeSwitch';
import ReplayTeachingCue from '../components/ReplayTeachingCue';
import CameraGestureControl from '../components/vnext3d/CameraGestureControl';
import RoleCameraSelector from '../components/vnext3d/RoleCameraSelector';
import TeamJobsPanel from '../components/TeamJobsPanel';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { CORE_PLAYS as PLAYS, CORE_TACTICS as TACTICS } from '../data/coreCatalog';
import { useWorkspaceLayout } from '../hooks/useWorkspaceLayout';
import {
  roleLensForPosition,
  rolesForRoleLens,
  teamJobsFromPresentation,
} from '../play-engine/teamJobs';
import { standardBreakoutTacticalSpacing } from '../play-engine/tacticalSpacing';
import {
  COURT_LENGTH_METERS,
  COURT_WIDTH_METERS,
} from '../play-engine/movementMetrics';
import { productionRenderProfile } from '../vnext3d/renderProfile';
import {
  CAMERA_GESTURE_MODES,
  productionCameraPose,
  roleCameraIntentLabel,
} from '../vnext3d/cameraSystem';
import {
  athleteAssetsForMotionReview,
  TACTICAL_DISTANCE_BASELINE_ID,
} from '../components/vnext3d/productionAssets';
import {
  sampleTacticalReplay,
  tacticalBallMotionStreakWidth,
  TACTICAL_BALL_RENDER_MODE,
  TACTICAL_REPLAY_ENGINE_ID,
} from './sampleTacticalReplay';
import TacticalLayerControl from './TacticalLayerControl';
import ReplayCatalogNavigator from './ReplayCatalogNavigator';
import {
  TACTICAL_LAYER_DEFAULTS,
  TACTICAL_LAYER_KEYS,
} from './tacticalLayers';
import TacticalReplayScene from './TacticalReplayScene';

const CAMERA_PRESETS = Object.freeze([
  { id: 'broadcast', label: 'Broadcast' },
  { id: 'overhead', label: 'Overhead' },
  { id: 'bench', label: 'Bench' },
  { id: 'player', label: 'Role' },
]);

function AssetProgress() {
  const { active } = useProgress();
  return active ? <span className="vnext3d-loading-state">LOADING REPLAY</span> : null;
}

function possessionLabel(frame) {
  const playerId = frame.ball.ownerId
    ?? (frame.ball.state === 'release' ? frame.ball.fromPlayerId : null)
    ?? (frame.ball.state === 'receive' ? frame.ball.toPlayerId : null);
  return frame.players.find((player) => player.id === playerId)?.label ?? 'IN FLIGHT';
}

export default function TacticalReplayPreview() {
  const { theme } = useTheme();
  const {
    currentPhase,
    currentPlay,
    currentReplayScene: replay,
    isPlaying,
    playbackTime,
    replay3dCamera,
    roleFocusMode,
    selectedPosition,
    selectedTacticId,
    setCurrentPlay,
    setIsPlaying,
    setPlaybackTime,
    setReplay3dCamera,
    setRoleFocusMode,
    setSelectedPosition,
    setSelectedTacticId,
    setStrategyVariant,
    speed,
    strategyVariant,
  } = useApp();
  const workspaceLayout = useWorkspaceLayout();
  const renderProfile = productionRenderProfile(workspaceLayout);
  const frame = useMemo(
    () => (replay ? sampleTacticalReplay(replay, playbackTime) : null),
    [playbackTime, replay],
  );
  const athleteAssets = useMemo(
    () => athleteAssetsForMotionReview(TACTICAL_DISTANCE_BASELINE_ID),
    [],
  );
  const teamJobs = useMemo(
    () => teamJobsFromPresentation(replay?.presentation?.responsibilities ?? []),
    [replay],
  );
  const stageRef = useRef(null);
  const [cameraFollowing, setCameraFollowing] = useState(true);
  const [cameraCommand, setCameraCommand] = useState({ revision: 0, type: 'reframe' });
  const [cameraGestureMode, setCameraGestureMode] = useState(CAMERA_GESTURE_MODES.ORBIT);
  const [cameraInteractionCount, setCameraInteractionCount] = useState(0);
  const [cameraPose, setCameraPose] = useState(null);
  const [frameStats, setFrameStats] = useState(null);
  const [stageFullscreen, setStageFullscreen] = useState(false);
  const [mobileCameraPresetOpen, setMobileCameraPresetOpen] = useState(false);
  const [mobileCameraToolsOpen, setMobileCameraToolsOpen] = useState(false);
  const [tacticalLayers, setTacticalLayers] = useState(
    () => ({ ...TACTICAL_LAYER_DEFAULTS }),
  );

  const issueCameraCommand = useCallback((type) => {
    setCameraCommand((previous) => ({ revision: previous.revision + 1, type }));
  }, []);

  const handleCameraPreset = useCallback((cameraId) => {
    setReplay3dCamera(cameraId);
    setCameraFollowing(true);
    setMobileCameraPresetOpen(false);
    issueCameraCommand('reframe');
  }, [issueCameraCommand, setReplay3dCamera]);

  const handleRoleCameraSelect = useCallback((position) => {
    setSelectedPosition(position);
    setRoleFocusMode(roleLensForPosition(position));
    if (replay3dCamera !== 'player') setReplay3dCamera('player');
    setCameraFollowing(true);
    issueCameraCommand('reframe');
  }, [
    issueCameraCommand,
    replay3dCamera,
    setReplay3dCamera,
    setRoleFocusMode,
    setSelectedPosition,
  ]);

  const handleManualCameraControl = useCallback(() => {
    setCameraFollowing(false);
    setCameraInteractionCount((count) => count + 1);
  }, []);

  const handleCameraCommand = useCallback((type) => {
    if (type === 'reframe') setCameraFollowing(true);
    else setCameraFollowing(false);
    issueCameraCommand(type);
    if (type !== 'reframe') setCameraInteractionCount((count) => count + 1);
  }, [issueCameraCommand]);

  const handleCameraGestureMode = useCallback((mode) => {
    setCameraGestureMode(mode);
    setCameraFollowing(false);
    setCameraInteractionCount((count) => count + 1);
  }, []);

  const handleFollowToggle = useCallback(() => {
    const next = !cameraFollowing;
    setCameraFollowing(next);
    if (next) issueCameraCommand('reframe');
  }, [cameraFollowing, issueCameraCommand]);

  const handleCameraKeyDown = useCallback((event) => {
    if (event.target instanceof Element && event.target.closest('button,input,select,textarea')) return;
    const key = event.key.toLowerCase();
    const command = event.shiftKey && event.key === 'ArrowLeft'
      ? 'pan-left'
      : event.shiftKey && event.key === 'ArrowRight'
        ? 'pan-right'
        : event.shiftKey && event.key === 'ArrowUp'
          ? 'pan-forward'
          : event.shiftKey && event.key === 'ArrowDown'
            ? 'pan-back'
            : key === 'a'
              ? 'orbit-left'
              : key === 'd'
                ? 'orbit-right'
                : key === 'w'
                  ? 'orbit-up'
                  : key === 's'
                    ? 'orbit-down'
                    : ['+', '='].includes(event.key)
                      ? 'zoom-in'
                      : ['-', '_'].includes(event.key)
                        ? 'zoom-out'
                        : null;

    if (command) {
      event.preventDefault();
      event.stopPropagation();
      handleCameraCommand(command);
      return;
    }
    if (key === 'f') {
      event.preventDefault();
      event.stopPropagation();
      handleFollowToggle();
      return;
    }
    if (key === 'p') {
      event.preventDefault();
      event.stopPropagation();
      handleCameraGestureMode(
        cameraGestureMode === CAMERA_GESTURE_MODES.PAN
          ? CAMERA_GESTURE_MODES.ORBIT
          : CAMERA_GESTURE_MODES.PAN,
      );
      return;
    }
    if (key === '0' || event.key === 'Home') {
      event.preventDefault();
      event.stopPropagation();
      handleCameraCommand('reframe');
    }
  }, [
    cameraGestureMode,
    handleCameraCommand,
    handleCameraGestureMode,
    handleFollowToggle,
  ]);

  const handleTacticalLayerChange = useCallback((id, enabled) => {
    if (!TACTICAL_LAYER_KEYS.includes(id)) return;
    setTacticalLayers((current) => ({ ...current, [id]: enabled }));
  }, []);

  const handleCatalogSelect = useCallback((item) => {
    if (!item) return;
    setIsPlaying(false);
    if (replay?.kind === 'strategy') setSelectedTacticId(item.id);
    else setCurrentPlay(item);
  }, [replay?.kind, setCurrentPlay, setIsPlaying, setSelectedTacticId]);

  useEffect(() => {
    const syncFullscreen = () => {
      if (document.fullscreenElement === stageRef.current) setStageFullscreen(true);
      else if (document.fullscreenElement === null) setStageFullscreen(false);
    };
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  useEffect(() => {
    const exitExpandedFallback = (event) => {
      if (event.key === 'Escape' && stageFullscreen && document.fullscreenElement === null) {
        setStageFullscreen(false);
      }
    };
    document.addEventListener('keydown', exitExpandedFallback);
    return () => document.removeEventListener('keydown', exitExpandedFallback);
  }, [stageFullscreen]);

  const toggleStageFullscreen = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return;
    try {
      if (document.fullscreenElement === stage) {
        await document.exitFullscreen();
        return;
      }
      if (stageFullscreen) {
        setStageFullscreen(false);
        return;
      }
      if (document.fullscreenEnabled && stage.requestFullscreen) {
        await stage.requestFullscreen();
        setStageFullscreen(true);
      } else {
        setStageFullscreen(true);
      }
    } catch {
      setStageFullscreen((current) => !current);
    }
  }, [stageFullscreen]);

  if (!replay || !frame) {
    return (
      <main className="vnext3d-preview-empty">
        <strong>3D replay is unavailable for this item.</strong>
      </main>
    );
  }

  const selectedAthlete = frame.players.find((player) => (
    player.team === 'us' && player.role === selectedPosition
  ));
  const roleCameraState = productionCameraPose('player', {
    ball: frame.ball,
    focusPlayer: selectedAthlete,
    players: frame.players,
    playbackTime: frame.time,
    replay,
  });
  const tacticalSpacing = replay.sourcePlayId === 'brk'
    ? standardBreakoutTacticalSpacing({
      ...frame,
      ball: {
        ...frame.ball,
        trajectoryPosition: {
          x: (frame.ball.worldPosition[0] / COURT_WIDTH_METERS + 0.5) * 100,
          y: (frame.ball.worldPosition[2] / COURT_LENGTH_METERS + 0.5) * 100,
        },
      },
    })
    : { phase: `phase-${currentPhase + 1}`, status: 'pass' };
  const penaltyBoxAthlete = frame.players.find((player) => player.penaltyBox);
  const mobileLayout = workspaceLayout !== 'desktop';
  const teachingAccent = replay.kind === 'strategy'
    ? strategyVariant === 'mistake' ? '#d97706' : '#16a34a'
    : 'var(--gs-cyan)';
  return (
    <main
      className="vnext3d-preview-view"
      data-testid="vnext-3d-production-preview"
      data-workspace-layout={workspaceLayout}
      data-engine={TACTICAL_REPLAY_ENGINE_ID}
      data-camera-id={replay3dCamera}
      data-camera-control={cameraFollowing ? 'follow' : 'free-look'}
      data-camera-gesture-mode={cameraGestureMode}
      data-camera-position={cameraPose?.position?.join(',') ?? 'pending'}
      data-camera-target={cameraPose?.target?.join(',') ?? 'pending'}
      data-role-camera-position={selectedPosition}
      data-role-camera-intent={roleCameraState.intent}
      data-role-camera-target={roleCameraState.targetPlayerId ?? 'ball'}
      data-camera-interaction-count={cameraInteractionCount}
      data-phase={currentPhase}
      data-playing={isPlaying}
      data-replay-time={Number(playbackTime.toFixed(3))}
      data-player-count={frame.players.length}
      data-on-rink-player-count={frame.players.filter((player) => !player.penaltyBox).length}
      data-penalty-box-count={frame.players.filter((player) => player.penaltyBox).length}
      data-penalty-box-player={penaltyBoxAthlete?.id ?? 'none'}
      data-penalty-box-team={penaltyBoxAthlete?.team ?? 'none'}
      data-penalty-box-world-x={penaltyBoxAthlete
        ? Number(penaltyBoxAthlete.worldPosition[0].toFixed(4))
        : 'none'}
      data-penalty-box-world-z={penaltyBoxAthlete
        ? Number(penaltyBoxAthlete.worldPosition[2].toFixed(4))
        : 'none'}
      data-ball-state={frame.ball.state}
      data-ball-segment={frame.ball.segmentType}
      data-ball-owner={frame.ball.ownerId ?? 'none'}
      data-faceoff-outcome={replay.presentation?.faceoff?.outcome ?? 'none'}
      data-faceoff-target={replay.presentation?.faceoff?.outcomeTarget ?? 'none'}
      data-ball-x={Number(frame.ball.worldPosition[0].toFixed(4))}
      data-ball-y={Number(frame.ball.worldPosition[2].toFixed(4))}
      data-ball-board-phase={frame.ball.boardPhase}
      data-ball-world-height={Number(frame.ball.worldPosition[1].toFixed(4))}
      data-ball-contact-weight="0"
      data-ball-motion-streak-width={tacticalBallMotionStreakWidth(frame.ball)}
      data-ball-render-mode={TACTICAL_BALL_RENDER_MODE}
      data-possession={possessionLabel(frame)}
      data-next-read={frame.event?.nextRead ?? 'Settle the ball and read pressure'}
      data-focused-roles={rolesForRoleLens(roleFocusMode).join(',') || 'none'}
      data-role-lens={roleFocusMode}
      data-spacing-phase={tacticalSpacing.phase}
      data-spacing-status={tacticalSpacing.status}
      data-selected-athlete-action={selectedAthlete?.clipName ?? 'none'}
      data-frame-sample-count={frameStats?.observedSampleCount ?? 0}
      data-frame-mean-ms={frameStats?.meanMs ?? 'pending'}
      data-frame-p95-ms={frameStats?.p95Ms ?? 'pending'}
      data-frame-max-ms={frameStats?.maxMs ?? 'pending'}
      data-layer-active-count={TACTICAL_LAYER_KEYS.filter((key) => tacticalLayers[key]).length}
      data-layer-matchups={tacticalLayers.matchups}
      data-layer-routes={tacticalLayers.routes}
      data-layer-passing={tacticalLayers.passing}
      data-layer-targets={tacticalLayers.targets}
    >
      <section
        ref={stageRef}
        className={`vnext3d-preview-stage ${stageFullscreen ? 'is-immersive' : ''}`}
        aria-label={`Interactive 3D ${replay.kind === 'strategy' ? 'strategy' : 'play'} replay`}
        data-camera-control={cameraFollowing ? 'follow' : 'free-look'}
        data-camera-gesture-mode={cameraGestureMode}
        data-fullscreen-toolbar={
          replay.kind === 'strategy' || currentPlay?.faceoff ? 'expanded' : 'standard'
        }
        onKeyDown={handleCameraKeyDown}
        onPointerDown={(event) => {
          if (event.target instanceof HTMLCanvasElement) stageRef.current?.focus({ preventScroll: true });
        }}
        tabIndex={0}
      >
        <ReplayCatalogNavigator
          compact={workspaceLayout !== 'desktop'}
          currentId={replay.kind === 'strategy' ? selectedTacticId : currentPlay?.id}
          items={replay.kind === 'strategy' ? TACTICS : PLAYS}
          kind={replay.kind === 'strategy' ? 'strategy' : 'play'}
          onSelect={handleCatalogSelect}
        />
        {mobileLayout && <MobileViewModeSwitch className="is-three-d-stage" />}
        <ReplayTeachingCue accent={teachingAccent} className="is-three-d">
          {replay.kind === 'play' && currentPlay?.faceoff
            ? <FaceoffOutcomeControl compact />
            : null}
        </ReplayTeachingCue>

        <Canvas
          key={renderProfile.id}
          dpr={renderProfile.dpr}
          gl={{
            antialias: renderProfile.antialias,
            alpha: false,
            powerPreference: 'high-performance',
          }}
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
              cameraGestureMode={cameraGestureMode}
              cameraId={replay3dCamera}
              isPlaying={isPlaying}
              onFrameStats={setFrameStats}
              onManualCameraControl={handleManualCameraControl}
              onCameraPoseChange={setCameraPose}
              onPlaybackEnd={() => setIsPlaying(false)}
              onTimeChange={setPlaybackTime}
              playbackTime={playbackTime}
              replay={replay}
              roleFocusMode={roleFocusMode}
              selectedPosition={selectedPosition}
              speed={speed}
              tacticalLayers={tacticalLayers}
              theme={theme}
            />
          </Suspense>
        </Canvas>

        <AssetProgress />

        {mobileLayout ? (
          <div className={`vnext3d-mobile-camera-picker ${mobileCameraPresetOpen ? 'is-open' : ''}`}>
            <button
              type="button"
              className="vnext3d-mobile-camera-current"
              aria-expanded={mobileCameraPresetOpen}
              aria-controls="vnext3d-mobile-camera-options"
              onClick={() => setMobileCameraPresetOpen((open) => !open)}
            >
              <Camera aria-hidden="true" />
              <span>{CAMERA_PRESETS.find(({ id }) => id === replay3dCamera)?.label ?? 'Camera'}</span>
              <ChevronDown aria-hidden="true" />
            </button>
            {mobileCameraPresetOpen && (
              <div id="vnext3d-mobile-camera-options" role="group" aria-label="3D camera angle">
                {CAMERA_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.id}
                    aria-pressed={replay3dCamera === preset.id}
                    onClick={() => handleCameraPreset(preset.id)}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="vnext3d-stage-camera-presets" role="group" aria-label="3D camera angle">
            {CAMERA_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.id}
                aria-pressed={replay3dCamera === preset.id}
                onClick={() => handleCameraPreset(preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}

        {replay3dCamera === 'player' && (
          <RoleCameraSelector
            onSelect={handleRoleCameraSelect}
            selectedPosition={selectedPosition}
          />
        )}

        <div
          className={`vnext3d-camera-operator ${mobileLayout && !mobileCameraToolsOpen ? 'is-collapsed' : ''}`}
          role="toolbar"
          aria-label="3D camera navigation"
        >
          {mobileLayout && (
            <button
              type="button"
              className="vnext3d-camera-tools-toggle"
              aria-label={mobileCameraToolsOpen ? 'Close camera tools' : 'Open camera tools'}
              aria-expanded={mobileCameraToolsOpen}
              onClick={() => setMobileCameraToolsOpen((open) => !open)}
              title={mobileCameraToolsOpen ? 'Close camera tools' : 'Camera tools'}
            >
              <Settings2 aria-hidden="true" />
            </button>
          )}
          {(!mobileLayout || mobileCameraToolsOpen) && (
            <>
              <button
                type="button"
                className={cameraFollowing ? 'is-active' : ''}
                aria-label={cameraFollowing ? 'Pause action camera follow' : 'Follow the action'}
                aria-pressed={cameraFollowing}
                onClick={handleFollowToggle}
                title={cameraFollowing ? 'Pause action follow' : 'Follow the action'}
              >
                <Crosshair aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Recenter selected camera angle"
                onClick={() => handleCameraCommand('reframe')}
                title="Recenter camera"
              >
                <RotateCcw aria-hidden="true" />
              </button>
              <CameraGestureControl
                mode={cameraGestureMode}
                onChange={handleCameraGestureMode}
              />
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => handleCameraCommand('zoom-out')}
                title="Zoom out"
              >
                <ZoomOut aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => handleCameraCommand('zoom-in')}
                title="Zoom in"
              >
                <ZoomIn aria-hidden="true" />
              </button>
              <TacticalLayerControl
                layers={tacticalLayers}
                onChange={handleTacticalLayerChange}
              />
              <button
                type="button"
                aria-label={stageFullscreen ? 'Exit full screen 3D replay' : 'View 3D replay full screen'}
                onClick={toggleStageFullscreen}
                title={stageFullscreen ? 'Exit full screen' : 'Full screen'}
              >
                {stageFullscreen ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
              </button>
            </>
          )}
        </div>

        <div className="vnext3d-camera-state" aria-live="polite">
          <span aria-hidden="true" />
          {replay3dCamera === 'player'
            ? `${selectedPosition} / ${cameraFollowing
              ? roleCameraIntentLabel(roleCameraState.intent)
              : cameraGestureMode === CAMERA_GESTURE_MODES.PAN ? 'PAN' : 'ORBIT'}`
            : cameraFollowing
              ? 'FOLLOW'
              : cameraGestureMode === CAMERA_GESTURE_MODES.PAN ? 'PAN' : 'ORBIT'}
        </div>

        {stageFullscreen && (
          <div className="vnext3d-stage-transport" aria-label="Full screen replay controls">
            {replay.kind === 'play' && currentPlay?.faceoff && (
              <FaceoffOutcomeControl compact className="is-immersive" />
            )}
            {replay.kind === 'strategy' && (
              <div className="vnext3d-variant-picker is-immersive" role="group" aria-label="Strategy outcome">
                <button
                  type="button"
                  aria-pressed={strategyVariant === 'mistake'}
                  onClick={() => setStrategyVariant('mistake')}
                >
                  Mistake
                </button>
                <button
                  type="button"
                  aria-pressed={strategyVariant === 'correct'}
                  onClick={() => setStrategyVariant('correct')}
                >
                  Right way
                </button>
              </div>
            )}
            <PlaybackControls compact />
          </div>
        )}
      </section>

      <section className="vnext3d-preview-console" aria-label="3D replay controls and status">
        {replay.kind === 'play' && currentPlay?.faceoff && (
          <div className="vnext3d-content-picker vnext3d-faceoff-outcome">
            <FaceoffOutcomeControl />
          </div>
        )}
        {replay.kind === 'strategy' && (
          <div className="vnext3d-content-picker vnext3d-strategy-outcome">
            <span>COMPARE OUTCOME</span>
            <div className="vnext3d-variant-picker" role="group" aria-label="Strategy outcome">
              <button
                type="button"
                aria-pressed={strategyVariant === 'mistake'}
                onClick={() => setStrategyVariant('mistake')}
              >
                Mistake
              </button>
              <button
                type="button"
                aria-pressed={strategyVariant === 'correct'}
                onClick={() => setStrategyVariant('correct')}
              >
                Right way
              </button>
            </div>
          </div>
        )}
        {mobileLayout ? (
          <details className="vnext3d-mobile-coaching">
            <summary>
              <span>TEAM PLAN</span>
              <strong>Role responsibilities</strong>
              <small>Open the position-by-position reads</small>
              <ChevronDown aria-hidden="true" />
            </summary>
            <div>
              <TeamJobsPanel
                compact
                wide
                eyebrow={replay.kind === 'strategy' ? 'STRATEGY PURPOSE' : 'PLAY PURPOSE'}
                jobs={teamJobs}
                meta={replay.title}
                summary={replay.presentation?.purpose ?? replay.title}
              />
            </div>
          </details>
        ) : (
          <div className="vnext3d-preview-identity">
            <TeamJobsPanel
              compact
              wide
              eyebrow={replay.kind === 'strategy' ? 'STRATEGY PURPOSE' : 'PLAY PURPOSE'}
              jobs={teamJobs}
              meta={replay.title}
              summary={replay.presentation?.purpose ?? replay.title}
            />
          </div>
        )}
        <div className="vnext3d-preview-transport">
          <PlaybackControls compact />
        </div>
      </section>
    </main>
  );
}
