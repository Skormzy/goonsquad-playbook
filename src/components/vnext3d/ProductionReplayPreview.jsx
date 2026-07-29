import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  PerspectiveCamera,
  Trail,
  useProgress,
} from '@react-three/drei';
import {
  Crosshair,
  Maximize2,
  Minimize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  ACESFilmicToneMapping,
  SRGBColorSpace,
  Vector3,
} from 'three';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { useWorkspaceLayout } from '../../hooks/useWorkspaceLayout';
import PlaybackControls from '../PlaybackControls';
import CameraGestureControl from './CameraGestureControl';
import RoleCameraSelector from './RoleCameraSelector';
import { getPlayScene } from '../../play-engine/sceneRegistry';
import { samplePlayScene } from '../../play-engine/samplePlayScene';
import { roleLensForPosition } from '../../play-engine/teamJobs';
import {
  replayNextRead,
  replayPossessionLabel,
} from '../../play-engine/replayTacticalStatus';
import { standardBreakoutTacticalSpacing } from '../../play-engine/tacticalSpacing';
import {
  BALL_RADIUS_METERS,
  createProductionRuntimePlayers,
  productionBallHeightMeters,
  productionBallPosition,
  productionClipPhaseOffset,
} from '../../vnext3d/runtimeMapping';
import { productionRenderProfile, summarizeFrameIntervals } from '../../vnext3d/renderProfile';
import {
  ballLocatorRadii,
  ballMotionStreakWidth,
  ballRenderSampleTime,
} from '../../vnext3d/ballPresentation';
import {
  NORMAL_GROUND_SAMPLE_INTERVAL_SECONDS,
  summarizeGroundContacts,
} from '../../vnext3d/grounding';
import {
  measureAuthoredContactSliding,
  measureFootDisplacement,
  measurePlantedFootSliding,
  summarizeFootSlideSamples,
} from '../../vnext3d/footSliding';
import {
  CAMERA_GESTURE_MODES,
  CAMERA_TRACKING_RATE,
  OVERHEAD_CAMERA_AIM_TRACKING_RATE,
  OVERHEAD_CAMERA_POSITION_TRACKING_RATE,
  ROLE_CAMERA_AIM_TRACKING_RATE,
  ROLE_CAMERA_POSITION_TRACKING_RATE,
  cameraGestureBindings,
  cameraInteractionPolicy,
  cameraTrackingMode,
  clampCameraTarget,
  productionCameraPose,
  roleCameraIntentLabel,
  stepOperatorCamera,
} from '../../vnext3d/cameraSystem';
import {
  parsePrivateMotionTuning,
  parseTransitionTelemetryWindow,
  summarizeTransitionTelemetry,
  transitionEventsForWindow,
} from '../../vnext3d/transitionTelemetry';
import ProductionAthlete from './ProductionAthlete';
import ProductionCourt from './ProductionCourt';
import {
  athleteAssetsForMotionReview,
  TACTICAL_DISTANCE_BASELINE_ID,
} from './productionAssets';

const CAMERA_PRESETS = Object.freeze([
  { id: 'broadcast', label: 'Broadcast' },
  { id: 'overhead', label: 'Overhead' },
  { id: 'bench', label: 'Bench' },
  { id: 'player', label: 'Role' },
]);

