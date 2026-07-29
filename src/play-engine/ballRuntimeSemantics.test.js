import { describe, expect, it } from 'vitest';
import { PLAYS } from '../data/plays';
import { OPEN_SLOT_PLAY } from '../data/strategyFirstPlays';
import { TACTICS } from '../data/tactics';
import { calculateBoardBounce } from './boardBounce';
import {
  compilePlayThreeDScene,
  compileStrategyThreeDScene,
} from './compileThreeDScene';
import { rinkDistanceMeters } from './movementMetrics';
import {
  samplePlayerKeyframes,
  samplePlayScene,
} from './samplePlayScene';

function play(id) {
  return PLAYS.find((candidate) => candidate.id === id);
}

function tactic(id) {
  return TACTICS.find((candidate) => candidate.id === id);
}

function segmentScene(segment) {
  return {
    duration: segment.to,
    players: [],
    ball: { segments: [segment] },
    events: [],
  };
}

describe('ball runtime semantics', () => {
  it.each(['pass', 'shot', 'faceoff'])(
    'samples a generic %s by physical distance and reports its active-leg velocity',
    (type) => {
      const segment = {
        type,
        from: 0,
        to: 2,
        start: { x: 0, y: 0 },
        end: { x: 100, y: 100 },
        path: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 100 },
        ],
      };
      const frame = samplePlayScene(segmentScene(segment), 1);

      expect(frame.ball.position).toEqual({ x: 100, y: 25 });
      expect(frame.ball.velocity).toEqual({ x: 0, y: 75 });
      expect(frame.ball.path).toEqual(segment.path);
    },
  );

  it('preserves board-pass impact timing and rebound sampling', () => {
    const segment = {
      type: 'board-pass',
      from: 0,
      to: 2,
      start: { x: 24, y: 22 },
      end: { x: 29, y: 42 },
      incoming: { x: 24, y: 22 },
      impact: { x: 4, y: 30 },
      exitTarget: { x: 29, y: 42 },
      restitution: 0.74,
    };
    const bounce = calculateBoardBounce(segment);
    const frame = samplePlayScene(segmentScene(segment), bounce.impactT * 2);

    expect(bounce.validPhysics).toBe(true);
    expect(frame.ball.position).toMatchObject({ x: 4, y: 30 });
    expect(frame.ball.path).toEqual([
      segment.incoming,
      segment.impact,
      segment.exitTarget,
    ]);
    expect(frame.ball.board).toBe('left');
  });

  it('anchors every low-cycle release to the moving passer and joins its carry exactly', () => {
    const scene = compilePlayThreeDScene(play('lcl'));
    const releases = scene.ball.segments
      .map((segment, index) => ({ segment, index }))
      .filter(({ segment }) => segment.fromPlayerId);

    expect(releases.length).toBeGreaterThan(0);
    releases.forEach(({ segment, index }) => {
      const passer = scene.players.find((player) => player.id === segment.fromPlayerId);
      const releasePosition = samplePlayerKeyframes(
        passer.keyframes,
        segment.from,
      ).position;
      expect(
        rinkDistanceMeters(segment.start, releasePosition),
        `${segment.type} release at ${segment.from}s`,
      ).toBeLessThan(0.01);

      const prior = scene.ball.segments[index - 1];
      if (prior?.type === 'carry' && prior.ownerId === segment.fromPlayerId) {
        expect(prior.end).toEqual(segment.start);
      }
    });
  });

  it('compiles a cross-team change as an interception and blends both contacts', () => {
    const scene = compileStrategyThreeDScene(tactic('defensive-box-pk'), 'correct');
    const interception = scene.ball.segments.find((segment) => (
      segment.transitionType === 'interception'
    ));

    expect(interception).toMatchObject({
      type: 'loose',
      fromPlayerId: expect.stringMatching(/^OP_/),
      toPlayerId: expect.stringMatching(/^US_/),
      transitionType: 'interception',
    });
    expect(scene.ball.segments.some((segment) => (
      segment.type === 'pass'
      && segment.fromPlayerId?.startsWith('OP_')
      && segment.toPlayerId?.startsWith('US_')
    ))).toBe(false);

    const release = samplePlayScene(scene, interception.from + 0.001);
    const receive = samplePlayScene(scene, interception.to - 0.001);
    expect(release.ball).toMatchObject({
      segmentType: 'loose',
      stickContact: 'release',
      stickTargetPlayerId: interception.fromPlayerId,
    });
    expect(receive.ball).toMatchObject({
      ownerId: interception.toPlayerId,
      stickContact: 'receive',
      stickTargetPlayerId: interception.toPlayerId,
      transitionType: 'interception',
    });
  });

  it('does not infer a net-front-defense shot from goal proximity alone', () => {
    const scene = compilePlayThreeDScene(play('nfd'));

    expect(scene.ball.segments.some((segment) => segment.type === 'shot')).toBe(false);
    expect(scene.ball.segments.every((segment) => (
      segment.ownerId === 'OP_RW' || segment.fromPlayerId === 'OP_RW'
    ))).toBe(true);
  });

  it.each(['btn', 'pts', 'ppum'])(
    'retains the explicitly authored terminal shot for %s',
    (playId) => {
      const scene = compilePlayThreeDScene(play(playId));
      expect(scene.ball.segments.some((segment) => segment.type === 'shot')).toBe(true);
    },
  );

  it('keeps the two audited lanes open and removes stale terminal possession flags', () => {
    const slotDefender = OPEN_SLOT_PLAY.phases[2].opp.find((player) => player.id === 'o2');
    const cyclePhase = tactic('cycling-the-boards').correctScene.phases[2];
    const cycleDefender = cyclePhase.opp.find((player) => player.id === 'o1');
    const stalePkOwner = tactic('defensive-box-pk')
      .mistakeScene.phases.at(-1).opp.find((player) => player.id === 'o5');
    const staleCommunicationOwner = tactic('communication-defense')
      .correctScene.phases.at(-1).opp.find((player) => player.id === 'o1');

    expect(slotDefender).toMatchObject({ x: 12, y: 86 });
    expect(cycleDefender).toMatchObject({ x: 25, y: 82 });
    expect(stalePkOwner).not.toHaveProperty('hasBall');
    expect(staleCommunicationOwner).not.toHaveProperty('hasBall');
  });
});
