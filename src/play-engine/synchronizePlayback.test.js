import { describe, expect, it } from 'vitest';
import { getPlayScene } from './sceneRegistry';
import {
  createSynchronizedPlayback,
  scenePhaseForTime,
  sceneTimeForPhase,
  synchronizedPlaybackReducer,
} from './synchronizePlayback';

const scene = getPlayScene('brk');
const phaseCount = 2;

describe('synchronized playback', () => {
  it('maps authored 2D phases onto the canonical scene clock', () => {
    expect(sceneTimeForPhase(scene, 0, phaseCount)).toBe(0);
    expect(sceneTimeForPhase(scene, 1, phaseCount)).toBe(2.45);
    expect(scenePhaseForTime(scene, 2.44, phaseCount)).toBe(0);
    expect(scenePhaseForTime(scene, 4.6, phaseCount)).toBe(1);
  });

  it('uses exact scene time as the source of truth when a shared link provides it', () => {
    expect(createSynchronizedPlayback({
      scene,
      phaseCount,
      requestedPhase: 0,
      requestedTime: 4.6,
    })).toEqual({ phase: 1, time: 4.6 });
  });

  it('keeps phase and time synchronized in both directions', () => {
    const atPhase = synchronizedPlaybackReducer({ phase: 0, time: 0 }, {
      type: 'phase',
      value: 1,
      scene,
      phaseCount,
    });
    expect(atPhase).toEqual({ phase: 1, time: 2.45 });

    const atTime = synchronizedPlaybackReducer(atPhase, {
      type: 'time',
      value: 0.8,
      scene,
      phaseCount,
    });
    expect(atTime).toEqual({ phase: 0, time: 0.8 });
  });
});
