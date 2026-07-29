import { Line, Text } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import { RINK_WORLD, rinkToWorld } from '../../replay3d/coords';
import { REPLAY_COLORS } from './replayStyles';

const CORNER_RADIUS = RINK_WORLD.cornerRadius;
const BOARD_HEIGHT = 1.12;
const BOARD_THICKNESS = 0.42;
const FACEOFF_CIRCLE_RADIUS = 4.5;
const CREASE_RADIUS = 1.85;
export const COURT_TEXTURE_PROFILE = {
  material: 'matte-polypropylene-sport-court',
  tileRepeat: { x: 4, y: 9 },
  scuffLayers: 3,
  ballWearMarks: 72,
};
export const ARENA_CROWD_PROFILE = {
  material: 'procedural-broadcast-crowd-backdrop',
  sideSpectators: 216,
  endSpectators: 120,
  rowBands: 6,
};

function roundedRectShape(width, length, radius) {
  const x = -width / 2;
  const y = -length / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + length - radius);
  shape.quadraticCurveTo(x + width, y + length, x + width - radius, y + length);
  shape.lineTo(x + radius, y + length);
  shape.quadraticCurveTo(x, y + length, x, y + length - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function roundedRectPathPoints(width, length, radius, height, expand = 0, segments = 18) {
  const halfWidth = width / 2 + expand;
  const halfLength = length / 2 + expand;
  const r = radius + expand;
  const points = [];

  const addPoint = (x, z) => points.push([x, height, z]);
  addPoint(-halfWidth + r, -halfLength);
  addPoint(halfWidth - r, -halfLength);

  [
    { cx: halfWidth - r, cz: -halfLength + r, start: -Math.PI / 2, end: 0 },
    { cx: halfWidth - r, cz: halfLength - r, start: 0, end: Math.PI / 2 },
    { cx: -halfWidth + r, cz: halfLength - r, start: Math.PI / 2, end: Math.PI },
    { cx: -halfWidth + r, cz: -halfLength + r, start: Math.PI, end: Math.PI * 1.5 },
  ].forEach((corner, index) => {
    for (let i = 1; i <= segments; i += 1) {
      const t = i / segments;
      const angle = corner.start + (corner.end - corner.start) * t;
      addPoint(corner.cx + Math.cos(angle) * r, corner.cz + Math.sin(angle) * r);
    }
    if (index === 0) addPoint(halfWidth, halfLength - r);
    if (index === 1) addPoint(-halfWidth + r, halfLength);
    if (index === 2) addPoint(-halfWidth, -halfLength + r);
  });

  points.push(points[0]);
  return points;
}

function curvedWallGeometry({ radius, height, thickness = BOARD_THICKNESS, startAngle, endAngle, segments = 20 }) {
  const positions = [];
  const normals = [];
  const indices = [];

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const angle = startAngle + (endAngle - startAngle) * t;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    for (const r of [radius, radius + thickness]) {
      positions.push(r * cos, 0, r * sin);
      positions.push(r * cos, height, r * sin);
      normals.push(cos, 0, sin, cos, 0, sin);
    }
  }

  for (let i = 0; i < segments; i += 1) {
    const a = i * 4;
    const b = a + 4;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
    indices.push(a + 2, a + 3, b + 2, b + 2, a + 3, b + 3);
    indices.push(a + 1, b + 1, a + 3, b + 1, b + 3, a + 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function createCourtTextures() {
  if (typeof document === 'undefined') return { map: null, bumpMap: null };

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext('2d');
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = canvas.width;
  bumpCanvas.height = canvas.height;
  const bumpContext = bumpCanvas.getContext('2d');

  context.fillStyle = REPLAY_COLORS.floor;
  context.fillRect(0, 0, canvas.width, canvas.height);
  bumpContext.fillStyle = '#808080';
  bumpContext.fillRect(0, 0, bumpCanvas.width, bumpCanvas.height);

  const tile = 128;
  for (let y = 0; y < canvas.height; y += tile) {
    for (let x = 0; x < canvas.width; x += tile) {
      context.fillStyle = ((x / tile + y / tile) % 2 === 0) ? 'rgba(255,255,255,0.055)' : 'rgba(15,23,42,0.04)';
      context.fillRect(x, y, tile, tile);
      context.strokeStyle = 'rgba(39,56,49,0.24)';
      context.lineWidth = 2;
      context.strokeRect(x + 1, y + 1, tile - 2, tile - 2);
      bumpContext.strokeStyle = 'rgba(210,210,210,0.34)';
      bumpContext.lineWidth = 3;
      bumpContext.strokeRect(x + 1, y + 1, tile - 2, tile - 2);
      context.strokeStyle = 'rgba(255,255,255,0.16)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x + tile * 0.5, y + 8);
      context.lineTo(x + tile * 0.5, y + tile - 8);
      context.moveTo(x + 8, y + tile * 0.5);
      context.lineTo(x + tile - 8, y + tile * 0.5);
      context.stroke();

      context.fillStyle = 'rgba(28,44,37,0.08)';
      context.fillRect(x + tile * 0.5 - 2, y + 12, 4, 18);
      context.fillRect(x + tile * 0.5 - 2, y + tile - 30, 4, 18);
      context.fillRect(x + 12, y + tile * 0.5 - 2, 18, 4);
      context.fillRect(x + tile - 30, y + tile * 0.5 - 2, 18, 4);
    }
  }

  for (let layer = 0; layer < COURT_TEXTURE_PROFILE.scuffLayers; layer += 1) {
    const alpha = [0.16, 0.1, 0.07][layer] ?? 0.06;
    context.strokeStyle = `rgba(30,41,59,${alpha})`;
    context.lineWidth = layer === 0 ? 3 : 2;
    context.lineCap = 'round';
    for (let i = 0; i < 48; i += 1) {
      const x = (i * 83 + layer * 137) % canvas.width;
      const y = (i * 151 + layer * 61) % canvas.height;
      const length = 18 + ((i * 19) % 48);
      const angle = ((i * 29 + layer * 17) % 180) * Math.PI / 180;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      context.stroke();

      bumpContext.strokeStyle = 'rgba(92,92,92,0.26)';
      bumpContext.lineWidth = 2;
      bumpContext.beginPath();
      bumpContext.moveTo(x, y);
      bumpContext.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      bumpContext.stroke();
    }
  }

  for (let i = 0; i < COURT_TEXTURE_PROFILE.ballWearMarks; i += 1) {
    const x = (i * 47 + 23) % canvas.width;
    const y = (i * 109 + 71) % canvas.height;
    const radius = 1.5 + (i % 4) * 0.55;
    context.beginPath();
    context.fillStyle = `rgba(15,23,42,${0.03 + (i % 3) * 0.018})`;
    context.ellipse(x, y, radius * 1.8, radius, (i * 31) * Math.PI / 180, 0, Math.PI * 2);
    context.fill();
  }

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < imageData.data.length; i += 4 * 97) {
    imageData.data[i] = Math.max(0, imageData.data[i] - 12);
    imageData.data[i + 1] = Math.max(0, imageData.data[i + 1] - 11);
    imageData.data[i + 2] = Math.max(0, imageData.data[i + 2] - 11);
  }
  context.putImageData(imageData, 0, 0);

  const map = new THREE.CanvasTexture(canvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(COURT_TEXTURE_PROFILE.tileRepeat.x, COURT_TEXTURE_PROFILE.tileRepeat.y);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 4;
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.copy(map.repeat);
  bumpMap.anisotropy = 2;
  return { map, bumpMap };
}

function CourtLine({ y, color, width = 0.045, opacity = 0.78 }) {
  const a = rinkToWorld({ x: 0, y, height: 0.018 });
  const b = rinkToWorld({ x: 100, y, height: 0.018 });
  return <Line points={[[a.x, a.y, a.z], [b.x, b.y, b.z]]} color={color} transparent opacity={opacity} lineWidth={width} />;
}

function CourtStripe({ y, color, thickness = 0.12, opacity = 0.48 }) {
  const p = rinkToWorld({ x: 50, y, height: 0.021 });
  return (
    <mesh position={[p.x, p.y, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[RINK_WORLD.width - 2.2, thickness]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

function GroundLine({ points, color, width = 0.04, opacity = 0.72 }) {
  return <Line points={points.map(([x, z]) => [x, 0.026, z])} color={color} transparent opacity={opacity} lineWidth={width} />;
}

function SportTileLines() {
  const lines = useMemo(() => {
    const items = [];
    for (let x = 10; x < 100; x += 10) {
      const a = rinkToWorld({ x, y: 4, height: 0.019 });
      const b = rinkToWorld({ x, y: 96, height: 0.019 });
      items.push({ key: `v-${x}`, points: [[a.x, a.y, a.z], [b.x, b.y, b.z]] });
    }
    for (let y = 10; y < 100; y += 10) {
      const a = rinkToWorld({ x: 4, y, height: 0.019 });
      const b = rinkToWorld({ x: 96, y, height: 0.019 });
      items.push({ key: `h-${y}`, points: [[a.x, a.y, a.z], [b.x, b.y, b.z]] });
    }
    return items;
  }, []);

  return (
    <>
      {lines.map((line) => (
        <Line key={line.key} points={line.points} color="#334155" transparent opacity={0.07} lineWidth={0.012} />
      ))}
    </>
  );
}

function FaceoffRing({ x, y, opacity = 0.7 }) {
  const p = rinkToWorld({ x, y, height: 0.022 });
  const hashLength = 0.82;
  const hashOffset = FACEOFF_CIRCLE_RADIUS;
  return (
    <>
      <group position={[p.x, p.y, p.z]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh>
          <torusGeometry args={[FACEOFF_CIRCLE_RADIUS, 0.035, 10, 96]} />
          <meshStandardMaterial color={REPLAY_COLORS.lineRed} transparent opacity={opacity} roughness={0.72} />
        </mesh>
        <mesh>
          <circleGeometry args={[0.22, 32]} />
          <meshStandardMaterial color={REPLAY_COLORS.lineRed} transparent opacity={opacity} roughness={0.8} />
        </mesh>
      </group>
      <GroundLine
        points={[[p.x - hashOffset, p.z - hashLength / 2], [p.x - hashOffset, p.z + hashLength / 2]]}
        color={REPLAY_COLORS.lineRed}
        width={0.035}
        opacity={opacity}
      />
      <GroundLine
        points={[[p.x + hashOffset, p.z - hashLength / 2], [p.x + hashOffset, p.z + hashLength / 2]]}
        color={REPLAY_COLORS.lineRed}
        width={0.035}
        opacity={opacity}
      />
      <GroundLine
        points={[[p.x - hashLength / 2, p.z - hashOffset], [p.x + hashLength / 2, p.z - hashOffset]]}
        color={REPLAY_COLORS.lineRed}
        width={0.035}
        opacity={opacity}
      />
      <GroundLine
        points={[[p.x - hashLength / 2, p.z + hashOffset], [p.x + hashLength / 2, p.z + hashOffset]]}
        color={REPLAY_COLORS.lineRed}
        width={0.035}
        opacity={opacity}
      />
    </>
  );
}

function CenterFaceoffMarkings() {
  return (
    <>
      <mesh position={[0, 0.023, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[FACEOFF_CIRCLE_RADIUS, 0.035, 12, 96]} />
        <meshStandardMaterial color={REPLAY_COLORS.lineRed} transparent opacity={0.52} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.026, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.24, 32]} />
        <meshStandardMaterial color={REPLAY_COLORS.lineRed} transparent opacity={0.62} roughness={0.8} />
      </mesh>
    </>
  );
}

function GoalCrease({ y, direction = 1 }) {
  const center = rinkToWorld({ x: 50, y, height: 0.02 });
  const arcPoints = Array.from({ length: 49 }, (_, index) => {
    const angle = (index / 48) * Math.PI;
    return [
      center.x + Math.cos(angle) * CREASE_RADIUS,
      center.z + Math.sin(angle) * CREASE_RADIUS * direction,
    ];
  });
  const mouthDepth = 0.72 * direction;
  const postHalfWidth = 0.96;

  return (
    <group>
      <mesh position={[center.x, 0.018, center.z]} rotation={[direction > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0]}>
        <circleGeometry args={[CREASE_RADIUS, 64, 0, Math.PI]} />
        <meshStandardMaterial color={REPLAY_COLORS.crease} transparent opacity={0.18} roughness={0.8} />
      </mesh>
      <GroundLine points={arcPoints} color={REPLAY_COLORS.crease} width={0.045} opacity={0.9} />
      <GroundLine
        points={[
          [center.x - postHalfWidth, center.z],
          [center.x - postHalfWidth, center.z + mouthDepth],
          [center.x + postHalfWidth, center.z + mouthDepth],
          [center.x + postHalfWidth, center.z],
        ]}
        color={REPLAY_COLORS.lineRed}
        width={0.038}
        opacity={0.74}
      />
      <GroundLine
        points={[[center.x - 1.18, center.z], [center.x + 1.18, center.z]]}
        color={REPLAY_COLORS.lineRed}
        width={0.05}
        opacity={0.8}
      />
    </group>
  );
}

function RoundedCourtSurface({ textures }) {
  const shape = useMemo(() => roundedRectShape(RINK_WORLD.width, RINK_WORLD.length, CORNER_RADIUS), []);
  const geometry = useMemo(() => new THREE.ShapeGeometry(shape, 48), [shape]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow geometry={geometry}>
      <meshStandardMaterial
        map={textures.map}
        bumpMap={textures.bumpMap}
        bumpScale={textures.bumpMap ? 0.018 : 0}
        color={textures.map ? '#e6f1eb' : REPLAY_COLORS.floor}
        roughness={0.94}
        metalness={0.01}
      />
    </mesh>
  );
}

function CourtPerimeterDetail() {
  const kickPlatePath = useMemo(
    () => roundedRectPathPoints(RINK_WORLD.width, RINK_WORLD.length, CORNER_RADIUS, 0.034, 0.08),
    [],
  );
  const dasherShadowPath = useMemo(
    () => roundedRectPathPoints(RINK_WORLD.width, RINK_WORLD.length, CORNER_RADIUS, 0.038, 0.34),
    [],
  );

  return (
    <group>
      <Line points={dasherShadowPath} color="#111827" transparent opacity={0.26} lineWidth={0.08} />
      <Line points={kickPlatePath} color={REPLAY_COLORS.boardKick} transparent opacity={0.82} lineWidth={0.075} />
    </group>
  );
}

function NetMesh({ width = 1.83, height = 1.22, depth = 1.08 }) {
  const lines = [];
  for (let i = -3; i <= 3; i += 1) {
    const x = (i / 3) * (width / 2);
    lines.push(<Line key={`back-v-${i}`} points={[[x, 0, -depth], [x, height, -depth]]} color="#f8fafc" transparent opacity={0.42} lineWidth={0.015} />);
  }
  for (let i = 0; i <= 4; i += 1) {
    const y = (i / 4) * height;
    lines.push(<Line key={`back-h-${i}`} points={[[-width / 2, y, -depth], [width / 2, y, -depth]]} color="#f8fafc" transparent opacity={0.34} lineWidth={0.015} />);
  }
  lines.push(<Line key="back-diag-a" points={[[-width / 2, 0, -depth], [width / 2, height, -depth]]} color="#f8fafc" transparent opacity={0.22} lineWidth={0.012} />);
  lines.push(<Line key="back-diag-b" points={[[width / 2, 0, -depth], [-width / 2, height, -depth]]} color="#f8fafc" transparent opacity={0.22} lineWidth={0.012} />);
  for (const side of [-1, 1]) {
    for (let i = 0; i <= 4; i += 1) {
      const z = -(i / 4) * depth;
      lines.push(<Line key={`side-z-${side}-${i}`} points={[[side * width / 2, 0, z], [side * width / 2, height, z]]} color="#f8fafc" transparent opacity={0.3} lineWidth={0.012} />);
    }
    for (let i = 1; i <= 3; i += 1) {
      const y = (i / 4) * height;
      lines.push(<Line key={`side-y-${side}-${i}`} points={[[side * width / 2, y, 0], [side * width / 2, y, -depth]]} color="#f8fafc" transparent opacity={0.28} lineWidth={0.012} />);
    }
  }
  for (let i = -2; i <= 2; i += 1) {
    const x = (i / 2) * (width / 2);
    lines.push(<Line key={`roof-depth-${i}`} points={[[x, height, 0], [x * 0.82, height * 0.8, -depth]]} color="#f8fafc" transparent opacity={0.26} lineWidth={0.012} />);
  }
  return <group>{lines}</group>;
}

function Net({ y, flip = false }) {
  const p = rinkToWorld({ x: 50, y, height: 0.05 });
  const zOffset = flip ? -0.54 : 0.54;
  const frameMaterial = () => <meshStandardMaterial color={REPLAY_COLORS.lineRed} roughness={0.24} metalness={0.14} />;
  return (
    <group position={[p.x, p.y, p.z + zOffset]} rotation={[0, flip ? Math.PI : 0, 0]}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[1.95, 0.08, 0.08]} />
        {frameMaterial()}
      </mesh>
      <mesh position={[-0.92, 0.62, 0]} castShadow>
        <boxGeometry args={[0.08, 1.22, 0.08]} />
        {frameMaterial()}
      </mesh>
      <mesh position={[0.92, 0.62, 0]} castShadow>
        <boxGeometry args={[0.08, 1.22, 0.08]} />
        {frameMaterial()}
      </mesh>
      <mesh position={[0, 0.96, -1.08]} castShadow>
        <boxGeometry args={[1.52, 0.06, 0.06]} />
        {frameMaterial()}
      </mesh>
      <mesh position={[-0.76, 0.5, -1.08]} castShadow>
        <boxGeometry args={[0.06, 0.98, 0.06]} />
        {frameMaterial()}
      </mesh>
      <mesh position={[0.76, 0.5, -1.08]} castShadow>
        <boxGeometry args={[0.06, 0.98, 0.06]} />
        {frameMaterial()}
      </mesh>
      <Line points={[[-0.92, 1.2, 0], [-0.76, 0.96, -1.08], [0.76, 0.96, -1.08], [0.92, 1.2, 0]]} color={REPLAY_COLORS.lineRed} lineWidth={0.04} />
      <Line points={[[-0.92, 0.02, 0], [-0.76, 0.02, -1.08], [0.76, 0.02, -1.08], [0.92, 0.02, 0]]} color={REPLAY_COLORS.lineRed} lineWidth={0.032} />
      <mesh position={[0, 0.62, -1.085]}>
        <planeGeometry args={[1.62, 1.18]} />
        <meshBasicMaterial color="#f8fafc" transparent opacity={0.05} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.02, -0.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[2.35, 1.3]} />
        <meshBasicMaterial color="#020617" transparent opacity={0.12} />
      </mesh>
      <mesh position={[0, 0.46, -0.52]} rotation={[0.15, 0, 0]}>
        <boxGeometry args={[2.02, 0.03, 1.08]} />
        <meshStandardMaterial color="#f8fafc" transparent opacity={0.2} roughness={0.28} />
      </mesh>
      <group position={[0, 0.02, 0]}>
        <NetMesh />
      </group>
    </group>
  );
}

function BoardAd({ text, position, rotation = [0, 0, 0], size = 0.55 }) {
  return (
    <Text
      position={position}
      rotation={rotation}
      fontSize={size}
      color="#1f2937"
      anchorX="center"
      anchorY="middle"
      fontWeight={900}
      fillOpacity={0.72}
    >
      {text}
    </Text>
  );
}

function ArenaRibbon({ z, color, text, flip = false }) {
  return (
    <group position={[0, 2.25, z]} rotation={[0, flip ? Math.PI : 0, 0]}>
      <mesh>
        <boxGeometry args={[RINK_WORLD.width + 4, 0.42, 0.08]} />
        <meshStandardMaterial color="#111827" roughness={0.62} />
      </mesh>
      <Text position={[0, 0.02, -0.052]} fontSize={0.3} color={color} anchorX="center" anchorY="middle" fontWeight={900}>
        {text}
      </Text>
    </group>
  );
}

function createCrowdBackdropTexture(seed = 1) {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const palette = ['#e5e7eb', '#94a3b8', '#475569', '#1d4ed8', '#dc2626', '#0f172a'];
  context.fillStyle = '#111827';
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < ARENA_CROWD_PROFILE.rowBands; row += 1) {
    const y = 32 + row * 74;
    context.fillStyle = row % 2 === 0 ? 'rgba(15,23,42,0.72)' : 'rgba(30,41,59,0.7)';
    context.fillRect(0, y - 24, canvas.width, 52);
    context.fillStyle = 'rgba(148,163,184,0.24)';
    context.fillRect(0, y + 24, canvas.width, 4);

    for (let i = 0; i < 36; i += 1) {
      const hash = (i * 97 + row * 53 + seed * 31) % 997;
      const x = 14 + i * 28 + (hash % 11);
      const height = 22 + (hash % 18);
      const width = 8 + (hash % 5);
      context.fillStyle = palette[hash % palette.length];
      context.globalAlpha = 0.42 + (hash % 4) * 0.08;
      context.beginPath();
      context.roundRect(x, y - height / 2, width, height, 4);
      context.fill();
      context.fillStyle = '#cbd5e1';
      context.globalAlpha = 0.34;
      context.beginPath();
      context.arc(x + width / 2, y - height / 2 - 5, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  context.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1, 1);
  texture.anisotropy = 2;
  return texture;
}

function CrowdBackdrop() {
  const { width, length } = RINK_WORLD;
  const sideTexture = useMemo(() => createCrowdBackdropTexture(3), []);
  const endTexture = useMemo(() => createCrowdBackdropTexture(7), []);
  const materialProps = (texture) => ({
    map: texture,
    color: texture ? '#ffffff' : '#1f2937',
    transparent: true,
    opacity: 0.62,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={`crowd-backdrop-side-${side}`} position={[side * (width / 2 + 2.6), 1.78, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[length + 5.4, 2.5]} />
          <meshBasicMaterial {...materialProps(sideTexture)} />
        </mesh>
      ))}
      {[-1, 1].map((end) => (
        <mesh key={`crowd-backdrop-end-${end}`} position={[0, 1.72, end * (length / 2 + 2.75)]}>
          <planeGeometry args={[width + 5.4, 2.35]} />
          <meshBasicMaterial {...materialProps(endTexture)} />
        </mesh>
      ))}
    </group>
  );
}

function Crowd() {
  const { width, length } = RINK_WORLD;
  const sideSeatDepth = length + 4.4;
  const endSeatWidth = width + 4.4;
  const people = useMemo(() => {
    const items = [];
    for (let i = 0; i < 144; i += 1) {
      const row = Math.floor(i / 48);
      const index = i % 48;
      const side = index < 24 ? -1 : 1;
      const lane = index % 24;
      items.push({
        x: side * (width / 2 + 1.25 + row * 0.42),
        z: -length / 2 + 1.2 + lane * ((length - 2.4) / 23),
        color: ['#94a3b8', '#64748b', '#ef4444', '#1d4ed8', '#f8fafc'][i % 5],
        height: 0.75 + (i % 4) * 0.08,
      });
    }
    return items;
  }, [length, width]);

  return (
    <group>
      <CrowdBackdrop />
      {[-1, 1].map((side) => (
        <group key={`side-seating-${side}`}>
          {Array.from({ length: 6 }, (_, row) => (
            <mesh
              key={`side-seat-row-${side}-${row}`}
              position={[side * (width / 2 + 2.1 + row * 0.42), 0.16 + row * 0.16, 0]}
              rotation={[0, 0, side * -0.05]}
            >
              <boxGeometry args={[0.34, 0.12, sideSeatDepth]} />
              <meshStandardMaterial color={row % 2 === 0 ? '#111827' : '#182235'} roughness={0.72} />
            </mesh>
          ))}
        </group>
      ))}
      {[-1, 1].map((end) => (
        <group key={`end-seating-${end}`}>
          {Array.from({ length: 4 }, (_, row) => (
            <mesh
              key={`end-seat-row-${end}-${row}`}
              position={[0, 0.14 + row * 0.16, end * (length / 2 + 2.2 + row * 0.42)]}
            >
              <boxGeometry args={[endSeatWidth, 0.12, 0.34]} />
              <meshStandardMaterial color={row % 2 === 0 ? '#111827' : '#182235'} roughness={0.72} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[-width / 2 - 1.6, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, length + 3.6]} />
        <meshStandardMaterial color="#111827" transparent opacity={0.5} roughness={0.9} />
      </mesh>
      <mesh position={[width / 2 + 1.6, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, length + 3.6]} />
        <meshStandardMaterial color="#111827" transparent opacity={0.5} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.04, length / 2 + 1.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width + 3.6, 3.2]} />
        <meshStandardMaterial color="#111827" transparent opacity={0.46} roughness={0.9} />
      </mesh>
      {people.map((person) => (
        <group key={`${person.x}-${person.z}`} position={[person.x, 0.15, person.z]}>
          <mesh position={[0, person.height / 2, 0]}>
            <capsuleGeometry args={[0.09, person.height, 6, 8]} />
            <meshStandardMaterial color={person.color} transparent opacity={0.45} roughness={0.75} />
          </mesh>
        </group>
      ))}
      {Array.from({ length: 64 }, (_, i) => (
        <group key={`end-crowd-${i}`} position={[-width / 2 + 1.2 + (i % 32) * ((width - 2.4) / 31), 0.15, length / 2 + 1.1 + Math.floor(i / 32) * 0.58]}>
          <mesh position={[0, 0.38, 0]}>
            <capsuleGeometry args={[0.08, 0.62 + (i % 3) * 0.06, 6, 8]} />
            <meshStandardMaterial color={['#94a3b8', '#64748b', '#ef4444', '#1d4ed8', '#f8fafc'][i % 5]} transparent opacity={0.42} roughness={0.75} />
          </mesh>
        </group>
      ))}
      <ArenaRibbon z={-length / 2 - 2.1} color="#38bdf8" text="GOON SQUAD BALL HOCKEY" />
      <ArenaRibbon z={length / 2 + 2.1} color="#f87171" text="BOARDS RELEASE REPLAY" flip />
      <mesh position={[0, 3.3, -length / 2 - 3.5]}>
        <boxGeometry args={[width + 5.2, 3.1, 0.18]} />
        <meshStandardMaterial color="#0b1220" roughness={0.76} />
      </mesh>
      <mesh position={[0, 3.3, length / 2 + 3.5]}>
        <boxGeometry args={[width + 5.2, 3.1, 0.18]} />
        <meshStandardMaterial color="#0b1220" roughness={0.76} />
      </mesh>
      <mesh position={[-width / 2 - 3.4, 3.2, 0]}>
        <boxGeometry args={[0.18, 3, length + 4.2]} />
        <meshStandardMaterial color="#0b1220" roughness={0.76} />
      </mesh>
      <mesh position={[width / 2 + 3.4, 3.2, 0]}>
        <boxGeometry args={[0.18, 3, length + 4.2]} />
        <meshStandardMaterial color="#0b1220" roughness={0.76} />
      </mesh>
    </group>
  );
}

function GlassPost({ position, rotation = [0, 0, 0] }) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <boxGeometry args={[0.06, 1.05, 0.08]} />
      <meshStandardMaterial color="#64748b" roughness={0.32} metalness={0.22} />
    </mesh>
  );
}

function Boards() {
  const { width, length } = RINK_WORLD;
  const straightLength = length - CORNER_RADIUS * 2;
  const straightWidth = width - CORNER_RADIUS * 2;
  const cornerCenters = [
    { key: 'br', x: width / 2 - CORNER_RADIUS, z: -length / 2 + CORNER_RADIUS, start: -Math.PI / 2, end: 0 },
    { key: 'tr', x: width / 2 - CORNER_RADIUS, z: length / 2 - CORNER_RADIUS, start: 0, end: Math.PI / 2 },
    { key: 'tl', x: -width / 2 + CORNER_RADIUS, z: length / 2 - CORNER_RADIUS, start: Math.PI / 2, end: Math.PI },
    { key: 'bl', x: -width / 2 + CORNER_RADIUS, z: -length / 2 + CORNER_RADIUS, start: Math.PI, end: Math.PI * 1.5 },
  ];

  return (
    <group>
      <mesh position={[0, 0.55, -length / 2 - 0.22]}>
        <boxGeometry args={[straightWidth, 1.1, 0.42]} />
        <meshStandardMaterial color={REPLAY_COLORS.boardWhite} roughness={0.48} />
      </mesh>
      <mesh position={[0, 0.55, length / 2 + 0.22]}>
        <boxGeometry args={[straightWidth, 1.1, 0.42]} />
        <meshStandardMaterial color={REPLAY_COLORS.boardWhite} roughness={0.48} />
      </mesh>
      <mesh position={[-width / 2 - 0.22, 0.55, 0]}>
        <boxGeometry args={[0.42, 1.1, straightLength]} />
        <meshStandardMaterial color={REPLAY_COLORS.boardWhite} roughness={0.48} />
      </mesh>
      <mesh position={[width / 2 + 0.22, 0.55, 0]}>
        <boxGeometry args={[0.42, 1.1, straightLength]} />
        <meshStandardMaterial color={REPLAY_COLORS.boardWhite} roughness={0.48} />
      </mesh>

      {cornerCenters.map((corner) => (
        <mesh
          key={corner.key}
          position={[corner.x, 0, corner.z]}
          geometry={curvedWallGeometry({
            radius: CORNER_RADIUS,
            height: BOARD_HEIGHT,
            startAngle: corner.start,
            endAngle: corner.end,
          })}
        >
          <meshStandardMaterial color={REPLAY_COLORS.boardWhite} roughness={0.48} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {cornerCenters.map((corner) => (
        <mesh
          key={`corner-cap-${corner.key}`}
          position={[corner.x, 1.12, corner.z]}
          geometry={curvedWallGeometry({
            radius: CORNER_RADIUS + 0.29,
            height: 0.16,
            thickness: 0.18,
            startAngle: corner.start,
            endAngle: corner.end,
            segments: 18,
          })}
        >
          <meshStandardMaterial color={REPLAY_COLORS.boardCap} roughness={0.38} metalness={0.08} side={THREE.DoubleSide} />
        </mesh>
      ))}

      <mesh position={[0, 1.14, -length / 2 - 0.45]}>
        <boxGeometry args={[straightWidth + 0.4, 0.16, 0.25]} />
        <meshStandardMaterial color={REPLAY_COLORS.boardCap} roughness={0.38} metalness={0.08} />
      </mesh>
      <mesh position={[0, 1.14, length / 2 + 0.45]}>
        <boxGeometry args={[straightWidth + 0.4, 0.16, 0.25]} />
        <meshStandardMaterial color={REPLAY_COLORS.boardCap} roughness={0.38} metalness={0.08} />
      </mesh>
      <mesh position={[-width / 2 - 0.45, 1.14, 0]}>
        <boxGeometry args={[0.25, 0.16, straightLength + 0.4]} />
        <meshStandardMaterial color={REPLAY_COLORS.boardCap} roughness={0.38} metalness={0.08} />
      </mesh>
      <mesh position={[width / 2 + 0.45, 1.14, 0]}>
        <boxGeometry args={[0.25, 0.16, straightLength + 0.4]} />
        <meshStandardMaterial color={REPLAY_COLORS.boardCap} roughness={0.38} metalness={0.08} />
      </mesh>

      <mesh position={[0, 0.08, -length / 2 - 0.45]}>
        <boxGeometry args={[straightWidth, 0.16, 0.1]} />
        <meshStandardMaterial color={REPLAY_COLORS.boardKick} roughness={0.38} />
      </mesh>
      <mesh position={[0, 0.08, length / 2 + 0.45]}>
        <boxGeometry args={[straightWidth, 0.16, 0.1]} />
        <meshStandardMaterial color={REPLAY_COLORS.boardKick} roughness={0.38} />
      </mesh>
      <mesh position={[-width / 2 - 0.45, 0.08, 0]}>
        <boxGeometry args={[0.1, 0.16, straightLength]} />
        <meshStandardMaterial color={REPLAY_COLORS.boardKick} roughness={0.38} />
      </mesh>
      <mesh position={[width / 2 + 0.45, 0.08, 0]}>
        <boxGeometry args={[0.1, 0.16, straightLength]} />
        <meshStandardMaterial color={REPLAY_COLORS.boardKick} roughness={0.38} />
      </mesh>

      {Array.from({ length: 13 }, (_, i) => {
        const x = -straightWidth / 2 + i * (straightWidth / 12);
        return (
          <group key={`end-dasher-seam-${i}`}>
            <mesh position={[x, 0.58, -length / 2 - 0.005]}>
              <boxGeometry args={[0.035, 0.92, 0.035]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.5} />
            </mesh>
            <mesh position={[x, 0.58, length / 2 + 0.005]}>
              <boxGeometry args={[0.035, 0.92, 0.035]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.5} />
            </mesh>
          </group>
        );
      })}
      {Array.from({ length: 19 }, (_, i) => {
        const z = -straightLength / 2 + i * (straightLength / 18);
        return (
          <group key={`side-dasher-seam-${i}`}>
            <mesh position={[-width / 2 - 0.005, 0.58, z]}>
              <boxGeometry args={[0.035, 0.92, 0.035]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.5} />
            </mesh>
            <mesh position={[width / 2 + 0.005, 0.58, z]}>
              <boxGeometry args={[0.035, 0.92, 0.035]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.5} />
            </mesh>
          </group>
        );
      })}

      <BoardAd text="GOON SQUAD" position={[0, 0.68, length / 2 + 0.02]} rotation={[0, Math.PI, 0]} size={0.66} />
      <BoardAd text="BALL HOCKEY" position={[0, 0.68, -length / 2 - 0.02]} size={0.52} />
      <BoardAd text="PRO STOCK" position={[-width / 2 - 0.02, 0.7, 0]} rotation={[0, Math.PI / 2, 0]} size={0.46} />
      <BoardAd text="FAST FLOOR" position={[width / 2 + 0.02, 0.7, 0]} rotation={[0, -Math.PI / 2, 0]} size={0.46} />

      {[
        [0, 1.48, -length / 2 - 0.48, straightWidth, 1.05, 0.05],
        [0, 1.48, length / 2 + 0.48, straightWidth, 1.05, 0.05],
        [-width / 2 - 0.48, 1.48, 0, 0.05, 1.05, straightLength],
        [width / 2 + 0.48, 1.48, 0, 0.05, 1.05, straightLength],
      ].map(([x, y, z, w, h, d]) => (
        <mesh key={`${x}-${z}`} position={[x, y, z]}>
          <boxGeometry args={[w, h, d]} />
          <meshPhysicalMaterial color={REPLAY_COLORS.glass} transparent opacity={0.2} roughness={0.04} transmission={0.3} />
        </mesh>
      ))}
      {cornerCenters.map((corner) => (
        <mesh
          key={`corner-glass-${corner.key}`}
          position={[corner.x, 1.14, corner.z]}
          geometry={curvedWallGeometry({
            radius: CORNER_RADIUS + 0.52,
            height: 0.74,
            thickness: 0.045,
            startAngle: corner.start,
            endAngle: corner.end,
            segments: 20,
          })}
        >
          <meshPhysicalMaterial
            color={REPLAY_COLORS.glass}
            transparent
            opacity={0.16}
            roughness={0.03}
            transmission={0.35}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {Array.from({ length: 9 }, (_, i) => {
        const x = -straightWidth / 2 + i * (straightWidth / 8);
        return (
          <group key={`glass-end-${i}`}>
            <GlassPost position={[x, 1.48, -length / 2 - 0.5]} />
            <GlassPost position={[x, 1.48, length / 2 + 0.5]} />
          </group>
        );
      })}
      {Array.from({ length: 15 }, (_, i) => {
        const z = -straightLength / 2 + i * (straightLength / 14);
        return (
          <group key={`glass-side-${i}`}>
            <GlassPost position={[-width / 2 - 0.5, 1.48, z]} />
            <GlassPost position={[width / 2 + 0.5, 1.48, z]} />
          </group>
        );
      })}
      {[
        [-width / 2 - 0.5, 1.5, -length / 2 + CORNER_RADIUS],
        [width / 2 + 0.5, 1.5, -length / 2 + CORNER_RADIUS],
        [-width / 2 - 0.5, 1.5, length / 2 - CORNER_RADIUS],
        [width / 2 + 0.5, 1.5, length / 2 - CORNER_RADIUS],
      ].map(([x, y, z]) => (
        <GlassPost key={`corner-post-${x}-${z}`} position={[x, y, z]} />
      ))}
    </group>
  );
}

export default function ReplayCourt() {
  const textures = useMemo(() => createCourtTextures(), []);

  return (
    <group>
      <RoundedCourtSurface textures={textures} />
      <SportTileLines />
      <CourtPerimeterDetail />

      <CourtStripe y={50} color={REPLAY_COLORS.lineRed} thickness={0.18} opacity={0.42} />
      <CourtStripe y={36} color={REPLAY_COLORS.lineBlue} thickness={0.16} opacity={0.46} />
      <CourtStripe y={64} color={REPLAY_COLORS.lineBlue} thickness={0.16} opacity={0.46} />
      <CourtStripe y={7.5} color={REPLAY_COLORS.lineRed} thickness={0.1} opacity={0.34} />
      <CourtStripe y={92.5} color={REPLAY_COLORS.lineRed} thickness={0.1} opacity={0.34} />
      <CourtLine y={50} color={REPLAY_COLORS.lineRed} width={0.09} opacity={0.82} />
      <CourtLine y={36} color={REPLAY_COLORS.lineBlue} width={0.085} opacity={0.9} />
      <CourtLine y={64} color={REPLAY_COLORS.lineBlue} width={0.085} opacity={0.9} />

      {[21, 79].flatMap((y) => [28, 72].map((x) => <FaceoffRing key={`${x}-${y}`} x={x} y={y} />))}

      <CenterFaceoffMarkings />
      <Text
        position={[0, 0.036, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.78}
        color="#0f172a"
        anchorX="center"
        anchorY="middle"
        fillOpacity={0.08}
      >
        GOON SQUAD
      </Text>

      <GoalCrease y={7} direction={1} />
      <GoalCrease y={93} direction={-1} />

      <Net y={6} />
      <Net y={94} flip />
      <Boards />
      <Crowd />
    </group>
  );
}
