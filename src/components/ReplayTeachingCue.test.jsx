import { describe, expect, it } from 'vitest';
import { replayTeachingStage } from '../play-engine/replayTeachingStage';

const scene = { duration: 8, phaseTimes: [0, 4] };

describe('ReplayTeachingCue', () => {
  it('labels manual phase travel as a movement to watch', () => {
    expect(replayTeachingStage({
      currentPhase: 0,
      isPlaying: false,
      isTransitioning: true,
      phaseCount: 2,
      playbackTime: 1,
      scene,
    })).toBe('watch');
  });

  it('returns to a ready cue after manual phase travel lands', () => {
    expect(replayTeachingStage({
      currentPhase: 1,
      isPlaying: false,
      isTransitioning: false,
      phaseCount: 2,
      playbackTime: 4,
      scene,
    })).toBe('ready');
  });

  it('keeps the watch cue active until a transition fully lands', () => {
    expect(replayTeachingStage({
      currentPhase: 1,
      isPlaying: false,
      isTransitioning: true,
      phaseCount: 2,
      playbackTime: 7.99,
      scene,
    })).toBe('watch');
  });
});
