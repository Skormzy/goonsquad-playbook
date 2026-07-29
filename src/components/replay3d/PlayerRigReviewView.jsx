import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls, useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useTheme } from '../../context/ThemeContext';
import { HAS_CANDIDATE_RIGS, PLAYER_RIG_CANDIDATES } from '../../replay3d/assets/generatedPlayerRigCandidates';
import {
  HAS_FULL_PRODUCTION_RIG_SET,
  HAS_RUNNER_PRODUCTION_RIG_SET,
  PLAYER_RIG_AVAILABILITY,
} from '../../replay3d/assets/generatedPlayerRigAvailability';
import { getRigProfileForKey } from '../../replay3d/assets/playerRigAcceptance';
import { PLAYER_RIG_ASSETS } from '../../replay3d/assets/playerRigManifest';
import { applyProductionUniformMaterials } from '../../replay3d/assets/playerRigMaterials';
import { getProductionRigReadinessReport } from '../../replay3d/assets/playerRigReadiness';

const COMMANDS = [
  'npm run asset:player:contract',
  'npm run asset:player:audit -- asset-inbox/players/generated',
  'npm run asset:player:import -- asset-inbox/players/generated --runners-only',
  'npm run asset:player:validate:production',
];
const HOME_UNIFORM = {
  jersey: '#f8fafc',
  stripe: '#1d4ed8',
  shorts: '#0f172a',
  helmet: '#f8fafc',
};
const AWAY_UNIFORM = {
  jersey: '#b91c1c',
  stripe: '#fee2e2',
  shorts: '#111827',
  helmet: '#dc2626',
};

function cloneMaterial(material, tint) {
  const next = material?.clone?.() ?? new THREE.MeshStandardMaterial();
  next.roughness = Math.max(next.roughness ?? 0.48, 0.5);
  next.metalness = Math.min(next.metalness ?? 0.06, 0.08);
  if (tint && !next.map) next.color = new THREE.Color(tint);
  return next;
}

function prepareRigScene(scene, asset) {
  const next = skeletonClone(scene);
  if (asset.player) {
    applyProductionUniformMaterials(next, asset.player);
    return next;
  }

  next.traverse((object) => {
    if (!object.isMesh && !object.isSkinnedMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = false;
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => cloneMaterial(material, asset.tint))
      : cloneMaterial(object.material, asset.tint);
  });
  return next;
}

function RigPreviewModel({ asset, index, total }) {
  const rootRef = useRef(null);
  const { scene, animations } = useGLTF(asset.url);
  const model = useMemo(() => prepareRigScene(scene, asset), [scene, asset]);
  const { actions, mixer } = useAnimations(animations, model);
  const x = total === 1 ? 0 : (index - (total - 1) / 2) * 1.9;

  useEffect(() => {
    if (asset.playAnimations === false) return undefined;
    const action = Object.values(actions).find(Boolean);
    if (!action) return undefined;
    action.reset().fadeIn(0.15).play();
    return () => {
      action.fadeOut(0.12);
    };
  }, [actions, asset.playAnimations]);

  useFrame((state, delta) => {
    if (mixer) mixer.update(delta);
    if (rootRef.current) {
      rootRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.42 + index) * 0.22;
    }
  });

  return (
    <group ref={rootRef} position={[x, 0, 0]} scale={asset.scale ?? 1}>
      <group position={[0, asset.isGoalie ? 1.1 : 1.04, 0]} rotation={[0, Math.PI, 0]}>
        <primitive object={model} />
      </group>
    </group>
  );
}

function RigPreviewStage({ assets }) {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 2.35, 7.4], fov: 38 }}
      gl={{ antialias: true }}
      dpr={[1, 1.7]}
    >
      <color attach="background" args={['#06101f']} />
      <ambientLight intensity={0.72} />
      <directionalLight
        position={[3.2, 5.5, 4.2]}
        intensity={2.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <spotLight position={[-3, 4, 3]} angle={0.35} penumbra={0.8} intensity={1.35} castShadow />
      <Suspense fallback={null}>
        <Environment preset="city" />
        {assets.map((asset, index) => (
          <RigPreviewModel key={asset.key} asset={asset} index={index} total={assets.length} />
        ))}
      </Suspense>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[3.35, 72]} />
        <meshStandardMaterial color="#273445" roughness={0.72} metalness={0.02} />
      </mesh>
      <ContactShadows position={[0, 0.01, 0]} opacity={0.55} scale={6.4} blur={2.6} far={4.8} />
      <OrbitControls enablePan={false} minDistance={4.2} maxDistance={8.8} minPolarAngle={0.82} maxPolarAngle={1.35} target={[0, 1.1, 0]} />
    </Canvas>
  );
}

