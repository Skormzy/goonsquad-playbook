import { describe, expect, it } from 'vitest';
import {
  advanceGuidedReplay,
  createGuidedReplayState,
  GUIDED_PHASE_HOLD_SECONDS,
  guidedReadSeconds,
} from './guidedReplayClock';

const scene = {
  duration: 6,
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
  it('uses a fixed two-second hold when a teaching phase is reached automatically', () => {
    const initial = createGuidedReplayState(scene, 0);
    expect(initial.mode).toBe('read');
    expect(initial.time).toBe(0);
    expect(initial.holdRemaining).toBe(GUIDED_PHASE_HOLD_SECONDS);

    const held = advanceGuidedReplay(initial, {
      scene,
      deltaSeconds: initial.holdRemaining - 0.1,
      speed: 1,
    });
    expect(held.mode).toBe('read');
    expect(held.time).toBe(0);
  });

  it('starts movement immediately when the user has explicitly pressed play', () => {
    const initial = createGuidedReplayState(scene, 0, { skipCurrentHold: true });
    expect(initial).toMatchObject({
      mode: 'watch',
      time: 0,
      holdRemaining: 0,
      heldAnchorIndex: 0,
    });

    const moving = advanceGuidedReplay(initial, {
      scene,
      deltaSeconds: 0.25,
      speed: 1,
    });
    expect(moving.mode).toBe('watch');
    expect(moving.time).toBeCloseTo(0.25);
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
    expect(arrived.holdRemaining).toBe(GUIDED_PHASE_HOLD_SECONDS);
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

  it('treats the final authored phase as the completed lesson endpoint', () => {
    expect(createGuidedReplayState(scene, 6)).toMatchObject({
      mode: 'complete',
      phaseIndex: 2,
      time: 6,
    });
  });

  it('keeps every automatic phase handoff at the same concise cadence', () => {
    expect(guidedReadSeconds({
      ...scene,
      events: [{ label: 'Go' }],
      teachingPoints: ['Now'],
    }, 0)).toBe(GUIDED_PHASE_HOLD_SECONDS);
    expect(guidedReadSeconds({
      ...scene,
      events: [{ label: 'A '.repeat(100) }],
      teachingPoints: ['B '.repeat(100)],
    }, 0)).toBe(GUIDED_PHASE_HOLD_SECONDS);
  });
});