function CameraRig({
  ball,
  ballPosition,
  cameraCommand,
  cameraId,
  focusPlayer,
  following,
  gestureMode,
  onManualControl,
  onCameraPoseChange,
  playbackTime,
  players,
  replay,
}) {
  const { size } = useThree();
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const initializedRef = useRef(false);
  const targetRef = useRef(new Vector3());
  const clampDeltaRef = useRef(new Vector3());
  const lastFocusPositionRef = useRef(new Vector3());
  const focusDeltaRef = useRef(new Vector3());
  const portrait = size.height > size.width * 1.18;
  const compactOverhead = cameraId === 'overhead' && size.width < 640;
  const config = useMemo(() => productionCameraPose(cameraId, {
    ball,
    compact: compactOverhead,
    portrait,
    focusPlayer,
    focusPlayerPosition: focusPlayer?.worldPosition,
    players,
    playbackTime,
    replay,
    ballPosition,
  }), [
    ball,
    ballPosition,
    cameraId,
    compactOverhead,
    focusPlayer,
    playbackTime,
    players,
    portrait,
    replay,
  ]);
  const interactionPolicy = useMemo(
    () => cameraInteractionPolicy(cameraId, { portrait }),
    [cameraId, portrait],
  );
  const gestureBindings = useMemo(
    () => cameraGestureBindings(gestureMode),
    [gestureMode],
  );
  const desiredPosition = useMemo(() => new Vector3(...config.position), [config.position]);
  const desiredTarget = useMemo(() => new Vector3(...config.target), [config.target]);
  const publishCameraPose = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    onCameraPoseChange?.({
      position: camera.position.toArray().map((value) => Number(value.toFixed(4))),
      target: controls.target.toArray().map((value) => Number(value.toFixed(4))),
    });
  }, [onCameraPoseChange]);

  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls || initializedRef.current) return;
    initializedRef.current = true;
    controls.target.copy(desiredTarget);
    targetRef.current.copy(desiredTarget);
    camera.position.copy(desiredPosition);
    if (focusPlayer) lastFocusPositionRef.current.set(...focusPlayer.worldPosition);
    camera.fov = config.fov;
    camera.updateProjectionMatrix();
    controls.update();
    publishCameraPose();
  }, [config.fov, desiredPosition, desiredTarget, focusPlayer, publishCameraPose]);

  useEffect(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls || !cameraCommand || cameraCommand.type === 'reframe') return;
    const next = stepOperatorCamera(
      camera.position.toArray(),
      controls.target.toArray(),
      cameraCommand.type,
      interactionPolicy,
    );
    camera.position.set(...next.position);
    controls.target.set(...next.target);
    targetRef.current.copy(controls.target);
    controls.update();
    publishCameraPose();
  }, [cameraCommand, interactionPolicy, publishCameraPose]);

  const keepTargetInsideCourt = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const clamped = clampCameraTarget(controls.target.toArray(), interactionPolicy);
    clampDeltaRef.current.set(...clamped).sub(controls.target);
    if (clampDeltaRef.current.lengthSq() <= 0.000001) return;
    controls.target.add(clampDeltaRef.current);
    camera.position.add(clampDeltaRef.current);
    targetRef.current.copy(controls.target);
  }, [interactionPolicy]);

  useFrame((_, delta) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    if (following) {
      const positionRate = cameraId === 'player'
        ? ROLE_CAMERA_POSITION_TRACKING_RATE
        : cameraId === 'overhead'
          ? OVERHEAD_CAMERA_POSITION_TRACKING_RATE
          : CAMERA_TRACKING_RATE;
      const aimRate = cameraId === 'player'
        ? ROLE_CAMERA_AIM_TRACKING_RATE
        : cameraId === 'overhead'
          ? OVERHEAD_CAMERA_AIM_TRACKING_RATE
          : CAMERA_TRACKING_RATE;
      const positionBlend = 1 - Math.exp(-positionRate * Math.min(delta, 0.05));
      const aimBlend = 1 - Math.exp(-aimRate * Math.min(delta, 0.05));
      camera.position.lerp(desiredPosition, positionBlend);
      controls.target.lerp(desiredTarget, aimBlend);
      targetRef.current.copy(controls.target);
      camera.fov += (config.fov - camera.fov) * aimBlend;
    } else if (cameraId === 'player' && focusPlayer) {
      focusDeltaRef.current
        .set(...focusPlayer.worldPosition)
        .sub(lastFocusPositionRef.current);
      camera.position.add(focusDeltaRef.current);
      controls.target.add(focusDeltaRef.current);
      targetRef.current.copy(controls.target);
    }
    if (focusPlayer) lastFocusPositionRef.current.set(...focusPlayer.worldPosition);
    camera.updateProjectionMatrix();
    controls.update();
  });

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        position={config.position}
        fov={config.fov}
        near={0.1}
        far={180}
        onUpdate={(camera) => {
          targetRef.current.set(...config.target);
          camera.lookAt(targetRef.current);
        }}
      />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.075}
        enablePan={interactionPolicy.enablePan}
        enableRotate={interactionPolicy.enableRotate}
        enableZoom={interactionPolicy.enableZoom}
        keyPanSpeed={18}
        maxDistance={interactionPolicy.maxDistance}
        maxPolarAngle={interactionPolicy.maxPolarAngle}
        minDistance={interactionPolicy.minDistance}
        minPolarAngle={interactionPolicy.minPolarAngle}
        mouseButtons={gestureBindings.mouseButtons}
        panSpeed={portrait ? 1.02 : 0.86}
        rotateSpeed={portrait ? 0.58 : 0.7}
        screenSpacePanning={false}
        touches={gestureBindings.touches}
        zoomSpeed={0.88}
        zoomToCursor
        onChange={keepTargetInsideCourt}
        onEnd={publishCameraPose}
        onStart={onManualControl}
      />
    </>
  );
}