function ClipList({ clips }) {
  return (
    <div className="rigreview-pill-row">
      {clips.map((clip) => (
        <span key={clip} className="rigreview-pill">{clip}</span>
      ))}
    </div>
  );
}

function AssetCard({ readiness }) {
  const profile = getRigProfileForKey(readiness.key);
  const cardClass = readiness.status === 'ready'
    ? 'is-ready'
    : (readiness.status === 'missing' ? 'is-missing' : 'needs-work');

  return (
    <article className={`rigreview-asset ${cardClass}`}>
      <div className="rigreview-asset-head">
        <div>
          <h3>{readiness.label}</h3>
          <p>{readiness.url}</p>
        </div>
        <span>{readiness.statusLabel}</span>
      </div>
      <dl className="rigreview-metrics">
        <div>
          <dt>Readiness</dt>
          <dd>{readiness.readinessScore}/100</dd>
        </div>
        <div>
          <dt>Vertices</dt>
          <dd>{readiness.uploadedVertices || 0} / {profile.maxVertices}</dd>
        </div>
        <div>
          <dt>Required clips</dt>
          <dd>{profile.requiredClips.length}</dd>
        </div>
      </dl>
      <ClipList clips={readiness.status === 'ready' ? readiness.requiredClips : profile.requiredClips} />
      {readiness.issues.length > 0 && (
        <div className="rigreview-issues">
          {readiness.issues.map((issue) => (
            <p key={issue} className="rigreview-warning">{issue}</p>
          ))}
        </div>
      )}
    </article>
  );
}

function makePreviewAssets() {
  const availableProduction = Object.entries(PLAYER_RIG_AVAILABILITY.production)
    .filter(([, asset]) => asset.available)
    .map(([key, asset]) => ({
      key,
      url: asset.url,
      tint: key.includes('Home') ? '#e11d48' : '#f8fafc',
      player: {
        team: key.includes('Home') ? 'us' : 'opponent',
        role: key.includes('goalie') ? 'G' : 'C',
        uniform: key.includes('Home') ? HOME_UNIFORM : AWAY_UNIFORM,
      },
      scale: key.includes('goalie') ? 0.88 : 1,
      isGoalie: key.includes('goalie'),
      playAnimations: true,
    }));

  if (availableProduction.length > 0) return availableProduction;

  const candidatePreview = PLAYER_RIG_CANDIDATES.candidates
    .filter((candidate) => candidate.previewUrl)
    .slice(0, 4)
    .map((candidate, index) => {
      const isHome = index % 2 === 0;
      const isGoalie = candidate.recommendedProfile === 'goalie';

      return {
        key: `candidate-${candidate.fileName}`,
        url: candidate.previewUrl,
        tint: isHome ? '#e11d48' : '#f8fafc',
        player: {
          team: isHome ? 'us' : 'opponent',
          role: isGoalie ? 'G' : 'C',
          uniform: isHome ? HOME_UNIFORM : AWAY_UNIFORM,
        },
        scale: candidate.recommendedScale ?? (isGoalie ? 0.88 : 1),
        isGoalie,
        playAnimations: false,
      };
    });

  if (candidatePreview.length > 0) return candidatePreview;

  return [{
    key: 'bridge-runner',
    url: PLAYER_RIG_ASSETS.detailedRunner.url,
    tint: '#e11d48',
    scale: 1,
  }];
}

