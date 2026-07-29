import { useMemo } from 'react';
import {
  CanvasTexture,
  Color,
  ExtrudeGeometry,
  LinearFilter,
  Path,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
} from 'three';
import { COURT_LENGTH_METERS, COURT_WIDTH_METERS } from '../../vnext3d/runtimeMapping';
import { neutralFaceoffDots, PRODUCTION_COURT_MARKINGS } from '../../vnext3d/courtMarkings';

function roundedRectangle(width, length, radius) {
  const halfWidth = width / 2;
  const halfLength = length / 2;
  const shape = new Shape();
  shape.moveTo(-halfWidth + radius, -halfLength);
  shape.lineTo(halfWidth - radius, -halfLength);
  shape.quadraticCurveTo(halfWidth, -halfLength, halfWidth, -halfLength + radius);
  shape.lineTo(halfWidth, halfLength - radius);
  shape.quadraticCurveTo(halfWidth, halfLength, halfWidth - radius, halfLength);
  shape.lineTo(-halfWidth + radius, halfLength);
  shape.quadraticCurveTo(-halfWidth, halfLength, -halfWidth, halfLength - radius);
  shape.lineTo(-halfWidth, -halfLength + radius);
  shape.quadraticCurveTo(-halfWidth, -halfLength, -halfWidth + radius, -halfLength);
  shape.closePath();
  return shape;
}

function roundedPath(width, length, radius) {
  const source = roundedRectangle(width, length, radius);
  const path = new Path();
  path.curves = source.curves;
  path.currentPoint.copy(source.currentPoint);
  path.autoClose = true;
  return path;
}

function useCourtGeometry() {
  return useMemo(() => {
    const surfaceShape = roundedRectangle(COURT_WIDTH_METERS, COURT_LENGTH_METERS, 3.8);
    const boardRing = roundedRectangle(COURT_WIDTH_METERS + 0.8, COURT_LENGTH_METERS + 0.8, 4.2);
    boardRing.holes.push(roundedPath(COURT_WIDTH_METERS, COURT_LENGTH_METERS, 3.8));
    return {
      surface: new ShapeGeometry(surfaceShape, 64),
      boards: new ExtrudeGeometry(boardRing, { depth: 0.88, bevelEnabled: false, curveSegments: 48 }),
      rail: new ExtrudeGeometry(boardRing, { depth: 0.08, bevelEnabled: false, curveSegments: 48 }),
      glass: new ExtrudeGeometry(boardRing, { depth: 0.72, bevelEnabled: false, curveSegments: 48 }),
    };
  }, []);
}

function useCourtTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const context = canvas.getContext('2d');
    context.fillStyle = '#c9d0cf';
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y += 32) {
      context.fillStyle = y % 64 === 0 ? 'rgba(255,255,255,.018)' : 'rgba(45,59,59,.018)';
      context.fillRect(0, y, canvas.width, 16);
    }
    for (let x = 0; x < canvas.width; x += 64) {
      context.strokeStyle = 'rgba(67,83,83,.045)';
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }
    const {
      widthMeters,
      lengthMeters,
      zoneLineZ,
      goalLineZ,
      faceoffX,
      faceoffZ,
      faceoffCircleRadius,
      centerCircleRadius,
      creaseRadius,
    } = PRODUCTION_COURT_MARKINGS;
    const xPixel = (x) => (x / widthMeters + 0.5) * canvas.width;
    const zPixel = (z) => (0.5 - z / lengthMeters) * canvas.height;
    const meterPixels = canvas.width / widthMeters;
    const line = (x1, z1, x2, z2, color, width) => {
      context.strokeStyle = color;
      context.lineWidth = width * meterPixels;
      context.beginPath();
      context.moveTo(xPixel(x1), zPixel(z1));
      context.lineTo(xPixel(x2), zPixel(z2));
      context.stroke();
    };
    const circle = (x, z, radius, color, width, fill = false) => {
      context.beginPath();
      context.arc(xPixel(x), zPixel(z), radius * meterPixels, 0, Math.PI * 2);
      if (fill) {
        context.fillStyle = color;
        context.fill();
      } else {
        context.strokeStyle = color;
        context.lineWidth = width * meterPixels;
        context.stroke();
      }
    };
    const red = '#b64249';
    const blue = '#356cb5';
    const halfWidth = widthMeters / 2;

    for (const z of [-goalLineZ, goalLineZ]) {
      const topGoal = z > 0;
      context.beginPath();
      context.moveTo(xPixel(0), zPixel(z));
      context.arc(
        xPixel(0),
        zPixel(z),
        creaseRadius * meterPixels,
        topGoal ? 0 : Math.PI,
        topGoal ? Math.PI : Math.PI * 2,
      );
      context.closePath();
      context.fillStyle = 'rgba(155,199,211,.34)';
      context.fill();
      context.strokeStyle = red;
      context.lineWidth = 0.09 * meterPixels;
      context.stroke();
    }

    line(-halfWidth, 0, halfWidth, 0, red, 0.09);
    for (const z of [-zoneLineZ, zoneLineZ]) line(-halfWidth, z, halfWidth, z, blue, 0.12);
    for (const z of [-goalLineZ, goalLineZ]) line(-halfWidth, z, halfWidth, z, red, 0.08);
    circle(0, 0, centerCircleRadius, red, 0.09);
    circle(0, 0, 0.15, red, 0, true);

    for (const xSign of [-1, 1]) {
      for (const zSign of [-1, 1]) {
        const x = xSign * faceoffX;
        const z = zSign * faceoffZ;
        circle(x, z, faceoffCircleRadius, red, 0.09);
        circle(x, z, 0.12, red, 0, true);
        for (const side of [-1, 1]) {
          for (const offset of [-1, 1]) {
            line(
              x + side * (faceoffCircleRadius - 0.24),
              z + offset * 0.46,
              x + side * (faceoffCircleRadius + 0.48),
              z + offset * 0.46,
              red,
              0.06,
            );
          }
        }
      }
    }
    for (const { x, z } of neutralFaceoffDots()) circle(x, z, 0.12, red, 0, true);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.repeat.set(1 / COURT_WIDTH_METERS, 1 / COURT_LENGTH_METERS);
    texture.offset.set(0.5, 0.5);
    return texture;
  }, []);
}

