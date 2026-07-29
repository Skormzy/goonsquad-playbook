import { useMemo, useRef } from 'react';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import {
  matchupGapColor,
  nextTacticalTarget,
  ROLE_LAYER_COLORS,
  tacticalMatchupsForReplay,
  tacticalRoutePoints,
  upcomingBallLayer,
} from './tacticalLayers';
import { isPenaltyBoxPlayer } from '../play-engine/penaltyBox';

const COVERAGE_DASH_COUNT = 7;
const FIELD_ROLES = new Set(['LW', 'C', 'RW', 'LD', 'RD']);

function layerOpacity(focusRoles, role, primary = 0.82, secondary = 0.28) {
  return focusRoles.size === 0 || focusRoles.has(role) ? primary : secondary;
}

function CoverageLink({ enabled, focusRoles, frameRef, matchup }) {
  const groupRef = useRef(null);
  const dashRefs = useRef([]);
  const hashRefs = useRef([]);
  const materialRefs = useRef([]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    group.visible = enabled;
    if (!enabled) return;

    const frame = frameRef.current;
    const home = frame?.players.find((player) => player.id === matchup.homePlayerId);
    const opponent = frame?.players.find((player) => player.id === matchup.opponentPlayerId);
    if (!home || !opponent || isPenaltyBoxPlayer(home) || isPenaltyBoxPlayer(opponent)) {
      group.visible = false;
      return;
    }

    const dx = opponent.worldPosition[0] - home.worldPosition[0];
    const dz = opponent.worldPosition[2] - home.worldPosition[2];
    const distance = Math.hypot(dx, dz);
    group.position.set(home.worldPosition[0], 0.04, home.worldPosition[2]);
    group.rotation.set(0, Math.atan2(dx, dz), 0);

    const dashLength = Math.min(0.34, Math.max(0.12, distance / 12));
    dashRefs.current.forEach((dash, index) => {
      if (!dash) return;
      dash.position.z = distance * ((index + 0.5) / COVERAGE_DASH_COUNT);
      dash.scale.z = dashLength / 0.28;
    });
    hashRefs.current.forEach((hash, index) => {
      if (!hash) return;
      hash.position.z = distance * (index === 0 ? 0.16 : 0.84);
      hash.scale.x = Math.min(1.25, Math.max(0.68, distance / 8));
    });

    const color = matchupGapColor(distance);
    const opacity = layerOpacity(focusRoles, home.role);
    materialRefs.current.forEach((material) => {
      if (!material) return;
      material.color.set(color);
      material.opacity = opacity;
    });
  });

  return (
    <group ref={groupRef} visible={enabled} renderOrder={3}>
      {Array.from({ length: COVERAGE_DASH_COUNT }, (_, index) => (
        <mesh
          key={`dash-${index}`}
          ref={(node) => { dashRefs.current[index] = node; }}
        >
          <boxGeometry args={[0.075, 0.018, 0.28]} />
          <meshBasicMaterial
            ref={(node) => { materialRefs.current[index] = node; }}
            color="#42df91"
            transparent
            opacity={0.82}
            depthWrite={false}
          />
        </mesh>
      ))}
      {[0, 1].map((index) => (
        <mesh
          key={`hash-${index}`}
          ref={(node) => { hashRefs.current[index] = node; }}
        >
          <boxGeometry args={[0.5, 0.022, 0.06]} />
          <meshBasicMaterial
            ref={(node) => { materialRefs.current[COVERAGE_DASH_COUNT + index] = node; }}
            color="#42df91"
            transparent
            opacity={0.82}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function RouteLayers({ enabled, focusRoles, replay }) {
  const routes = useMemo(() => replay.players
    .filter((player) => (
      player.team === 'us'
      && FIELD_ROLES.has(player.role)
      && !isPenaltyBoxPlayer(player)
    ))
    .map((player) => ({
      id: player.id,
      role: player.role,
      points: tacticalRoutePoints(player),
    }))
    .filter((route) => route.points.length > 1), [replay]);

  return routes.map((route) => (
    <Line
      key={`route-${route.id}`}
      points={route.points}
      color={ROLE_LAYER_COLORS[route.role]}
      dashed
      dashSize={0.24}
      gapSize={0.16}
      lineWidth={1.45}
      transparent
      opacity={layerOpacity(focusRoles, route.role, 0.7, 0.2)}
      depthWrite={false}
      renderOrder={3}
      visible={enabled}
    />
  ));
}

function TargetMarker({ enabled, focusRoles, frameRef, player }) {
  const markerRef = useRef(null);
  const materialRefs = useRef([]);

  useFrame(() => {
    const marker = markerRef.current;
    if (!marker) return;
    marker.visible = enabled;
    if (!enabled) return;

    const target = nextTacticalTarget(player, frameRef.current?.time ?? 0);
    marker.position.set(...target.worldPosition);
    const opacity = layerOpacity(focusRoles, player.role, 0.78, 0.22);
    materialRefs.current.forEach((material) => {
      if (material) material.opacity = opacity;
    });
  });

  const color = ROLE_LAYER_COLORS[player.role];
  return (
    <group ref={markerRef} visible={enabled} renderOrder={3}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.43, 32]} />
        <meshBasicMaterial
          ref={(node) => { materialRefs.current[0] = node; }}
          color={color}
          transparent
          opacity={0.78}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <boxGeometry args={[0.86, 0.018, 0.055]} />
        <meshBasicMaterial
          ref={(node) => { materialRefs.current[1] = node; }}
          color={color}
          transparent
          opacity={0.78}
          depthWrite={false}
        />
      </mesh>
      <mesh>
        <boxGeometry args={[0.055, 0.018, 0.86]} />
        <meshBasicMaterial
          ref={(node) => { materialRefs.current[2] = node; }}
          color={color}
          transparent
          opacity={0.78}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function TargetLayers({ enabled, focusRoles, frameRef, replay }) {
  return replay.players
    .filter((player) => (
      player.team === 'us'
      && FIELD_ROLES.has(player.role)
      && !isPenaltyBoxPlayer(player)
    ))
    .map((player) => (
      <TargetMarker
        key={`target-${player.id}`}
        enabled={enabled}
        focusRoles={focusRoles}
        frameRef={frameRef}
        player={player}
      />
    ));
}

function PassingLayer({ enabled, playbackTime, replay }) {
  const layer = useMemo(
    () => upcomingBallLayer(replay, playbackTime),
    [playbackTime, replay],
  );
  if (!enabled || !layer) return null;

  const color = layer.type === 'shot' ? '#ff6468' : '#ffbd59';
  return (
    <group renderOrder={4}>
      <Line
        points={layer.points}
        color={color}
        dashed={layer.type !== 'shot'}
        dashSize={0.34}
        gapSize={0.14}
        lineWidth={2.25}
        transparent
        opacity={0.92}
        depthWrite={false}
        renderOrder={4}
      />
      <group position={layer.target}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.53, 36]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.94, 0.022, 0.07]} />
          <meshBasicMaterial color={color} transparent opacity={0.72} depthWrite={false} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.07, 0.022, 0.94]} />
          <meshBasicMaterial color={color} transparent opacity={0.72} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
}

export default function TacticalReplayLayers({
  focusRoles,
  frameRef,
  layers,
  playbackTime,
  replay,
}) {
  const matchups = useMemo(() => tacticalMatchupsForReplay(replay), [replay]);

  return (
    <>
      {matchups.map((matchup) => (
        <CoverageLink
          key={`${matchup.homePlayerId}-${matchup.opponentPlayerId}`}
          enabled={layers.matchups}
          focusRoles={focusRoles}
          frameRef={frameRef}
          matchup={matchup}
        />
      ))}
      <RouteLayers enabled={layers.routes} focusRoles={focusRoles} replay={replay} />
      <PassingLayer enabled={layers.passing} playbackTime={playbackTime} replay={replay} />
      <TargetLayers
        enabled={layers.targets}
        focusRoles={focusRoles}
        frameRef={frameRef}
        replay={replay}
      />
    </>
  );
}
