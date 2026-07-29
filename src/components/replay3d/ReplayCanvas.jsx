import { Canvas } from '@react-three/fiber';
import { Environment, Line, OrbitControls } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import * as THREE from 'three';
import { rinkToWorld } from '../../replay3d/coords';
import { sampleReplayAt } from '../../replay3d/timeline';
import ReplayBall from './ReplayBall';
import ReplayCamera from './ReplayCamera';
import ReplayCourt from './ReplayCourt';
import ReplayPlayer from './ReplayPlayer';
import { CAMERA_PRESETS, TEAM_COLORS } from './replayStyles';

export const REPLAY_CANVAS_RENDER_PROFILE = {
  shadowsEnabled: false,
  contactShadowsEnabled: false,
  shadowCastingLights: false,
};

function ReplayTrails({ replay }) {
  return replay.players
    .filter((player) => player.team === 'us')
    .map((player) => {
      const points = player.keyframes.map(({ position }) => {
        const world = rinkToWorld({ ...position, height: 0.06 });
        return [world.x, world.y, world.z];
      });
      return <Line key={player.id} points={points} color={TEAM_COLORS.us} transparent opacity={0.22} lineWidth={0.03} />;
    });
}

function BoardPassLine({ replay }) {
  const segment = replay.ball.segments.find((item) => item.type === 'board-pass');
  if (!segment) return null;
  const points = [segment.incoming, segment.impact, segment.exitTarget].map((position) => {
    const world = rinkToWorld({ ...position, height: 0.16 });
    return [world.x, world.y, world.z];
  });
  return <Line points={points} color="#f97316" dashed dashSize={0.28} gapSize={0.18} lineWidth={0.045} />;
}

function BroadcastLightPanels() {
  return (
    <group>
      {[-8, 0, 8].map((z) => (
        <group key={z} position={[0, 8.2, z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[5.8, 0.42]} />
          <meshBasicMaterial color="#e0f2fe" transparent opacity={0.11} />
        </mesh>
          <pointLight position={[0, -0.2, 0]} intensity={0.68} distance={18} color="#e0f2fe" />
        </group>
      ))}
    </group>
  );
}

function ReplayScene({ replay, time, cameraId, showTeachingOverlays }) {
  const frame = useMemo(() => sampleReplayAt(replay, time), [replay, time]);
  const preset = CAMERA_PRESETS[cameraId] ?? CAMERA_PRESETS.broadcast;
  const cameraFocus = useMemo(() => (
    rinkToWorld({ ...frame.ball.position, height: 0.72 })
  ), [frame.ball.position]);

  return (
    <>
      <color attach="background" args={['#070b14']} />
      <fog attach="fog" args={['#070b14', 54, 124]} />
      <hemisphereLight args={['#f8fbff', '#111827', 0.78]} />
      <directionalLight
        position={[-7, 14, -11]}
        intensity={2.62}
        castShadow={REPLAY_CANVAS_RENDER_PROFILE.shadowCastingLights}
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.00008}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={48}
        shadow-camera-bottom={-48}
      />
      <directionalLight position={[9, 11, 10]} intensity={0.58} color="#f8fafc" />
      <spotLight
        position={[0, 13.5, -11]}
        angle={0.46}
        penumbra={0.42}
        intensity={7.2}
        distance={44}
        castShadow={REPLAY_CANVAS_RENDER_PROFILE.shadowCastingLights}
      />
      <spotLight position={[-8, 10.5, 6]} angle={0.5} penumbra={0.5} intensity={1.72} distance={36} color="#e0f2fe" />
      <spotLight position={[8, 10.5, 6]} angle={0.5} penumbra={0.5} intensity={1.62} distance={36} color="#fee2e2" />
      <ReplayCamera preset={preset} focus={cameraFocus} />
      <ReplayCourt />
      <BroadcastLightPanels />
      {showTeachingOverlays && <ReplayTrails replay={replay} />}
      {showTeachingOverlays && <BoardPassLine replay={replay} />}
      {frame.players.map((player) => (
        <ReplayPlayer key={player.id} player={player} showLabel={showTeachingOverlays} cameraId={cameraId} />
      ))}
      <ReplayBall ball={frame.ball} />
      <Environment preset="city" />
      <OrbitControls enablePan={false} enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI * 0.48} minDistance={16} maxDistance={78} />
    </>
  );
}

export default function ReplayCanvas({ replay, time, cameraId, showTeachingOverlays }) {
  return (
    <Canvas
      shadows={REPLAY_CANVAS_RENDER_PROFILE.shadowsEnabled}
      dpr={[1, 2]}
      camera={{ position: CAMERA_PRESETS.broadcast.position, fov: CAMERA_PRESETS.broadcast.fov, near: 0.1, far: 145 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.06;
      }}
    >
      <Suspense fallback={null}>
        <ReplayScene
          replay={replay}
          time={time}
          cameraId={cameraId}
          showTeachingOverlays={showTeachingOverlays}
        />
      </Suspense>
    </Canvas>
  );
}
