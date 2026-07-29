import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import {
  Vector3,
} from 'three';
import ProductionCourt from '../components/vnext3d/ProductionCourt';
import {
  CAMERA_TRACKING_RATE,
  OVERHEAD_CAMERA_AIM_TRACKING_RATE,
  OVERHEAD_CAMERA_POSITION_TRACKING_RATE,
  ROLE_CAMERA_AIM_TRACKING_RATE,
  ROLE_CAMERA_POSITION_TRACKING_RATE,
  cameraGestureBindings,
  cameraInteractionPolicy,
  clampCameraTarget,
  productionCameraPose,
  stepOperatorCamera,
} from '../vnext3d/cameraSystem';
import { summarizeFrameIntervals } from '../vnext3d/renderProfile';
import {
  sampleTacticalBallTrail,
  sampleTacticalReplay,
  TACTICAL_BALL_RADIUS_METERS,
} from './sampleTacticalReplay';
import { rolesForRoleLens } from '../play-engine/teamJobs';
import { isPenaltyBoxPlayer } from '../play-engine/penaltyBox';
import TacticalAthlete from './TacticalAthlete';
import TacticalReplayLayers from './TacticalReplayLayers';

const TIME_PUBLISH_INTERVAL_SECONDS = 1 / 30;

function RegisteredAthlete({ assetUrl, playerId, registry }) {
  const athleteRef = useRef(null);

  useEffect(() => {
    const controllers = registry.current;
    if (athleteRef.current) controllers.set(playerId, athleteRef.current);
    return () => controllers.delete(playerId);
  }, [playerId, registry]);

  return <TacticalAthlete ref={athleteRef} assetUrl={assetUrl} />;
}

