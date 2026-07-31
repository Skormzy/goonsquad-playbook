import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { LocateFixed, Redo2, Undo2 } from 'lucide-react';
import {
  CanvasTexture,
  Color,
  DoubleSide,
  SRGBColorSpace,
} from 'three';
import ProductionAthlete from '../components/vnext3d/ProductionAthlete';
import { ACCEPTED_ATHLETE_ASSETS } from '../components/vnext3d/acceptedAthleteAssets';

const DEFAULT_CAMERA_ANGLE = Math.atan2(3.15, 3.85);
const CAMERA_RADIUS = Math.hypot(3.15, 3.85);
const CAMERA_TURN_STEP = Math.PI / 6;
const CAMERA_TARGET = Object.freeze([0, 0.92, 0]);

function NumberBackdrop({ value, accent }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, 512, 512);
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '900 390px "Arial Narrow", sans-serif';
    context.lineWidth = 16;
    context.strokeStyle = 'rgba(255,255,255,0.12)';
    context.strokeText(value, 256, 274);
    context.fillStyle = accent;
    context.globalAlpha = 0.3;
    context.fillText(value, 256, 274);
    const next = new CanvasTexture(canvas);
    next.colorSpace = SRGBColorSpace;
    next.needsUpdate = true;
    return next;
  }, [accent, value]);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={[0, 1.24, -0.72]} renderOrder={0}>
      <planeGeometry args={[2.75, 2.75]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        side={DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

function Athlete({ goalie }) {
  const contactPoints = useMemo(() => new Map(), []);
  const groundContacts = useMemo(() => new Map(), []);
  const poseSamples = useMemo(() => new Map(), []);
  const transitionEventsRef = useRef([]);

  return (
    <ProductionAthlete
      actionPhase={0.18}
      assetUrl={ACCEPTED_ATHLETE_ASSETS[goalie ? 'goalie-home' : 'field-home']}
      clipName={goalie ? 'goalie-ready' : 'ready'}
      contactActive={false}
      contactPoints={contactPoints}
      groundContacts={groundContacts}
      groundSampleInterval={0.5}
      hideJerseyNumber
      motionCyclesPerSecond={0}
      motionPhaseCycles={0}
      playbackRate={0}
      playbackTime={0}
      playerId="PROFILE_PLAYER"
      poseSamples={poseSamples}
      position={[0, 0, 0]}
      rotation={0}
      transitionEventsRef={transitionEventsRef}
      worldAngularVelocity={0}
      worldVelocity={[0, 0, 0]}
    />
  );
}

function ProfileCamera({ angle, controlsRef }) {
  const { camera, invalidate } = useThree();

  useEffect(() => {
    camera.position.set(
      Math.sin(angle) * CAMERA_RADIUS,
      1.65,
      Math.cos(angle) * CAMERA_RADIUS,
    );
    camera.lookAt(...CAMERA_TARGET);
    if (controlsRef.current) {
      controlsRef.current.target.set(...CAMERA_TARGET);
      controlsRef.current.update();
    }
    invalidate();
  }, [angle, camera, controlsRef, invalidate]);

  return null;
}

function ProfileScene({
  number,
  goalie,
  dark,
  cameraAngle,
  controlsRef,
}) {
  const accent = dark ? '#ff2f59' : '#df123f';
  const background = dark ? '#080c13' : '#edf1f3';
  const floor = dark ? '#111b28' : '#d8e0e5';

  return (
    <>
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[background, 6.5, 10]} />
      <hemisphereLight intensity={2.3} color="#f8fdff" groundColor={floor} />
      <directionalLight intensity={3.8} color="#fff4e7" position={[3, 6, 4]} />
      <directionalLight intensity={1.8} color="#71dfff" position={[-4, 3, 2]} />
      <ProfileCamera angle={cameraAngle} controlsRef={controlsRef} />
      <NumberBackdrop value={number} accent={accent} />
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.05, 1.13, 72]} />
        <meshBasicMaterial color={accent} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, -0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.65, 72]} />
        <meshStandardMaterial
          color={new Color(floor)}
          roughness={0.92}
          metalness={0.02}
        />
      </mesh>
      <Suspense fallback={null}>
        <Athlete goalie={goalie} />
      </Suspense>
      <ContactShadows
        position={[0, 0.018, 0]}
        opacity={dark ? 0.52 : 0.3}
        scale={4.5}
        blur={2.4}
        far={3}
      />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={CAMERA_TARGET}
        enablePan={false}
        minDistance={2.5}
        maxDistance={5}
        minPolarAngle={Math.PI * 0.26}
        maxPolarAngle={Math.PI * 0.49}
      />
    </>
  );
}

export default function PlayerSpotlight3D({
  displayName,
  jerseyNumber,
  goalie = false,
  dark = false,
}) {
  const [cameraAngle, setCameraAngle] = useState(DEFAULT_CAMERA_ANGLE);
  const controlsRef = useRef(null);
  const instructionsId = useId();
  const number = jerseyNumber ? String(jerseyNumber) : displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const turnCamera = useCallback((direction) => {
    setCameraAngle((angle) => angle + direction * CAMERA_TURN_STEP);
  }, []);
  const recenterCamera = useCallback(() => {
    setCameraAngle(DEFAULT_CAMERA_ANGLE);
  }, []);
  const handleKeyDown = useCallback((event) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      turnCamera(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      turnCamera(1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      recenterCamera();
    }
  }, [recenterCamera, turnCamera]);

  return (
    <div
      className="player-profile-3d"
      data-testid="player-profile-3d"
      aria-label={`Interactive 3D Goonsquad athlete for ${displayName}`}
      aria-describedby={instructionsId}
      role="region"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <span className="sr-only" id={instructionsId}>
        Drag to rotate the player view. Use Left Arrow and Right Arrow to rotate,
        or Home to reset the camera.
      </span>
      <Canvas
        aria-hidden="true"
        camera={{ position: [3.15, 1.65, 3.85], fov: 34, near: 0.1, far: 30 }}
        dpr={[1, 1.5]}
        frameloop="demand"
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <ProfileScene
          number={number || 'GS'}
          goalie={goalie}
          dark={dark}
          cameraAngle={cameraAngle}
          controlsRef={controlsRef}
        />
      </Canvas>
      <div className="player-profile-3d-controls" aria-label="Player view controls">
        <button
          type="button"
          aria-label="Rotate player view left"
          title="Rotate left"
          onClick={() => turnCamera(-1)}
        >
          <Undo2 aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Reset player view"
          title="Reset view"
          onClick={recenterCamera}
        >
          <LocateFixed aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Rotate player view right"
          title="Rotate right"
          onClick={() => turnCamera(1)}
        >
          <Redo2 aria-hidden="true" />
        </button>
      </div>
      <div className="player-profile-3d-label">
        <span>{jerseyNumber ? `#${jerseyNumber}` : 'GOONSQUAD'}</span>
        <small>INTERACTIVE PLAYER VIEW</small>
      </div>
    </div>
  );
}
