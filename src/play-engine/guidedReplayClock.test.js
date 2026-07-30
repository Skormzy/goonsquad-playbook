import { describe, expect, it } from 'vitest';
import {
  advanceGuidedReplay,
  createGuidedReplayState,
  GUIDED_READ_MAX_SECONDS,
  GUIDED_READ_MIN_SECONDS,
  guidedReadSeconds,
} from './guidedReplayClock';

const scene = {
  duration: 9,
  sourcePhaseTimes: [0, 3, 6],
  events: [
    { label: 'Set the shape' },
    { label: 'Pressure the ball side' },
    { label: 'Close the middle lane' },
  ],
  teachingPoints: [
    'Read where the opponent starts.',
    'The winger goes first while everyone shifts.',
    'Protect the middle and finish the recovery.',
  ],
};

describe('guided replay clock', () => {
  it('holds a phase still long enough to read before movement starts', () => {
    const initial = createGuidedReplayState(scene, 0);
    expect(initial.mode).toBe('read');
    expect(initial.time).toBe(0);
    expect(initial.holdRemaining).toBeGreaterThanOrEqual(GUIDED_READ_MIN_SECONDS);

    const held = advanceGuidedReplay(initial, {
      scene,
      deltaSeconds: initial.holdRemaining - 0.1,
      speed: 1,
    });
    expect(held.mode).toBe('read');
    expect(held.time).toBe(0);
  });

  it('moves after the reading hold and applies speed only to movement', () => {
    const initial = createGuidedReplayState(scene, 0);
    const moving = advanceGuidedReplay(initial, {
      scene,
      deltaSeconds: initial.holdRemaining + 1,
      speed: 0.5,
    });
    expect(moving.mode).toBe('watch');
    expect(moving.time).toBeCloseTo(0.5);
  });

  it('stops exactly on every new teaching phase instead of skipping through it', () => {
    const moving = createGuidedReplayState(scene, 1.5);
    expect(moving.mode).toBe('watch');

    const arrived = advanceGuidedReplay(moving, {
      scene,
      deltaSeconds: 20,
      speed: 1,
    });
    expect(arrived).toMatchObject({
      mode: 'read',
      phaseIndex: 1,
      time: 3,
      heldAnchorIndex: 1,
    });
    expect(arrived.holdRemaining).toBeGreaterThanOrEqual(GUIDED_READ_MIN_SECONDS);
  });

  it('resumes from an arbitrary scrubbed time without replaying an earlier hold', () => {
    const scrubbed = createGuidedReplayState(scene, 4);
    expect(scrubbed).toMatchObject({
      mode: 'watch',
      phaseIndex: 1,
      time: 4,
    });

    const advanced = advanceGuidedReplay(scrubbed, {
      scene,
      deltaSeconds: 1,
      speed: 1,
    });
    expect(advanced.time).toBe(5);
  });

  it('bounds adaptive reading time for short and long coaching copy', () => {
    expect(guidedReadSeconds({
      ...scene,
      events: [{ label: 'Go' }],
      teachingPoints: ['Now'],
    }, 0)).toBe(GUIDED_READ_MIN_SECONDS);
    expect(guidedReadSeconds({
      ...scene,
      events: [{ label: 'A '.repeat(100) }],
      teachingPoints: ['B '.repeat(100)],
    }, 0)).toBe(GUIDED_READ_MAX_SECONDS);
  });
});