function RuntimeCamera({
  cameraCommand,
  cameraId,
  following,
  frameRef,
  focusRoles,
  gestureMode,
  onManualControl,
  onCameraPoseChange,
  replay,
  selectedPosition,
}) {
  const { size } = useThree();
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const initializedRef = useRef(false);
  const commandRevisionRef = useRef(-1);
  const lastFocusPositionRef = useRef(new Vector3());
  const focusDeltaRef = useRef(new Vector3());
  const clampDeltaRef = useRef(new Vector3());
  const desiredPosition = useMemo(() => new Vector3(), []);
  const desiredTarget = useMemo(() => new Vector3(), []);
  const portrait = size.height > size.width * 1.18;
  const compactOverhead = cameraId === 'overhead' && size.width < 640;
  const policy = useMemo(
    () => cameraInteractionPolicy(cameraId, { portrait }),
    [cameraId, portrait],
  );
  const gestureBindings = useMemo(
    () => cameraGestureBindings(gestureMode),
    [gestureMode],
  );
  const publishCameraPose = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    onCameraPoseChange?.({
      position: camera.position.toArray().map((value) => Number(value.toFixed(4))),
      target: controls.target.toArray().map((value) => Number(value.toFixed(4))),
    });
  }, [onCameraPoseChange]);
  const keepTargetInsideCourt = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const clamped = clampCameraTarget(controls.target.toArray(), policy);
    clampDeltaRef.current.set(...clamped).sub(controls.target);
    if (clampDeltaRef.current.lengthSq() <= 0.000001) return;
    controls.target.add(clampDeltaRef.current);
    camera.position.add(clampDeltaRef.current);
  }, [policy]);

  useEffect(() => {
    initializedRef.current = false;
  }, [cameraId, compactOverhead, portrait, selectedPosition]);

  useFrame((_, delta) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const frame = frameRef.current;
    if (!camera || !controls || !frame) return;

    const homePlayers = frame.players.filter((player) => player.team === 'us');
    const focusCandidates = focusRoles.size > 0
      ? homePlayers.filter((player) => focusRoles.has(player.role))
      : homePlayers.filter((player) => player.role !== 'G');
    const ballX = frame.ball.worldPosition[0];
    const ballZ = frame.ball.worldPosition[2];
    const selectedRolePlayer = homePlayers.find((player) => player.role === selectedPosition);
    const focus = cameraId === 'player'
      ? selectedRolePlayer ?? homePlayers.find((player) => player.role !== 'G') ?? homePlayers[0]
      : focusCandidates.find((player) => player.id === frame.ball.ownerId)
        ?? (focusRoles.size > 0
          ? focusCandidates.find((player) => player.role === selectedPosition)
          : null)
        ?? focusCandidates.reduce((nearest, player) => {
          if (!nearest) return player;
          const playerDistance = Math.hypot(
            player.worldPosition[0] - ballX,
            player.worldPosition[2] - ballZ,
          );
          const nearestDistance = Math.hypot(
            nearest.worldPosition[0] - ballX,
            nearest.worldPosition[2] - ballZ,
          );
          return playerDistance < nearestDistance ? player : nearest;
        }, null)
        ?? homePlayers[0];
    const pose = productionCameraPose(cameraId, {
      ball: frame.ball,
      compact: compactOverhead,
      portrait,
      focusPlayer: focus,
      focusPlayerPosition: focus?.worldPosition,
      players: frame.players,
      playbackTime: frame.time,
      replay,
      ballPosition: {
        x: frame.ball.worldPosition[0],
        y: frame.ball.worldPosition[1],
        z: frame.ball.worldPosition[2],
      },
    });
    desiredPosition.set(...pose.position);
    desiredTarget.set(...pose.target);

    if (cameraCommand?.revision !== commandRevisionRef.current) {
      commandRevisionRef.current = cameraCommand?.revision ?? -1;
      if (cameraCommand?.type === 'reframe') {
        initializedRef.current = false;
      } else if (cameraCommand?.type) {
        const next = stepOperatorCamera(
          camera.position.toArray(),
          controls.target.toArray(),
          cameraCommand.type,
          policy,
        );
        camera.position.set(...next.position);
        controls.target.set(...next.target);
        controls.update();
        publishCameraPose();
      }
    }

    if (!initializedRef.current) {
      initializedRef.current = true;
      camera.position.copy(desiredPosition);
      controls.target.copy(desiredTarget);
      if (focus) lastFocusPositionRef.current.set(...focus.worldPosition);
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
      controls.update();
      publishCameraPose();
      return;
    }

    if (following) {
      const safeDelta = Math.min(delta, 0.05);
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
      const positionBlend = 1 - Math.exp(-positionRate * safeDelta);
      const aimBlend = 1 - Math.exp(-aimRate * safeDelta);
      camera.position.lerp(desiredPosition, positionBlend);
      controls.target.lerp(desiredTarget, aimBlend);
      camera.fov += (pose.fov - camera.fov) * aimBlend;
      camera.updateProjectionMatrix();
    } else if (cameraId === 'player' && focus) {
      focusDeltaRef.current
        .set(...focus.worldPosition)
        .sub(lastFocusPositionRef.current);
      camera.position.add(focusDeltaRef.current);
      controls.target.add(focusDeltaRef.current);
    }
    if (focus) lastFocusPositionRef.current.set(...focus.worldPosition);
    controls.update();
  });

  return (
    <>
      <PerspectiveCamera ref={cameraRef} makeDefault near={0.1} far={180} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.075}
        enablePan
        enableRotate
        enableZoom
        keyPanSpeed={18}
        maxDistance={policy.maxDistance}
        maxPolarAngle={policy.maxPolarAngle}
        minDistance={policy.minDistance}
        minPolarAngle={policy.minPolarAngle}
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

