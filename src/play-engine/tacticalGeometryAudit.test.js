import { describe, expect, it } from 'vitest';
import { PLAYS } from '../data/plays';
import { TACTICS } from '../data/tactics';
import { PRIMARY_DEFENSIVE_PLAY } from '../data/strategyFirstPlays';
import { createPlaymakerDraft, PLAYMAKER_TEMPLATES } from '../playmaker/playmakerModel';
import { rinkDistanceMeters } from './movementMetrics';
import { compilePlayThreeDScene, compileStrategyThreeDScene } from './compileThreeDScene';
import { samplePlayScene } from './samplePlayScene';
import {
  auditDefensiveCarrierContainment,
  auditPrimaryPassingLanes,
  auditTacticalCatalog,
} from './tacticalGeometryAudit';

const HOME_ROLES = ['LW', 'C', 'RW', 'LD', 'RD', 'G'];

function roundedPoint(point) {
  return [Number(point.x.toFixed(4)), Number(point.y.toFixed(4))];
}

function sortedPoints(points) {
  return points.map(roundedPoint).sort((left, right) => (
    left[0] - right[0] || left[1] - right[1]
  ));
}

function expectCompiledPhaseParity(scene, sourcePhases, homeKey) {
  sourcePhases.forEach((sourcePhase, phaseIndex) => {
    const frame = samplePlayScene(scene, scene.sourcePhaseTimes[phaseIndex]);

    HOME_ROLES.forEach((role) => {
      const compiled = frame.players.find((player) => player.id === `US_${role}`);
      const authored = sourcePhase[homeKey][role];
      if (!authored || authored.inactive || authored.status === 'penalty-box') return;
      expect(
        roundedPoint(compiled.position),
        `${scene.id} phase ${phaseIndex + 1} US_${role}`,
      ).toEqual(roundedPoint(authored));
    });

    const authoredOpponents = (sourcePhase.opp ?? [])
      .filter((player) => !player.inactive && player.status !== 'penalty-box');
    const compiledOpponents = frame.players
      .filter((player) => player.team === 'opponent' && player.active !== false);

    expect(
      sortedPoints(compiledOpponents.map((player) => player.position)),
      `${scene.id} phase ${phaseIndex + 1} opponent geometry`,
    ).toEqual(sortedPoints(authoredOpponents));
  });
}

describe('catalog-wide tactical geometry', () => {
  it('keeps every phase complete, spaced, role-stable, and tactically clear', () => {
    expect(auditTacticalCatalog(PLAYS, TACTICS)).toEqual([]);
  });

  it('rejects a primary pass lane that runs through a defender', () => {
    expect(auditPrimaryPassingLanes([{
      pos: {
        LW: { x: 10, y: 50 },
        C: { x: 70, y: 50 },
      },
      opp: [
        { id: 'op-c', l: 'C', x: 40, y: 50 },
      ],
      lanes: [
        { f: 'LW', t: 'C', ty: 'primary' },
      ],
    }], 'test play')).toEqual([
      'test play phase 1: LW to C primary lane is blocked by op-c at 0.00m',
    ]);
  });

  it('rejects defensive pressure that leaves the forward or middle lane open', () => {
    expect(auditDefensiveCarrierContainment([{
      pos: {
        RW: { x: 81, y: 55 },
      },
      opp: [
        { id: 'op-ld', l: 'LD', x: 78, y: 56, hasBall: true },
      ],
      coverage: { RW: 'op-ld' },
    }], 'test play')).toEqual([
      'test play phase 1: RW gives op-ld the forward lane with only 0.48m of goal-side leverage',
      'test play phase 1: RW is outside op-ld instead of protecting the middle',
    ]);
  });

  it('uses the same mirrored opponent orientation in every Create template', () => {
    PLAYMAKER_TEMPLATES.forEach(({ id }) => {
      const players = createPlaymakerDraft(id).frames[0].players;
      expect(players.OP_RW.x, `${id} opponent wings`).toBeLessThan(players.OP_LW.x);
      expect(players.OP_RD.x, `${id} opponent defense`).toBeLessThan(players.OP_LD.x);
    });
  });

  it('closes the boards from inside and goal-side before both strong-side reversals', () => {
    const rightPressure = PRIMARY_DEFENSIVE_PLAY.phases[1];
    const rightPoint = rightPressure.opp.find(
      (player) => player.id === rightPressure.ballOwner,
    );
    expect(rightPoint.l).toBe('LD');
    expect(rightPressure.pos.RW.x).toBeLessThan(rightPoint.x);
    expect(rightPressure.pos.RW.y).toBeLessThanOrEqual(rightPoint.y - 4);
    expect(rinkDistanceMeters(rightPressure.pos.RW, rightPoint))
      .toBeGreaterThanOrEqual(2);
    expect(rinkDistanceMeters(rightPressure.pos.RW, rightPoint))
      .toBeLessThanOrEqual(3);

    const rightLock = PRIMARY_DEFENSIVE_PLAY.phases[2];
    const rightCarrier = rightLock.opp.find((player) => player.id === rightLock.ballOwner);
    expect(rightCarrier.l).toBe('LW');
    expect(rightLock.pos.RW.x).toBeLessThan(rightCarrier.x);
    expect(rightLock.pos.RW.y).toBeLessThan(rightCarrier.y);
    expect(rinkDistanceMeters(rightLock.pos.RW, rightCarrier)).toBeGreaterThanOrEqual(2);
    expect(rinkDistanceMeters(rightLock.pos.RW, rightCarrier)).toBeLessThanOrEqual(3.2);
    expect(rightLock.pos.C.y).toBeLessThan(rightCarrier.y);
    expect(rightLock.pos.LW.y).toBeLessThan(rightCarrier.y);
    expect(Math.abs(rightLock.pos.RD.x - rightLock.pos.LD.x)).toBeLessThanOrEqual(22);

    const leftLock = PRIMARY_DEFENSIVE_PLAY.phases[3];
    const leftCarrier = leftLock.opp.find((player) => player.id === leftLock.ballOwner);
    expect(leftCarrier.l).toBe('RD');
    expect(leftLock.pos.LW.x).toBeGreaterThan(leftCarrier.x);
    expect(leftLock.pos.LW.y).toBeLessThan(leftCarrier.y);
    expect(rinkDistanceMeters(leftLock.pos.LW, leftCarrier)).toBeGreaterThanOrEqual(2);
    expect(rinkDistanceMeters(leftLock.pos.LW, leftCarrier)).toBeLessThanOrEqual(3.2);
    expect(leftLock.pos.C.y).toBeLessThan(leftCarrier.y);
    expect(leftLock.pos.RW.y).toBeLessThan(leftCarrier.y);
    expect(Math.abs(leftLock.pos.RD.x - leftLock.pos.LD.x)).toBeLessThanOrEqual(25);
  });

  it('keeps every authored player coordinate identical at the matching 2D and 3D phase', () => {
    PLAYS.forEach((play) => {
      expectCompiledPhaseParity(compilePlayThreeDScene(play), play.phases, 'pos');
    });

    TACTICS.forEach((tactic) => {
      for (const variant of ['mistake', 'correct']) {
        const phases = tactic[`${variant}Scene`].phases;
        expectCompiledPhaseParity(
          compileStrategyThreeDScene(tactic, variant),
          phases,
          'our',
        );
      }
    });
  });
});