function AuthoritativeReplayBall({
  ball,
  contactPoints,
  locatorRadii,
  playbackRate,
  playbackTime,
  replay,
  segments,
}) {
  const meshRef = useRef(null);
  const locatorRef = useRef(null);
  const targetPosition = useMemo(() => new Vector3(), []);
  const ballStateRef = useRef({ ball, elapsed: 0, publishedTime: playbackTime });
  const initialPosition = productionBallPosition(ball, null);
  const motionStreakWidth = ballMotionStreakWidth(ball);

  useEffect(() => {
    ballStateRef.current = { ball, elapsed: 0, publishedTime: playbackTime };
  }, [ball, playbackTime]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const state = ballStateRef.current;
    state.elapsed += delta;
    const renderTime = ballRenderSampleTime({
      publishedTime: state.publishedTime,
      elapsedSeconds: state.elapsed,
      playbackRate,
      duration: replay.duration,
    });
    const renderBall = playbackRate > 0
      ? samplePlayScene(replay, renderTime).ball
      : state.ball;
    const contactPoint = renderBall.stickTargetPlayerId
      ? contactPoints.get(renderBall.stickTargetPlayerId)
      : null;
    const position = productionBallPosition(renderBall, contactPoint);
    targetPosition.set(position.x, position.y, position.z);
    const blend = playbackRate > 0 ? 1 - Math.exp(-38 * delta) : 1;
    meshRef.current.position.lerp(targetPosition, blend);
    locatorRef.current?.position.set(
      meshRef.current.position.x,
      0.014,
      meshRef.current.position.z,
    );
  });

  return (
    <>
      <Trail
        width={motionStreakWidth}
        length={1}
        decay={1}
        stride={0.018}
        interval={1}
        color="#ff8b2d"
      >
        <mesh ref={meshRef} position={[initialPosition.x, initialPosition.y, initialPosition.z]}>
          <sphereGeometry args={[BALL_RADIUS_METERS, ...segments]} />
          <meshStandardMaterial color="#ff7417" emissive="#ff4d00" emissiveIntensity={0.72} roughness={0.34} />
        </mesh>
      </Trail>
      <mesh
        ref={locatorRef}
        position={[initialPosition.x, 0.014, initialPosition.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={2}
      >
        <ringGeometry args={[...locatorRadii, 32]} />
        <meshBasicMaterial color="#ff7a1a" transparent opacity={0.76} depthWrite={false} />
      </mesh>
    </>
  );
}

function RuntimeFrameTelemetry({
  clipTransitionEventsRef,
  focusPlayerId,
  groundContacts,
  onSample,
  onTransitionSample,
  playbackTime,
  poseSamples,
  transitionWindow,
}) {
  const samples = useRef([]);
  const footSlideSamples = useRef([]);
  const previousFeet = useRef(new Map());
  const footTelemetryElapsed = useRef(Number.POSITIVE_INFINITY);
  const transition = useRef({
    authoredClearanceSamples: [],
    authoredContactSampleCount: 0,
    authoredFootSlideSamples: [],
    authoredPlantedContactSampleCount: 0,
    authoredOppositeClearanceSamples: [],
    complete: false,
    events: [],
    footMotionSamples: [],
    footSlideSamples: [],
    frameIntervals: [],
    key: null,
    lastPlaybackTime: null,
    previousMotionFeet: new Map(),
    previousAuthoredFeet: new Map(),
    previousFeet: new Map(),
  });

  useFrame((_, delta) => {
    samples.current.push(delta * 1000);
    footTelemetryElapsed.current += delta;
    if (transitionWindow || footTelemetryElapsed.current >= 0.1) {
      footTelemetryElapsed.current = 0;
      const sliding = measurePlantedFootSliding(groundContacts.entries(), previousFeet.current);
      previousFeet.current = sliding.nextFeet;
      footSlideSamples.current.push(...sliding.samples);
    }
    if (samples.current.length >= 120) {
      const summary = summarizeFrameIntervals(samples.current);
      samples.current = [];
      const grounding = summarizeGroundContacts(groundContacts.values());
      const footSliding = summarizeFootSlideSamples(footSlideSamples.current);
      const selectedPose = poseSamples.get(focusPlayerId);
      footSlideSamples.current = [];
      if (summary) onSample({ ...summary, ...grounding, ...footSliding, selectedPose });
    }

    if (!transitionWindow) return;
    const state = transition.current;
    const movedBackward = state.lastPlaybackTime != null && playbackTime < state.lastPlaybackTime - 0.02;
    if (state.key !== transitionWindow.key || movedBackward) {
      state.complete = false;
      state.authoredClearanceSamples = [];
      state.authoredContactSampleCount = 0;
      state.authoredFootSlideSamples = [];
      state.authoredPlantedContactSampleCount = 0;
      state.authoredOppositeClearanceSamples = [];
      state.events = [];
      state.footMotionSamples = [];
      state.footSlideSamples = [];
      state.frameIntervals = [];
      state.key = transitionWindow.key;
      state.previousMotionFeet = new Map();
      state.previousAuthoredFeet = new Map();
      state.previousFeet = new Map();
    }

    const observedEvents = clipTransitionEventsRef.current.splice(0);
    if (!state.complete && observedEvents.length > 0) {
      state.events.push(...transitionEventsForWindow(observedEvents, transitionWindow));
    }
    state.lastPlaybackTime = playbackTime;

    const insideWindow = playbackTime >= transitionWindow.start
      && playbackTime <= transitionWindow.end;
    if (insideWindow && !state.complete) {
      const contactEntries = transitionWindow.playerId
        ? [...groundContacts.entries()].filter(([playerId]) => playerId === transitionWindow.playerId)
        : [...groundContacts.entries()];
      const sliding = measurePlantedFootSliding(contactEntries, state.previousFeet);
      const motion = measureFootDisplacement(contactEntries, state.previousMotionFeet);
      const authored = measureAuthoredContactSliding(contactEntries, state.previousAuthoredFeet);
      state.previousFeet = sliding.nextFeet;
      state.previousMotionFeet = motion.nextFeet;
      state.previousAuthoredFeet = authored.nextFeet;
      state.frameIntervals.push(delta * 1000);
      state.footMotionSamples.push(...motion.samples);
      state.footSlideSamples.push(...sliding.samples);
      state.authoredClearanceSamples.push(...authored.clearanceSamples);
      state.authoredContactSampleCount += authored.contactSampleCount;
      state.authoredFootSlideSamples.push(...authored.samples);
      state.authoredPlantedContactSampleCount += authored.plantedContactSampleCount;
      state.authoredOppositeClearanceSamples.push(...authored.oppositeClearanceSamples);
    }

    if (playbackTime >= transitionWindow.end && !state.complete && state.frameIntervals.length > 0) {
      const contactValues = transitionWindow.playerId
        ? [groundContacts.get(transitionWindow.playerId)].filter(Boolean)
        : [...groundContacts.values()];
      state.complete = true;
      onTransitionSample(summarizeTransitionTelemetry({
        window: transitionWindow,
        frameIntervals: state.frameIntervals,
        footMotionSamples: state.footMotionSamples,
        footSlideSamples: state.footSlideSamples,
        authoredClearanceSamples: state.authoredClearanceSamples,
        authoredContactSampleCount: state.authoredContactSampleCount,
        authoredFootSlideSamples: state.authoredFootSlideSamples,
        authoredPlantedContactSampleCount: state.authoredPlantedContactSampleCount,
        authoredOppositeClearanceSamples: state.authoredOppositeClearanceSamples,
        clipTransitions: state.events,
        groundContacts: contactValues,
      }));
    }
  });

  return null;
}

function ReplayScene({
  replay,
  frame,
  athletes,
  playbackRate,
  playbackTime,
  cameraId,
  cameraCommand,
  cameraFollowing,
  cameraGestureMode,
  selectedPosition,
  renderProfile,
  athleteAssets,
  clipTransitionEventsRef,
  motionTuning,
  onFrameSample,
  onCameraManualControl,
  onCameraPoseChange,
  onMixerTransition,
  onTransitionSample,
  theme,
  transitionWindow,
}) {
  const contactPoints = useMemo(() => new Map(), []);
  const groundContacts = useMemo(() => new Map(), []);
  const poseSamples = useMemo(() => new Map(), []);
  const focusPlayer = athletes.find((player) => player.team === 'us' && player.role === selectedPosition)
    ?? athletes.find((player) => player.team === 'us' && player.role !== 'G');
  const cameraBallPosition = useMemo(() => productionBallPosition(frame.ball, null), [frame.ball]);
  const penaltyBoxTeams = useMemo(
    () => [...new Set(athletes.filter((player) => player.penaltyBox).map((player) => player.team))],
    [athletes],
  );
  const sceneBackground = theme === 'light' ? '#dfe5e8' : '#080c13';
  const sceneGroundColor = theme === 'light' ? '#aeb9c1' : '#182331';

  return (
    <>
      <color attach="background" args={[sceneBackground]} />
      <fog attach="fog" args={[sceneBackground, 62, 118]} />
      <hemisphereLight intensity={2.2} color="#f4fbff" groundColor={sceneGroundColor} />
      <directionalLight intensity={3.4} color="#fff7ea" position={[14, 30, -20]} />
      <directionalLight intensity={1.6} color="#9fd8ff" position={[-18, 18, 24]} />
      <ProductionCourt penaltyBoxTeams={penaltyBoxTeams} theme={theme} />
      {focusPlayer && (
        <mesh
          position={[focusPlayer.worldPosition[0], 0.018, focusPlayer.worldPosition[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={2}
        >
          <ringGeometry args={[0.62, 0.76, 48]} />
          <meshBasicMaterial color="#3de7ff" transparent opacity={0.88} depthWrite={false} />
        </mesh>
      )}
      {athletes.map((player) => (
        <ProductionAthlete
          key={player.id}
          assetUrl={athleteAssets[player.assetKey]}
          actionPhase={player.actionPhase}
          authoredTransitionClip={motionTuning?.authoredTransitionClip}
          blendSeconds={motionTuning?.blendSeconds}
          clipName={player.clipName}
          contactActive={frame.ball.stickTargetPlayerId === player.id && frame.ball.stickContactWeight > 0}
          contactPoints={contactPoints}
          groundContacts={groundContacts}
          groundSampleInterval={transitionWindow ? 0 : NORMAL_GROUND_SAMPLE_INTERVAL_SECONDS}
          motionPhaseCycles={player.motionPhaseCycles}
          motionCyclesPerSecond={player.locomotionCadence?.cyclesPerSecond ?? 0}
          onClipTransition={onMixerTransition}
          playbackRate={playbackRate}
          playbackTime={playbackTime}
          playerId={player.id}
          poseSamples={poseSamples}
          position={player.worldPosition}
          rotation={player.worldRotation}
          transitionEventsRef={clipTransitionEventsRef}
          worldAngularVelocity={player.worldAngularVelocity}
          worldVelocity={player.worldVelocity}
        />
      ))}
      <AuthoritativeReplayBall
        ball={frame.ball}
        contactPoints={contactPoints}
        locatorRadii={ballLocatorRadii(cameraId)}
        playbackRate={playbackRate}
        playbackTime={playbackTime}
        replay={replay}
        segments={renderProfile.ballSegments}
      />
      <RuntimeFrameTelemetry
        clipTransitionEventsRef={clipTransitionEventsRef}
        focusPlayerId={focusPlayer?.id}
        groundContacts={groundContacts}
        onSample={onFrameSample}
        onTransitionSample={onTransitionSample}
        playbackTime={playbackTime}
        poseSamples={poseSamples}
        transitionWindow={transitionWindow}
      />
      <CameraRig
        ball={frame.ball}
        ballPosition={cameraBallPosition}
        cameraCommand={cameraCommand}
        cameraId={cameraId}
        focusPlayer={focusPlayer}
        following={cameraFollowing}
        gestureMode={cameraGestureMode}
        onCameraPoseChange={onCameraPoseChange}
        onManualControl={onCameraManualControl}
        playbackTime={playbackTime}
        players={athletes}
        replay={replay}
      />
    </>
  );
}

function AssetProgress() {
  const { active, progress } = useProgress();
  if (!active) return <span>4 ASSETS READY</span>;
  return <span>LOADING {Math.round(progress)}%</span>;
}

export default function ProductionReplayPreview() {
  const { theme } = useTheme();
  const {
    currentPlay,
    currentPhase,
    isPlaying,
    playbackTime,
    selectedPosition,
    replay3dCamera,
    setReplay3dCamera,
    setRoleFocusMode,
    setSelectedPosition,
    speed,
  } = useApp();
  const workspaceLayout = useWorkspaceLayout();
  const renderProfile = productionRenderProfile(workspaceLayout);
  const motionReview = useMemo(() => (
    new URLSearchParams(window.location.search).get('motionReview')
      ?? TACTICAL_DISTANCE_BASELINE_ID
  ), []);
  const transitionWindow = useMemo(() => (
    parseTransitionTelemetryWindow(new URLSearchParams(window.location.search))
  ), []);
  const motionTuning = useMemo(() => (
    {
      ...parsePrivateMotionTuning(new URLSearchParams(window.location.search), motionReview),
      authoredTransitionClip: [
        'cmu-jog16-ik',
        'cmu-jog16-ik-uniform',
        'cmu-jog16-ik-red-sleeve',
        'cmu-jog16-ik-continuous-jersey',
        'cmu-jog16-ik-upper-body',
        'cmu-jog16-ik-open-face',
        'cmu-jog16-ik-natural-grip',
        'cmu-jog16-ik-diagonal-stick',
        'cmu-jog16-ik-pbr',
        'cmu-jog16-ik-silhouette',
        'cmu-jog16-ik-tailored-uniform',
        'cmu-jog16-ik-cloth-drape',
        'cmu-jog16-ik-helmet-detail',
        'cmu-jog16-ik-face-pose',
        'cmu-jog16-ik-neck-boundary',
      ].includes(motionReview)
        ? 'jog-to-sprint-ik'
        : null,
    }
  ), [motionReview]);
  const effectiveSprintPhaseOffset = productionClipPhaseOffset('sprint', motionReview, motionTuning);
  const athleteAssets = useMemo(
    () => athleteAssetsForMotionReview(motionReview),
    [motionReview],
  );
  const [frameStats, setFrameStats] = useState(null);
  const [cameraCommand, setCameraCommand] = useState({ revision: 0, type: 'reframe' });
  const [freeLookCameraId, setFreeLookCameraId] = useState(null);
  const [cameraGestureMode, setCameraGestureMode] = useState(CAMERA_GESTURE_MODES.ORBIT);
  const [cameraInteractionCount, setCameraInteractionCount] = useState(0);
  const [cameraPose, setCameraPose] = useState(null);
  const [fullscreenSupported] = useState(() => Boolean(document.fullscreenEnabled));
  const [stageFullscreen, setStageFullscreen] = useState(false);
  const [mixerTransitions, setMixerTransitions] = useState(null);
  const [transitionStats, setTransitionStats] = useState(null);
  const clipTransitionEventsRef = useRef([]);
  const stageRef = useRef(null);
  const cameraFollowing = freeLookCameraId !== replay3dCamera;

  const issueCameraCommand = useCallback((type) => {
    setCameraCommand((previous) => ({ revision: previous.revision + 1, type }));
  }, []);

  useEffect(() => {
    const syncFullscreen = () => setStageFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const handleCameraPreset = useCallback((cameraId) => {
    setFreeLookCameraId(null);
    if (cameraId === replay3dCamera) issueCameraCommand('reframe');
    else setReplay3dCamera(cameraId);
  }, [issueCameraCommand, replay3dCamera, setReplay3dCamera]);

  const handleRoleCameraSelect = useCallback((position) => {
    setSelectedPosition(position);
    setRoleFocusMode(roleLensForPosition(position));
    setFreeLookCameraId(null);
    if (replay3dCamera !== 'player') setReplay3dCamera('player');
    issueCameraCommand('reframe');
  }, [
    issueCameraCommand,
    replay3dCamera,
    setReplay3dCamera,
    setRoleFocusMode,
    setSelectedPosition,
  ]);

  const handleCameraManualControl = useCallback(() => {
    setFreeLookCameraId(replay3dCamera);
    setCameraInteractionCount((count) => count + 1);
  }, [replay3dCamera]);

  const handleFollowToggle = useCallback(() => {
    const nextFollowing = !cameraFollowing;
    setFreeLookCameraId(nextFollowing ? null : replay3dCamera);
    if (nextFollowing) issueCameraCommand('reframe');
  }, [cameraFollowing, issueCameraCommand, replay3dCamera]);

  const handleReframe = useCallback(() => {
    setFreeLookCameraId(null);
    issueCameraCommand('reframe');
  }, [issueCameraCommand]);

  const handleOperatorCommand = useCallback((type) => {
    setFreeLookCameraId(replay3dCamera);
    issueCameraCommand(type);
    setCameraInteractionCount((count) => count + 1);
  }, [issueCameraCommand, replay3dCamera]);

  const handleCameraGestureMode = useCallback((mode) => {
    setCameraGestureMode(mode);
    setFreeLookCameraId(replay3dCamera);
    setCameraInteractionCount((count) => count + 1);
  }, [replay3dCamera]);

  const handleCameraKeyDown = useCallback((event) => {
    if (event.target instanceof Element && event.target.closest('button,input,select,textarea')) return;
    const key = event.key.toLowerCase();
    const command = event.key === 'ArrowLeft'
      ? event.shiftKey ? 'pan-left' : 'orbit-left'
      : event.key === 'ArrowRight'
        ? event.shiftKey ? 'pan-right' : 'orbit-right'
        : event.key === 'ArrowUp'
          ? event.shiftKey ? 'pan-forward' : 'orbit-up'
          : event.key === 'ArrowDown'
            ? event.shiftKey ? 'pan-back' : 'orbit-down'
            : ['+', '='].includes(event.key)
              ? 'zoom-in'
              : ['-', '_'].includes(event.key)
                ? 'zoom-out'
                : null;

    if (command) {
      event.preventDefault();
      event.stopPropagation();
      handleOperatorCommand(command);
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
      handleReframe();
    }
  }, [
    cameraGestureMode,
    handleCameraGestureMode,
    handleFollowToggle,
    handleOperatorCommand,
    handleReframe,
  ]);

  const toggleStageFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement === stageRef.current) await document.exitFullscreen();
      else await stageRef.current?.requestFullscreen();
    } catch {
      setStageFullscreen(false);
    }
  }, []);
  const handleFrameSample = useCallback(
    (summary) => setFrameStats({ ...summary, profileId: renderProfile.id }),
    [renderProfile.id],
  );
  const handleMixerTransition = useCallback((event) => {
    if (!transitionWindow) return;
    if (transitionEventsForWindow([event], transitionWindow).length === 0) return;
    setMixerTransitions((previous) => ({
      windowKey: transitionWindow.key,
      events: transitionEventsForWindow(
        previous?.windowKey === transitionWindow.key ? [...previous.events, event] : [event],
        transitionWindow,
      ),
    }));
  }, [transitionWindow]);
  const replay = getPlayScene(currentPlay?.id);
  const frame = useMemo(() => (replay ? samplePlayScene(replay, playbackTime) : null), [playbackTime, replay]);
  const possessionLabel = replayPossessionLabel(frame);
  const nextRead = replayNextRead(frame);
  const tacticalSpacing = standardBreakoutTacticalSpacing(frame);
  const motionStreakWidth = ballMotionStreakWidth(frame.ball);
  const athletes = useMemo(
    () => (frame ? createProductionRuntimePlayers(frame, motionReview, motionTuning) : []),
    [frame, motionReview, motionTuning],
  );
  const homeGoalie = athletes.find((player) => player.team === 'us' && player.role === 'G');
  const awayGoalie = athletes.find((player) => player.team === 'opponent' && player.role === 'G');
  const selectedAthlete = athletes.find((player) => (
    player.team === 'us' && player.role === selectedPosition
  ));
  const boxedAthlete = athletes.find((player) => player.penaltyBox);
  const roleCameraState = productionCameraPose('player', {
    ball: frame.ball,
    ballPosition: productionBallPosition(frame.ball, null),
    focusPlayer: selectedAthlete,
    players: athletes,
    playbackTime,
    replay,
  });
  const activeFrameStats = frameStats?.profileId === renderProfile.id ? frameStats : null;
  const activeTransitionStats = transitionStats?.windowKey === transitionWindow?.key
    ? transitionStats
    : null;
  const activeMixerTransitions = mixerTransitions && transitionWindow
    && mixerTransitions.windowKey === transitionWindow.key
    ? mixerTransitions.events
    : null;
  const firstMixerTransition = activeMixerTransitions?.[0] ?? null;
  const finalMixerTransition = activeMixerTransitions?.at(-1) ?? null;
  const transitionStatus = !transitionWindow
    ? 'disabled'
    : activeTransitionStats?.status
      ?? (playbackTime < transitionWindow.start ? 'armed' : 'collecting');

  if (!replay || !frame) {
    return (
      <main className="vnext3d-preview-empty">
        <strong>3D replay is being authored for this play.</strong>
      </main>
    );
  }

  return (
    <main
      className="vnext3d-preview-view"
      data-testid="vnext-3d-production-preview"
      data-camera-id={replay3dCamera}
      data-phase={currentPhase}
      data-playing={isPlaying}
      data-motion-review={motionReview}
      data-motion-sprint-phase-offset={effectiveSprintPhaseOffset}
      data-motion-blend-seconds={motionTuning?.blendSeconds ?? 0.18}
      data-replay-time={playbackTime}
      data-player-count={frame.players.length}
      data-penalty-box-player={boxedAthlete?.id ?? 'none'}
      data-penalty-box-team={boxedAthlete?.team ?? 'none'}
      data-penalty-box-world-x={boxedAthlete?.worldPosition?.[0] ?? 'none'}
      data-penalty-box-world-z={boxedAthlete?.worldPosition?.[2] ?? 'none'}
      data-ball-segment={frame.ball.segmentType}
      data-ball-owner={frame.ball.ownerId ?? 'none'}
      data-ball-x={frame.ball.position.x}
      data-ball-y={frame.ball.position.y}
      data-ball-board-phase={frame.ball.boardPhase ?? 'none'}
      data-ball-world-height={Number(productionBallHeightMeters(frame.ball).toFixed(4))}
      data-ball-contact={frame.ball.stickContact ?? 'none'}
      data-ball-contact-target={frame.ball.stickTargetPlayerId ?? 'none'}
      data-ball-contact-weight={frame.ball.stickContactWeight ?? 0}
      data-ball-motion-streak-width={motionStreakWidth}
      data-ball-render-mode="canonical-sample"
      data-possession={possessionLabel}
      data-next-read={nextRead}
      data-spacing-phase={tacticalSpacing.phase}
      data-spacing-status={tacticalSpacing.status}
      data-goalie-home-action={homeGoalie?.clipName ?? 'none'}
      data-goalie-away-action={awayGoalie?.clipName ?? 'none'}
      data-selected-athlete-action={selectedAthlete?.clipName ?? 'none'}
      data-selected-athlete-speed={selectedAthlete?.speedMps ?? 0}
      data-selected-athlete-cadence-hz={selectedAthlete?.locomotionCadence?.cyclesPerSecond ?? 0}
      data-selected-athlete-cycle-seconds={selectedAthlete?.locomotionCadence?.cycleDurationSeconds ?? 0}
      data-selected-athlete-action-time={activeFrameStats?.selectedPose?.actionTime ?? 'pending'}
      data-selected-athlete-animation-weight={activeFrameStats?.selectedPose?.effectiveWeight ?? 'pending'}
      data-selected-athlete-hand-span-mm={activeFrameStats?.selectedPose
        ? Number((activeFrameStats.selectedPose.handSpan * 1000).toFixed(1))
        : 'pending'}
      data-camera-tracking={cameraTrackingMode(replay3dCamera)}
      data-camera-control={cameraFollowing ? 'follow' : 'free-look'}
      data-camera-gesture-mode={cameraGestureMode}
      data-camera-position={cameraPose?.position?.join(',') ?? 'pending'}
      data-camera-target={cameraPose?.target?.join(',') ?? 'pending'}
      data-role-camera-position={selectedPosition}
      data-role-camera-intent={roleCameraState.intent}
      data-role-camera-target={roleCameraState.targetPlayerId ?? 'ball'}
      data-camera-interaction-count={cameraInteractionCount}
      data-render-profile={renderProfile.id}
      data-render-dpr-max={renderProfile.dpr[1]}
      data-render-antialias={renderProfile.antialias}
      data-frame-sample-count={activeFrameStats?.sampleCount ?? 0}
      data-frame-mean-ms={activeFrameStats?.meanMs ?? 'pending'}
      data-frame-p95-ms={activeFrameStats?.p95Ms ?? 'pending'}
      data-frame-max-ms={activeFrameStats?.maxMs ?? 'pending'}
      data-frame-under-30-fps={activeFrameStats?.under30FpsFrames ?? 'pending'}
      data-ground-sample-count={activeFrameStats?.groundSampleCount ?? 0}
      data-ground-min-mm={activeFrameStats?.groundMinimumMm ?? 'pending'}
      data-ground-max-mm={activeFrameStats?.groundMaximumMm ?? 'pending'}
      data-ground-max-correction-mm={activeFrameStats?.groundMaximumCorrectionMm ?? 'pending'}
      data-grounded-player-count={activeFrameStats?.groundedPlayerCount ?? 0}
      data-foot-slide-sample-count={activeFrameStats?.footSlideSampleCount ?? 0}
      data-foot-slide-mean-mm={activeFrameStats?.footSlideMeanMm ?? 'pending'}
      data-foot-slide-p95-mm={activeFrameStats?.footSlideP95Mm ?? 'pending'}
      data-foot-slide-max-mm={activeFrameStats?.footSlideMaxMm ?? 'pending'}
      data-transition-window-status={transitionStatus}
      data-transition-window-start={transitionWindow?.start ?? 'disabled'}
      data-transition-window-end={transitionWindow?.end ?? 'disabled'}
      data-transition-window-player={transitionWindow?.playerId ?? 'all'}
      data-transition-event-count={activeMixerTransitions?.length ?? activeTransitionStats?.transitionCount ?? 0}
      data-transition-from={firstMixerTransition?.from ?? activeTransitionStats?.transitionFrom ?? 'pending'}
      data-transition-to={finalMixerTransition?.to ?? activeTransitionStats?.transitionTo ?? 'pending'}
      data-transition-authored-clip={firstMixerTransition?.authoredClip ?? 'none'}
      data-transition-replay-time={firstMixerTransition?.replayTime ?? activeTransitionStats?.transitionReplayTime ?? 'pending'}
      data-transition-end-replay-time={finalMixerTransition?.replayTime ?? 'pending'}
      data-transition-frame-sample-count={activeTransitionStats?.sampleCount ?? 0}
      data-transition-frame-p95-ms={activeTransitionStats?.p95Ms ?? 'pending'}
      data-transition-foot-slide-sample-count={activeTransitionStats?.footSlideSampleCount ?? 0}
      data-transition-foot-slide-mean-mm={activeTransitionStats?.footSlideMeanMm ?? 'pending'}
      data-transition-foot-slide-p95-mm={activeTransitionStats?.footSlideP95Mm ?? 'pending'}
      data-transition-foot-slide-max-mm={activeTransitionStats?.footSlideMaxMm ?? 'pending'}
      data-transition-foot-motion-sample-count={activeTransitionStats?.footMotionSampleCount ?? 0}
      data-transition-foot-motion-mean-mm={activeTransitionStats?.footMotionMeanMm ?? 'pending'}
      data-transition-foot-motion-p95-mm={activeTransitionStats?.footMotionP95Mm ?? 'pending'}
      data-transition-foot-motion-max-mm={activeTransitionStats?.footMotionMaxMm ?? 'pending'}
      data-transition-foot-motion-peak-ratio={activeTransitionStats?.footMotionPeakRatio ?? 'pending'}
      data-transition-ground-min-mm={activeTransitionStats?.groundMinimumMm ?? 'pending'}
      data-transition-authored-contact-sample-count={activeTransitionStats?.authoredContactSampleCount ?? 0}
      data-transition-authored-planted-sample-count={activeTransitionStats?.authoredPlantedContactSampleCount ?? 0}
      data-transition-authored-foot-slide-sample-count={activeTransitionStats?.authoredFootSlideSampleCount ?? 0}
      data-transition-authored-foot-slide-mean-mm={activeTransitionStats?.authoredFootSlideMeanMm ?? 'pending'}
      data-transition-authored-foot-slide-p95-mm={activeTransitionStats?.authoredFootSlideP95Mm ?? 'pending'}
      data-transition-authored-foot-slide-max-mm={activeTransitionStats?.authoredFootSlideMaxMm ?? 'pending'}
      data-transition-authored-clearance-min-mm={activeTransitionStats?.authoredContactClearanceMinimumMm ?? 'pending'}
      data-transition-authored-clearance-p95-mm={activeTransitionStats?.authoredContactClearanceP95Mm ?? 'pending'}
      data-transition-authored-clearance-max-mm={activeTransitionStats?.authoredContactClearanceMaximumMm ?? 'pending'}
      data-transition-authored-opposite-clearance-min-mm={activeTransitionStats?.authoredOppositeClearanceMinimumMm ?? 'pending'}
      data-transition-authored-opposite-clearance-max-mm={activeTransitionStats?.authoredOppositeClearanceMaximumMm ?? 'pending'}
    >
      <section
        ref={stageRef}
        className="vnext3d-preview-stage"
        aria-label="Interactive production 3D replay"
        data-camera-control={cameraFollowing ? 'follow' : 'free-look'}
        data-camera-gesture-mode={cameraGestureMode}
        onKeyDown={handleCameraKeyDown}
        onPointerDown={(event) => {
          if (event.target instanceof HTMLCanvasElement) stageRef.current?.focus({ preventScroll: true });
        }}
        tabIndex={0}
      >
        <Canvas
          key={renderProfile.id}
          dpr={renderProfile.dpr}
          gl={{ antialias: renderProfile.antialias, alpha: false, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            gl.outputColorSpace = SRGBColorSpace;
            gl.toneMapping = ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.08;
          }}
        >
          <Suspense fallback={null}>
            <ReplayScene
              replay={replay}
              frame={frame}
              athletes={athletes}
              playbackRate={isPlaying ? speed : 0}
              playbackTime={playbackTime}
              cameraId={replay3dCamera}
              cameraCommand={cameraCommand}
              cameraFollowing={cameraFollowing}
              cameraGestureMode={cameraGestureMode}
              selectedPosition={selectedPosition}
              renderProfile={renderProfile}
              athleteAssets={athleteAssets}
              clipTransitionEventsRef={clipTransitionEventsRef}
              motionTuning={motionTuning}
              onFrameSample={handleFrameSample}
              onCameraManualControl={handleCameraManualControl}
              onCameraPoseChange={setCameraPose}
              onMixerTransition={handleMixerTransition}
              onTransitionSample={setTransitionStats}
              theme={theme}
              transitionWindow={transitionWindow}
            />
          </Suspense>
        </Canvas>

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

        {replay3dCamera === 'player' && (
          <RoleCameraSelector
            onSelect={handleRoleCameraSelect}
            selectedPosition={selectedPosition}
          />
        )}

        <div className="vnext3d-camera-operator" role="toolbar" aria-label="3D camera navigation">
          <button
            type="button"
            className={cameraFollowing ? 'is-active' : ''}
            aria-label={cameraFollowing ? 'Pause action camera follow' : 'Follow the action'}
            aria-pressed={cameraFollowing}
            onClick={handleFollowToggle}
            title={cameraFollowing ? 'Pause action follow (F)' : 'Follow the action (F)'}
          >
            <Crosshair aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Recenter selected camera angle"
            onClick={handleReframe}
            title="Recenter camera (0)"
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
            onClick={() => handleOperatorCommand('zoom-out')}
            title="Zoom out (-)"
          >
            <ZoomOut aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => handleOperatorCommand('zoom-in')}
            title="Zoom in (+)"
          >
            <ZoomIn aria-hidden="true" />
          </button>
          {fullscreenSupported && (
            <button
              type="button"
              aria-label={stageFullscreen ? 'Exit full screen 3D replay' : 'View 3D replay full screen'}
              onClick={toggleStageFullscreen}
              title={stageFullscreen ? 'Exit full screen' : 'Full screen'}
            >
              {stageFullscreen
                ? <Minimize2 aria-hidden="true" />
                : <Maximize2 aria-hidden="true" />}
            </button>
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
            <PlaybackControls compact />
          </div>
        )}
      </section>

      <section className="vnext3d-preview-console" aria-label="3D replay controls and status">
        <div className="vnext3d-preview-identity">
          <span>TACTICAL REPLAY</span>
          <strong>{replay.title}</strong>
          <small>{frame.event?.label ?? 'Ready for replay'}</small>
          <div className="vnext3d-tactical-state" aria-live="polite">
            <div>
              <span>POSSESSION</span>
              <strong>{possessionLabel}</strong>
            </div>
            <div>
              <span>NEXT READ</span>
              <strong>{nextRead}</strong>
            </div>
          </div>
        </div>
        <div className="vnext3d-preview-metrics">
          <div><span>PLAYERS</span><strong>{frame.players.length}</strong></div>
          <div><span>PHASE</span><strong>{currentPhase + 1}</strong></div>
          <div><span>TIME</span><strong>{playbackTime.toFixed(1)}s</strong></div>
          <AssetProgress />
        </div>
        <div className="vnext3d-preview-transport">
          <PlaybackControls compact />
        </div>
      </section>
    </main>
  );
}