export default function TacticalReplayScene({
  athleteAssets,
  cameraCommand,
  cameraFollowing,
  cameraGestureMode,
  cameraId,
  isPlaying,
  onFrameStats,
  onManualCameraControl,
  onCameraPoseChange,
  onPlaybackEnd,
  onTimeChange,
  playbackTime,
  replay,
  roleFocusMode,
  selectedPosition,
  speed,
  tacticalLayers,
  theme = 'dark',
}) {
  const frameRef = useRef(sampleTacticalReplay(replay, playbackTime));
  const replayIdRef = useRef(replay.id);
  const timeRef = useRef(playbackTime);
  const wasPlayingRef = useRef(isPlaying);
  const endedRef = useRef(false);
  const publishElapsedRef = useRef(0);
  const frameIntervalsRef = useRef([]);
  const frameStatsPublishedRef = useRef(false);
  const athleteRefs = useRef(new Map());
  const focusRingRefs = useRef(new Map());
  const ballRef = useRef(null);
  const ballLocatorRef = useRef(null);
  const ballTrailRef = useRef(null);
  const ballTrailVectorsRef = useRef({
    direction: new Vector3(),
    end: new Vector3(),
    midpoint: new Vector3(),
    start: new Vector3(),
    up: new Vector3(0, 1, 0),
  });
  const focusRoles = useMemo(
    () => new Set(rolesForRoleLens(roleFocusMode)),
    [roleFocusMode],
  );
  const penaltyBoxTeams = useMemo(
    () => [...new Set(
      replay.players
        .filter(isPenaltyBoxPlayer)
        .map((player) => player.team),
    )],
    [replay],
  );

  useEffect(() => {
    const wasPlaying = wasPlayingRef.current;
    if (wasPlaying && !isPlaying) {
      onTimeChange(timeRef.current);
    } else if (!isPlaying || !wasPlaying) {
      timeRef.current = playbackTime;
    }
    if (isPlaying) endedRef.current = false;
    wasPlayingRef.current = isPlaying;
  }, [isPlaying, onTimeChange, playbackTime]);

  useEffect(() => {
    if (replayIdRef.current !== replay.id) {
      replayIdRef.current = replay.id;
      timeRef.current = playbackTime;
      frameRef.current = sampleTacticalReplay(replay, playbackTime);
    }
  }, [replay, playbackTime]);

  const applyFrame = (frame) => {
    for (const player of frame.players) {
      athleteRefs.current.get(player.id)?.applySample(player);
    }

    if (ballRef.current) ballRef.current.position.set(...frame.ball.worldPosition);
    if (ballLocatorRef.current) {
      ballLocatorRef.current.position.set(
        frame.ball.worldPosition[0],
        0.012,
        frame.ball.worldPosition[2],
      );
    }
    if (ballTrailRef.current) {
      const trail = sampleTacticalBallTrail(replay, frame.time);
      ballTrailRef.current.visible = Boolean(trail);
      if (trail) {
        const vectors = ballTrailVectorsRef.current;
        vectors.start.set(...trail.start);
        vectors.end.set(...trail.end);
        vectors.direction.subVectors(vectors.end, vectors.start);
        vectors.midpoint.addVectors(vectors.start, vectors.end).multiplyScalar(0.5);
        ballTrailRef.current.position.copy(vectors.midpoint);
        ballTrailRef.current.quaternion.setFromUnitVectors(
          vectors.up,
          vectors.direction.normalize(),
        );
        ballTrailRef.current.scale.set(1, trail.distance, 1);
      }
    }

    for (const player of frame.players) {
      if (player.team !== 'us') continue;
      const ring = focusRingRefs.current.get(player.id);
      if (!ring) continue;
      ring.visible = cameraId === 'player'
        ? player.role === selectedPosition
        : focusRoles.has(player.role);
      ring.position.set(
        player.worldPosition[0],
        0.014,
        player.worldPosition[2],
      );
    }
  };

  useFrame((_, delta) => {
    const safeDelta = Math.min(delta, 0.1);
    if (isPlaying) {
      timeRef.current = Math.min(replay.duration, timeRef.current + safeDelta * speed);
    }

    const frame = sampleTacticalReplay(replay, timeRef.current);
    frameRef.current = frame;
    applyFrame(frame);
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      window.__GOONSQUAD_TACTICAL_FRAME__ = {
        engineId: frame.engineId,
        time: frame.time,
        ballState: frame.ball.state,
        ballPosition: [...frame.ball.worldPosition],
        playerCount: frame.players.length,
      };
    }

    frameIntervalsRef.current.push(delta * 1000);
    if (frameIntervalsRef.current.length > 180) frameIntervalsRef.current.shift();
    if (!frameStatsPublishedRef.current && frameIntervalsRef.current.length >= 120) {
      frameStatsPublishedRef.current = true;
      onFrameStats?.({
        ...summarizeFrameIntervals(frameIntervalsRef.current),
        observedSampleCount: frameIntervalsRef.current.length,
      });
    }

    if (isPlaying) {
      publishElapsedRef.current += safeDelta;
      if (publishElapsedRef.current >= TIME_PUBLISH_INTERVAL_SECONDS) {
        publishElapsedRef.current = 0;
        onTimeChange(timeRef.current);
      }
      if (timeRef.current >= replay.duration && !endedRef.current) {
        endedRef.current = true;
        onTimeChange(replay.duration);
        onPlaybackEnd();
      }
    }
  }, -2);

  const locatorRadii = cameraId === 'overhead' ? [0.25, 0.37] : [0.13, 0.2];
  const sceneBackground = theme === 'light' ? '#dfe5e8' : '#080d14';
  const sceneGroundColor = theme === 'light' ? '#aeb9c1' : '#152130';

  return (
    <>
      <color attach="background" args={[sceneBackground]} />
      <fog attach="fog" args={[sceneBackground, 64, 120]} />
      <hemisphereLight intensity={2.35} color="#f4fbff" groundColor={sceneGroundColor} />
      <directionalLight intensity={3.2} color="#fff8ed" position={[14, 30, -20]} />
      <directionalLight intensity={1.35} color="#9cd7ff" position={[-18, 18, 24]} />

      <ProductionCourt penaltyBoxTeams={penaltyBoxTeams} theme={theme} />

      <TacticalReplayLayers
        focusRoles={focusRoles}
        frameRef={frameRef}
        layers={tacticalLayers}
        playbackTime={playbackTime}
        replay={replay}
      />

      {replay.players.map((player) => (
        <RegisteredAthlete
          key={player.id}
          playerId={player.id}
          registry={athleteRefs}
          assetUrl={athleteAssets[player.role === 'G'
            ? `goalie-${player.team === 'us' ? 'home' : 'away'}`
            : `field-${player.team === 'us' ? 'home' : 'away'}`]}
        />
      ))}

      {replay.players
        .filter((player) => player.team === 'us')
        .map((player) => (
          <mesh
            key={`focus-ring-${player.id}`}
            ref={(node) => {
              if (node) focusRingRefs.current.set(player.id, node);
              else focusRingRefs.current.delete(player.id);
            }}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={2}
            visible={false}
          >
            <ringGeometry args={[0.62, 0.76, 48]} />
            <meshBasicMaterial color="#3de7ff" transparent opacity={0.86} depthWrite={false} />
          </mesh>
        ))}

      <mesh ref={ballRef}>
        <sphereGeometry args={[TACTICAL_BALL_RADIUS_METERS, 20, 14]} />
        <meshStandardMaterial
          color="#ff7b1c"
          emissive="#f04400"
          emissiveIntensity={0.68}
          roughness={0.3}
        />
      </mesh>
      <mesh ref={ballTrailRef} visible={false} renderOrder={2}>
        <cylinderGeometry args={[0.024, 0.004, 1, 10, 1, true]} />
        <meshBasicMaterial
          color="#ff9a3d"
          transparent
          opacity={0.48}
          depthWrite={false}
        />
      </mesh>
      <mesh
        ref={ballLocatorRef}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={2}
      >
        <ringGeometry args={[...locatorRadii, 32]} />
        <meshBasicMaterial color="#ff8a24" transparent opacity={0.62} depthWrite={false} />
      </mesh>

      <RuntimeCamera
        cameraCommand={cameraCommand}
        cameraId={cameraId}
        following={cameraFollowing}
        frameRef={frameRef}
        focusRoles={focusRoles}
        gestureMode={cameraGestureMode}
        onCameraPoseChange={onCameraPoseChange}
        onManualControl={onManualCameraControl}
        replay={replay}
        selectedPosition={selectedPosition}
      />
    </>
  );
}
