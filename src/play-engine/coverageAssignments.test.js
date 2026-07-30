import { describe, expect, it } from 'vitest';
import { CORE_PLAYS, CORE_TACTICS } from '../data/coreCatalog';
import { getPlayScene, getStrategyScene } from './sceneRegistry';
import {
  contextualCoverageForReplay,
  coverageAssignmentsForReplay,
  hasCoverageAssignments,
} from './coverageAssignments';

function countAssignments(coverage) {
  return Object.values(coverage ?? {}).filter(Boolean).length;
}

describe('contextual 2D coverage assignments', () => {
  it('compiles every authored play assignment into stable runtime player IDs', () => {
    CORE_PLAYS.forEach((play) => {
      const scene = getPlayScene(play.id);
      play.phases.forEach((phase, index) => {
        const runtimeCoverage = coverageAssignmentsForReplay(
          scene,
          scene.sourcePhaseTimes[index],
        );
        expect(
          countAssignments(runtimeCoverage),
          `${play.id}:phase-${index + 1}`,
        ).toBe(countAssignments(phase.coverage));
      });
    });
  });

  it('uses scene coverage as the strategy default while respecting explicit phase clears', () => {
    CORE_TACTICS.forEach((tactic) => {
      ['mistake', 'correct'].forEach((variant) => {
        const sourceScene = variant === 'mistake' ? tactic.mistakeScene : tactic.correctScene;
        const replay = getStrategyScene(tactic.id, variant);

        sourceScene.phases.forEach((phase, index) => {
          const authoredCoverage = phase.coverage ?? sourceScene.coverage;
          const runtimeCoverage = coverageAssignmentsForReplay(
            replay,
            replay.sourcePhaseTimes[index],
          );
          expect(
            countAssignments(runtimeCoverage),
            `${tactic.id}:${variant}:phase-${index + 1}`,
          ).toBe(countAssignments(authoredCoverage));
        });
      });
    });
  });

  it('shows authored assignments automatically only in the defensive curriculum', () => {
    CORE_PLAYS.forEach((play) => {
      const replay = getPlayScene(play.id);
      replay.sourcePhaseTimes.forEach((time, index) => {
        const available = coverageAssignmentsForReplay(replay, time);
        const visible = contextualCoverageForReplay({
          enabled: true,
          lane: play.lane,
          replay,
          time,
        });

        if (play.lane === 'offence') {
          expect(visible, `${play.id}:phase-${index + 1}`).toBeNull();
        } else {
          expect(
            hasCoverageAssignments(visible),
            `${play.id}:phase-${index + 1}`,
          ).toBe(hasCoverageAssignments(available));
        }
      });
    });
  });

  it('clears assignments when the strong-side lock wins possession', () => {
    const replay = getPlayScene('trap');
    expect(
      countAssignments(coverageAssignmentsForReplay(replay, replay.sourcePhaseTimes[3])),
    ).toBe(5);
    expect(
      coverageAssignmentsForReplay(replay, replay.sourcePhaseTimes[4]),
    ).toBeNull();
  });

  it('mirrors home-role ownership without changing opponent identity', () => {
    const replay = getPlayScene('trap');
    const time = replay.sourcePhaseTimes[1];
    const normal = coverageAssignmentsForReplay(replay, time);
    const mirrored = coverageAssignmentsForReplay(replay, time, { mirrored: true });

    expect(normal).toMatchObject({
      RW: 'OP_LD',
      LW: 'OP_RD',
      RD: 'OP_LW',
      LD: 'OP_RW',
    });
    expect(mirrored).toMatchObject({
      LW: 'OP_LD',
      RW: 'OP_RD',
      LD: 'OP_LW',
      RD: 'OP_RW',
    });
  });

  it('honors a user override without inventing assignments', () => {
    const replay = getPlayScene('nfd');
    expect(contextualCoverageForReplay({
      enabled: false,
      lane: 'defence',
      replay,
      time: replay.sourcePhaseTimes[0],
    })).toBeNull();
    expect(contextualCoverageForReplay({
      enabled: true,
      lane: 'defence',
      replay: getPlayScene('pkb'),
      time: 0,
    })).toBeNull();
  });
});