function GoalFrame({ z, direction }) {
  const red = '#d63d45';
  const goalWidth = 1.83;
  const goalHeight = 1.22;
  const goalDepth = 1.1;
  const halfWidth = goalWidth / 2;
  const back = z + direction * goalDepth;
  const middle = (z + back) / 2;
  const netMaterial = (
    <meshBasicMaterial
      color="#e8eeee"
      wireframe
      transparent
      opacity={0.42}
      toneMapped={false}
    />
  );
  return (
    <group>
      {[-halfWidth, halfWidth].map((x) => (
        <mesh key={x} position={[x, goalHeight / 2, z]}>
          <cylinderGeometry args={[0.045, 0.045, goalHeight, 16]} />
          <meshStandardMaterial color={red} roughness={0.45} />
        </mesh>
      ))}
      <mesh position={[0, goalHeight, z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, goalWidth, 16]} />
        <meshStandardMaterial color={red} roughness={0.45} />
      </mesh>
      {[-halfWidth, halfWidth].map((x) => (
        <mesh key={`base-${x}`} position={[x, 0.045, middle]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, goalDepth, 12]} />
          <meshStandardMaterial color={red} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 0.045, back]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, goalWidth, 12]} />
        <meshStandardMaterial color={red} roughness={0.5} />
      </mesh>
      <mesh position={[0, goalHeight / 2, back]}>
        <planeGeometry args={[goalWidth, goalHeight, 8, 5]} />
        {netMaterial}
      </mesh>
      <mesh position={[0, goalHeight, middle]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[goalWidth, goalDepth, 8, 4]} />
        {netMaterial}
      </mesh>
      {[-halfWidth, halfWidth].map((x) => (
        <mesh key={`side-${x}`} position={[x, goalHeight / 2, middle]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[goalDepth, goalHeight, 4, 5]} />
          {netMaterial}
        </mesh>
      ))}
    </group>
  );
}

export default function ProductionCourt({ theme = 'dark' }) {
  const geometry = useCourtGeometry();
  const texture = useCourtTexture();
  const { goalLineZ } = PRODUCTION_COURT_MARKINGS;
  const surroundColor = theme === 'light' ? '#cbd3d8' : '#111720';

  return (
    <group>
      <mesh position={[0, -0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[78, 96]} />
        <meshStandardMaterial color={surroundColor} roughness={0.98} />
      </mesh>
      <mesh geometry={geometry.surface} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial map={texture} color={new Color('#d5dcda')} roughness={0.72} metalness={0.02} />
      </mesh>
      <mesh geometry={geometry.boards} rotation={[-Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#f3f5f4" roughness={0.52} />
      </mesh>
      <mesh geometry={geometry.rail} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.88, 0]}>
        <meshStandardMaterial color="#ce3c45" roughness={0.46} />
      </mesh>
      <mesh geometry={geometry.glass} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.96, 0]}>
        <meshPhysicalMaterial color="#cce8ed" transparent opacity={0.17} roughness={0.08} metalness={0.02} depthWrite={false} />
      </mesh>

      {[-1, 1].map((zSign) => (
        <group key={zSign}>
          <GoalFrame z={zSign * goalLineZ} direction={zSign} />
        </group>
      ))}
    </group>
  );
}
