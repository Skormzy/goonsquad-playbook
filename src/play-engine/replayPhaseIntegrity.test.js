import { describe, expect, it } from 'vitest';
import { sampleTacticalReplay } from '../tactical3d/sampleTacticalReplay';
import {
  getRegisteredFaceoffOutcomeScenes,
  getRegisteredPlayScenes,
  getRegisteredStrategyScenes,
} from './sceneRegistry';
import {
  scenePhaseForTime,
  sceneTimeForPhase,
} from './synchronizePlayback';

const EPSILON = 0.001;
const MEANINGFUL_RINK_MOVEMENT = 0.2;

function catalogScenes() {
  const lostFaceoffs = getRegisteredFaceoffOutcomeScenes().filter((scene) => (
    scene.presentation?.faceoff?.outcome === 'lost'
  ));
  return [
    ...getRegisteredPlayScenes(),
    ...lostFaceoffs,
    ...getRegisteredStrategyScenes(),
  ];
}

function rinkDistance(left, right) {
  return Math.hypot(
    Number(right?.x ?? 0) - Number(left?.x ?? 0),
    Number(right?.y ?? 0) - Number(left?.y ?? 0),
  );
}

function transitionMovement(scene, fromTime, toTime) {
  const from = sampleTacticalReplay(scene, fromTime);
  const to = sampleTacticalReplay(scene, toTime);
  const fromPlayers = new Map(from.players.map((player) => [player.id, player]));
  const playerMovement = to.players.reduce((maximum, player) => {
    if (player.active === false) return maximum;
    const previous = fromPlayers.get(player.id);
    return Math.max(maximum, rinkDistance(previous?.position, player.position));
  }, 0);

  return Math.max(
    playerMovement,
    rinkDistance(from.ball.rinkPosition, to.ball.rinkPosition),
  );
}

describe('catalog-wide replay phase integrity', () => {
  const scenes = catalogScenes();

  it('makes every final authored phase the actual end of its lesson', () => {
    scenes.forEach((scene) => {
      const anchors = scene.sourcePhaseTimes;
      expect(anchors.length, `${scene.id}:phase-count`).toBeGreaterThan(1);
      expect(anchors[0], `${scene.id}:first-phase`).toBe(0);
      if (scene.generatedFrom2d) {
        expect(anchors.at(-1), `${scene.id}:hidden-final-tail`).toBeCloseTo(scene.duration, 3);
      } else {
        const lastEventTime = Math.max(...scene.events.map((event) => event.time));
        expect(lastEventTime, `${scene.id}:custom-final-cue`).toBeGreaterThan(anchors.at(-1));
        expect(scene.duration - lastEventTime, `${scene.id}:custom-cue-tail`).toBeLessThanOrEqual(0.75);
        expect(
          transitionMovement(scene, anchors.at(-1), scene.duration),
          `${scene.id}:custom-final-phase-action`,
        ).toBeGreaterThanOrEqual(MEANINGFUL_RINK_MOVEMENT);
      }

      anchors.forEach((anchor, index) => {
        expect(Number.isFinite(anchor), `${scene.id}:phase-${index + 1}:finite`).toBe(true);
        if (index > 0) {
          expect(
            anchor - anchors[index - 1],
            `${scene.id}:phase-${index + 1}:strictly-increasing`,
          ).toBeGreaterThan(EPSILON);
        }
        expect(
          sceneTimeForPhase(scene, index, anchors.length),
          `${scene.id}:phase-${index + 1}:time`,
        ).toBeCloseTo(anchor, 3);
        expect(
          scenePhaseForTime(scene, anchor, anchors.length),
          `${scene.id}:phase-${index + 1}:index`,
        ).toBe(index);
      });
    });
  });

  it('keeps every phase transition visible and tactically meaningful', () => {
    scenes.forEach((scene) => {
      scene.sourcePhaseTimes.slice(0, -1).forEach((fromTime, index) => {
        const toTime = scene.sourcePhaseTimes[index + 1];
        expect(
          transitionMovement(scene, fromTime, toTime),
          `${scene.id}:phase-${index + 1}-to-${index + 2}:movement`,
        ).toBeGreaterThanOrEqual(MEANINGFUL_RINK_MOVEMENT);
      });
    });
  });

  it('keeps player and ball timelines finite, ordered, and complete', () => {
    scenes.forEach((scene) => {
      scene.players.forEach((player) => {
        expect(player.keyframes[0]?.time, `${scene.id}:${player.id}:starts-at-zero`).toBe(0);
        expect(
          player.keyframes.at(-1)?.time,
          `${scene.id}:${player.id}:ends-with-scene`,
        ).toBeCloseTo(scene.duration, 3);
        player.keyframes.forEach((keyframe, index) => {
          expect(Number.isFinite(keyframe.time), `${scene.id}:${player.id}:time-${index}`).toBe(true);
          expect(Number.isFinite(keyframe.position?.x), `${scene.id}:${player.id}:x-${index}`).toBe(true);
          expect(Number.isFinite(keyframe.position?.y), `${scene.id}:${player.id}:y-${index}`).toBe(true);
          if (index > 0) {
            expect(
              keyframe.time - player.keyframes[index - 1].time,
              `${scene.id}:${player.id}:ordered-${index}`,
            ).toBeGreaterThan(EPSILON);
          }
        });
      });

      const segments = scene.ball.segments;
      expect(segments.length, `${scene.id}:ball-segments`).toBeGreaterThan(0);
      expect(segments[0].from, `${scene.id}:ball-start`).toBeCloseTo(0, 3);
      expect(segments.at(-1).to, `${scene.id}:ball-end`).toBeCloseTo(scene.duration, 3);
      segments.forEach((segment, index) => {
        expect(segment.to - segment.from, `${scene.id}:ball-segment-${index}:duration`)
          .toBeGreaterThan(EPSILON);
        if (index > 0) {
          expect(segment.from, `${scene.id}:ball-segment-${index}:continuity`)
            .toBeCloseTo(segments[index - 1].to, 3);
        }
      });
    });
  });
});
