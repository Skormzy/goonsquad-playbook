import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { PLAYS } from '../data/plays';
import { TACTICS } from '../data/tactics';
import { resolveFaceoffPlayOutcome } from '../data/faceoffPlays';
import { sampleTacticalReplay, TACTICAL_REPLAY_ENGINE_ID } from '../tactical3d/sampleTacticalReplay';
import { productionCameraPose } from '../vnext3d/cameraSystem';
import { rinkPositionToWorld } from '../vnext3d/runtimeMapping';
import { getPlayScene, getStrategyScene } from './sceneRegistry';
import { playSceneToRinkPhase } from './toRinkPhase';

const HOME_ROLES = ['LW', 'C', 'RW', 'LD', 'RD', 'G'];
const CANONICAL_ROLES = new Set(HOME_ROLES);
const NO_OWNER_CONTRACT = Symbol('no-owner-contract');

function explicitRole(label) {
  const value = String(label ?? '').trim().toUpperCase();
  return CANONICAL_ROLES.has(value) ? value : null;
}

function sourceOwnerContract(phase) {
  const home = phase.pos ?? phase.our ?? {};
  const opponents = phase.opp ?? [];
  const authoredShot = (phase.arrows ?? []).some((arrow) => arrow.type === 'shot');
  if (authoredShot) return NO_OWNER_CONTRACT;

  if (Object.hasOwn(phase, 'ballOwner')) {
    if (!phase.ballOwner) return null;
    if (/^(US|OP)_(LW|C|RW|LD|RD|G)$/.test(phase.ballOwner)) return phase.ballOwner;
    if (CANONICAL_ROLES.has(phase.ballOwner)) return `US_${phase.ballOwner}`;
    const opponent = opponents.find((player) => player.id === phase.ballOwner);
    const role = explicitRole(opponent?.l ?? opponent?.label);
    return role ? `OP_${role}` : NO_OWNER_CONTRACT;
  }

  const homeRole = HOME_ROLES.find((role) => home[role]?.ball);
  if (homeRole) return `US_${homeRole}`;
  const opponent = opponents.find((player) => player.hasBall || player.ball);
  if (!opponent) return NO_OWNER_CONTRACT;
  const role = explicitRole(opponent.l ?? opponent.label);
  return role ? `OP_${role}` : NO_OWNER_CONTRACT;
}

function sourceTitle(phase) {
  return phase.t ?? phase.caption ?? '';
}

function catalogEntries() {
  const plays = PLAYS.map((play) => ({
    id: `play:${play.id}:won`,
    phases: play.phases,
    scene: getPlayScene(play.id, 'won'),
  }));
  const lostFaceoffs = PLAYS
    .filter((play) => play.faceoff)
    .map((play) => {
      const resolved = resolveFaceoffPlayOutcome(play, 'lost');
      return {
        id: `play:${play.id}:lost`,
        phases: resolved.phases,
        scene: getPlayScene(play.id, 'lost'),
      };
    });
  const strategies = TACTICS.flatMap((tactic) => ['mistake', 'correct'].map((variant) => ({
    id: `strategy:${tactic.id}:${variant}`,
    phases: (variant === 'mistake' ? tactic.mistakeScene : tactic.correctScene).phases,
    scene: getStrategyScene(tactic.id, variant),
  })));
  return [...plays, ...lostFaceoffs, ...strategies];
}

function sampleTimes(scene) {
  const anchors = scene.sourcePhaseTimes;
  const midpoints = anchors.slice(0, -1).map((time, index) => (
    (time + anchors[index + 1]) / 2
  ));
  return [...new Set([...anchors, ...midpoints, scene.duration])];
}

function projectRinkPoint(camera, position) {
  const world = rinkPositionToWorld(position);
  return new Vector3(world.x, 0, world.z).project(camera);
}

function overheadCamera(scene, frame) {
  const pose = productionCameraPose('overhead', {
    ball: frame.ball,
    ballPosition: {
      x: frame.ball.worldPosition[0],
      y: frame.ball.worldPosition[1],
      z: frame.ball.worldPosition[2],
    },
    compact: true,
    portrait: true,
    players: frame.players,
    playbackTime: frame.time,
    replay: scene,
  });
  const camera = new PerspectiveCamera(pose.fov, 390 / 844, 0.1, 180);
  camera.position.set(...pose.position);
  camera.lookAt(...pose.target);
  camera.updateMatrixWorld();
  return camera;
}