export default function PlayerRigReviewView() {
  const { theme, themes } = useTheme();
  const t = themes[theme];
  const report = getProductionRigReadinessReport(PLAYER_RIG_AVAILABILITY);
  const previewAssets = makePreviewAssets();
  const candidateSummary = HAS_CANDIDATE_RIGS
    ? `${PLAYER_RIG_CANDIDATES.totalCount} candidate GLB${PLAYER_RIG_CANDIDATES.totalCount === 1 ? '' : 's'} staged for browser review.`
    : 'No candidate GLBs staged yet.';
  const productionSummary = HAS_FULL_PRODUCTION_RIG_SET
    ? 'Replay will use production athletes.'
    : (HAS_RUNNER_PRODUCTION_RIG_SET
      ? `Production runners are active; goalies remain on bridge athletes. ${candidateSummary}`
      : `${report.missingCount} missing, ${report.needsWorkCount} need work. Replay uses detailed bridge runners while production runner assets are finalized. ${candidateSummary}`);

  return (
    <main
      className="rigreview-view"
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        background: theme === 'dark' ? '#050816' : '#d9e2ec',
        color: theme === 'dark' ? '#e2e8f0' : '#0f172a',
      }}
    >
      <section className="rigreview-shell">
        <div className="rigreview-hero" style={{ background: t.sf, borderColor: t.bd }}>
          <div>
            <div className="rigreview-kicker" style={{ color: t.ac }}>PRODUCTION GLB GATE</div>
            <h1>Ball Hockey Player Rig Review</h1>
            <p style={{ color: t.tm }}>
              This hidden surface is the quality gate for replacing bridge athletes with authored Goon Squad runners and goalies.
              It checks the exact files, clip names, equipment naming, and browser preview before the replay uses them.
            </p>
          </div>
          <div className={`rigreview-status ${HAS_FULL_PRODUCTION_RIG_SET ? 'is-ready' : 'is-missing'}`}>
            <strong>{HAS_FULL_PRODUCTION_RIG_SET ? 'Full rig set ready' : `Production rig score: ${report.score}/100`}</strong>
            <span>{productionSummary}</span>
          </div>
        </div>

        <div className="rigreview-stage" style={{ borderColor: t.bd }}>
          <RigPreviewStage assets={previewAssets} />
        </div>

        <section className="rigreview-panels">
          <div className="rigreview-panel" style={{ background: t.sf, borderColor: t.bd }}>
            <h2>Import Flow</h2>
            <p style={{ color: t.tm }}>
              Audit candidate GLBs first. Passing candidates appear in this browser preview, then the production pack can be imported once the report is clean.
            </p>
            <div className="rigreview-command-list">
              {COMMANDS.map((command) => (
                <code key={command}>{command}</code>
              ))}
            </div>
          </div>

          <div className="rigreview-panel" style={{ background: t.sf, borderColor: t.bd }}>
            <h2>Acceptance Contract</h2>
            <p style={{ color: t.tm }}>
              Runner files need running, ball-control, pass, receive, and shot clips. Goalie files need ready and slide clips.
              Equipment mesh names must include jersey, shorts or pads, shoes, helmet or mask, gloves, and stick parts.
            </p>
          </div>
        </section>

        <section className="rigreview-grid">
          {HAS_CANDIDATE_RIGS && (
            <article className="rigreview-asset needs-work">
              <div className="rigreview-asset-head">
                <div>
                  <h3>Candidate Staging</h3>
                  <p>{PLAYER_RIG_CANDIDATES.bestCandidate?.fileName ?? 'Review queue'}</p>
                </div>
                <span>{PLAYER_RIG_CANDIDATES.status}</span>
              </div>
              <dl className="rigreview-metrics">
                <div>
                  <dt>Candidates</dt>
                  <dd>{PLAYER_RIG_CANDIDATES.totalCount}</dd>
                </div>
                <div>
                  <dt>Best score</dt>
                  <dd>{PLAYER_RIG_CANDIDATES.bestCandidate?.score ?? 0}/100</dd>
                </div>
                <div>
                  <dt>Best fit</dt>
                  <dd>{PLAYER_RIG_CANDIDATES.bestCandidate?.recommendedProfile ?? 'none'}</dd>
                </div>
              </dl>
              <ClipList clips={PLAYER_RIG_CANDIDATES.bestCandidate?.clips ?? []} />
            </article>
          )}
          {report.assets.map((asset) => (
            <AssetCard key={asset.key} readiness={asset} />
          ))}
        </section>
      </section>
    </main>
  );
}

useGLTF.preload(PLAYER_RIG_ASSETS.detailedRunner.url);
Object.values(PLAYER_RIG_AVAILABILITY.production)
  .filter((asset) => asset.available)
  .forEach((asset) => useGLTF.preload(asset.url));
PLAYER_RIG_CANDIDATES.candidates
  .filter((candidate) => candidate.previewUrl)
  .forEach((candidate) => useGLTF.preload(candidate.previewUrl));
