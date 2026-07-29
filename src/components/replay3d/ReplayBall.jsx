import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { RINK_WORLD, rinkToWorld } from '../../replay3d/coords';
import { REPLAY_COLORS } from './replayStyles';

function ballHeight(ball) {
  const progress = ball.progress ?? 0;
  if (ball.segmentType === 'pass') return 0.17 + Math.sin(progress * Math.PI) * 0.34;
  if (ball.segmentType === 'board-pass') {
    const impactProgress = ball.impactProgress ?? 0.5;
    const impactPulse = Math.max(0, 1 - Math.abs(progress - impactProgress) * 10);
    const boardKick = ball.boardPhase === 'impact' ? 0.09 : 0;
    return 0.14 + impactPulse * 0.2 + boardKick + Math.abs(Math.sin(progress * Math.PI * 3)) * 0.035;
  }
  return 0.12 + Math.abs(Math.sin(progress * Math.PI * 7)) * 0.025;
}

function worldVelocity(velocity = { x: 0, y: 0 }) {
  const x = velocity.x * (RINK_WORLD.width / 100);
  const z = velocity.y * (RINK_WORLD.length / 100);
  const speed = Math.hypot(x, z);
  if (speed < 0.001) return { x: 0, z: 0, speed: 0 };
  return { x: x / speed, z: z / speed, speed };
}

function BallTrail({ ball, world }) {
  const direction = worldVelocity(ball.velocity);
  if (direction.speed < 0.15) return null;

  const trailOpacity = ball.segmentType === 'carry' ? 0.1 : 0.2;
  const spacing = ball.segmentType === 'pass' ? 0.32 : 0.22;
  return (
    <group>
      {[1, 2, 3, 4].map((step) => (
        <mesh
          key={step}
          position={[
            world.x - direction.x * spacing * step,
            Math.max(0.08, world.y - 0.03 * step),
            world.z - direction.z * spacing * step,
          ]}
        >
          <sphereGeometry args={[0.095 - step * 0.012, 18, 12]} />
          <meshBasicMaterial color={REPLAY_COLORS.ball} transparent opacity={trailOpacity / step} />
        </mesh>
      ))}
    </group>
  );
}

function BoardImpactCue({ ball }) {
  if (ball.segmentType !== 'board-pass' || !ball.impactPosition) return null;
  const progress = ball.progress ?? 0;
  const impactProgress = ball.impactProgress ?? 0.5;
  const intensity = Math.max(0, 1 - Math.abs(progress - impactProgress) * 8);
  if (intensity <= 0.02) return null;

  const p = rinkToWorld({ ...ball.impactPosition, height: 0.035 });
  return (
    <group position={[p.x, p.y, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <ringGeometry args={[0.2, 0.5 + intensity * 0.24, 40]} />
        <meshBasicMaterial color="#fde68a" transparent opacity={0.22 * intensity} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.11 + intensity * 0.05, 24]} />
        <meshBasicMaterial color="#f97316" transparent opacity={0.28 * intensity} />
      </mesh>
    </group>
  );
}

function StickContactCue({ ball, world }) {
  if (!ball.stickContact) return null;
  const progress = ball.progress ?? 0;
  const releasePulse = ball.stickContact === 'release'
    ? Math.max(0, 1 - progress * 5.6)
    : 0;
  const receivePulse = ball.stickContact === 'receive'
    ? Math.max(0, 1 - (1 - progress) * 5.6)
    : 0;
  const carryPulse = ball.stickContact === 'carry'
    ? 0.36 + Math.abs(Math.sin(progress * Math.PI * 6)) * 0.18
    : 0;
  const intensity = Math.max(releasePulse, receivePulse, carryPulse);
  if (intensity <= 0.03) return null;

  return (
    <group position={[world.x, 0.052, world.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh>
        <ringGeometry args={[0.14, 0.26 + intensity * 0.08, 28]} />
        <meshBasicMaterial color="#f97316" transparent opacity={0.18 * intensity} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export default function ReplayBall({ ball }) {
  const ref = useRef(null);
  const shadowRef = useRef(null);
  const world = rinkToWorld({ ...ball.position, height: ballHeight(ball) });

  useFrame((state) => {
    if (!ref.current || !shadowRef.current) return;
    ref.current.position.lerp(new THREE.Vector3(world.x, world.y, world.z), 0.42);
    const speed = Math.max(0.6, worldVelocity(ball.velocity).speed);
    ref.current.rotation.x += 0.16 + speed * 0.08;
    ref.current.rotation.z += 0.11 + speed * 0.05;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 18) * 0.06;
    const shadowScale = pulse * (ball.segmentType === 'pass' ? 0.8 : 1);
    shadowRef.current.scale.setScalar(shadowScale);
    shadowRef.current.position.set(ref.current.position.x, 0.018, ref.current.position.z);
  });

  return (
    <group>
      <BoardImpactCue ball={ball} />
      <BallTrail ball={ball} world={world} />
      <StickContactCue ball={ball} world={world} />
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} position={[world.x, 0.018, world.z]}>
        <circleGeometry args={[0.18, 28]} />
        <meshBasicMaterial color={REPLAY_COLORS.shadow} transparent opacity={ball.segmentType === 'pass' ? 0.13 : 0.22} />
      </mesh>
      <mesh ref={ref} position={[world.x, world.y, world.z]} castShadow>
        <sphereGeometry args={[0.095, 36, 24]} />
        <meshStandardMaterial color={REPLAY_COLORS.ball} roughness={0.3} metalness={0.02} emissive="#7c2d12" emissiveIntensity={0.08} />
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.097, 0.005, 8, 36]} />
          <meshBasicMaterial color="#7c2d12" transparent opacity={0.32} />
        </mesh>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.098, 0.004, 8, 36]} />
          <meshBasicMaterial color="#7c2d12" transparent opacity={0.22} />
        </mesh>
      </mesh>
    </group>
  );
}
