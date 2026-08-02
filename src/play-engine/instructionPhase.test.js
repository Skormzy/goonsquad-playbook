import { describe, expect, it } from 'vitest';
import {
  INSTRUCTION_PHASE_EPSILON_SECONDS,
  resolveInstructionPhase,
} from './instructionPhase';

const scene = {
  duration: 8,
  sourcePhaseTimes: [0, 2, 5, 8],
};

describe('instruction phase', () => {
  it('keeps the arrived phase authoritative while the replay is held on its anchor', () => {
    expect(resolveInstructionPhase({
      currentPhase: 1,
      phaseCount: 4,
      playbackTime: 2,
      scene,
    })).toBe(1);
  });

  it('switches to the destination phase on the first movement frame', () => {
    expect(resolveInstructionPhase({
      currentPhase: 1,
      phaseCount: 4,
      playbackTime: 2 + INSTRUCTION_PHASE_EPSILON_SECONDS * 2,
      scene,
    })).toBe(2);
  });

  it('publishes a manual forward destination before its interpolation lands', () => {
    expect(resolveInstructionPhase({
      currentPhase: 0,
      phaseTransitionTarget: 2,
      phaseCount: 4,
      playbackTime: 0.25,
      scene,
    })).toBe(2);
  });

  it('publishes a manual backward destination before its interpolation lands', () => {
    expect(resolveInstructionPhase({
      currentPhase: 2,
      phaseTransitionTarget: 1,
      phaseCount: 4,
      playbackTime: 4.5,
      scene,
    })).toBe(1);
  });

  it('never advances beyond the final authored phase', () => {
    expect(resolveInstructionPhase({
      currentPhase: 3,
      phaseCount: 4,
      playbackTime: 8,
      scene,
    })).toBe(3);
  });

  it('falls back to the rendered phase when no replay scene exists', () => {
    expect(resolveInstructionPhase({
      currentPhase: 1,
      phaseCount: 3,
      playbackTime: 1.5,
    })).toBe(1);
  });
});