describe('2D, 3D, ball, role, and coaching parity', () => {
  const entries = catalogEntries();

  it('keeps every registered play and strategy on one sampled tactical frame', () => {
    expect(entries.length).toBe(PLAYS.length + PLAYS.filter((play) => play.faceoff).length + TACTICS.length * 2);

    entries.forEach(({ id, phases, scene }) => {
      expect(scene, id).toBeTruthy();
      expect(scene.players, id).toHaveLength(12);
      expect(scene.sourcePhaseTimes, id).toHaveLength(phases.length);

      sampleTimes(scene).forEach((time) => {
        const frame3d = sampleTacticalReplay(scene, time);
        const frame2d = playSceneToRinkPhase(scene, time);
        expect(frame2d.sceneFrame.engineId, `${id}@${time}`).toBe(TACTICAL_REPLAY_ENGINE_ID);

        frame3d.players.forEach((player) => {
          const rendered = player.team === 'us'
            ? frame2d.pos[player.role]
            : frame2d.opp.find((candidate) => candidate.id === player.id);
          expect(rendered, `${id}@${time}:${player.id}`).toBeTruthy();
          expect(rendered.x, `${id}@${time}:${player.id}:x`).toBeCloseTo(player.position.x, 6);
          expect(rendered.y, `${id}@${time}:${player.id}:y`).toBeCloseTo(player.position.y, 6);
        });

        expect(frame2d.ball.x, `${id}@${time}:ball-x`).toBeCloseTo(frame3d.ball.rinkPosition.x, 6);
        expect(frame2d.ball.y, `${id}@${time}:ball-y`).toBeCloseTo(frame3d.ball.rinkPosition.y, 6);

        const ownerMarkers = [
          ...HOME_ROLES
            .filter((role) => frame2d.pos[role]?.ball)
            .map((role) => `US_${role}`),
          ...frame2d.opp
            .filter((player) => player.hasBall)
            .map((player) => player.id),
        ];
        expect(ownerMarkers, `${id}@${time}:owner`).toEqual(
          frame3d.ball.ownerId ? [frame3d.ball.ownerId] : [],
        );

        const camera = overheadCamera(scene, frame3d);
        const visualLeft = projectRinkPoint(camera, { x: 20, y: 50 });
        const visualRight = projectRinkPoint(camera, { x: 80, y: 50 });
        expect(visualLeft.x, `${id}@${time}:left-right`).toBeLessThan(visualRight.x);
      });
    });
  });

  it('keeps authored phase ownership and cue titles aligned with generated scenes', () => {
    entries.forEach(({ id, phases, scene }) => {
      phases.forEach((phase, index) => {
        const anchor = scene.sourcePhaseTimes[index];
        const frame = sampleTacticalReplay(scene, anchor);
        const ownerContract = sourceOwnerContract(phase);
        if (scene.generatedFrom2d && ownerContract !== NO_OWNER_CONTRACT) {
          expect(frame.ball.ownerId, `${id}:phase-${index + 1}:owner`).toBe(ownerContract);
        }
        if (scene.generatedFrom2d) {
          expect(scene.events[index]?.label, `${id}:phase-${index + 1}:cue`)
            .toBe(sourceTitle(phase));
        }
      });
    });
  });

  it('renders the reported strong-side lock with their LD on rink-right in both views', () => {
    const scene = getPlayScene('trap');
    const anchor = scene.sourcePhaseTimes[1];
    const frame3d = sampleTacticalReplay(scene, anchor);
    const frame2d = playSceneToRinkPhase(scene, anchor);
    const owner3d = frame3d.players.find((player) => player.id === frame3d.ball.ownerId);
    const owner2d = frame2d.opp.find((player) => player.hasBall);

    expect(frame3d.ball.ownerId).toBe('OP_LD');
    expect(owner3d.role).toBe('LD');
    expect(owner2d).toMatchObject({ id: 'OP_LD', l: 'LD' });
    expect(owner3d.position.x).toBeGreaterThan(50);
    expect(owner2d.x).toBeCloseTo(owner3d.position.x, 6);

    const camera = overheadCamera(scene, frame3d);
    const projectedLd = new Vector3(...owner3d.worldPosition).project(camera);
    const opponentRd = frame3d.players.find((player) => player.id === 'OP_RD');
    const projectedRd = new Vector3(...opponentRd.worldPosition).project(camera);
    expect(projectedLd.x).toBeGreaterThan(projectedRd.x);
  });
});
