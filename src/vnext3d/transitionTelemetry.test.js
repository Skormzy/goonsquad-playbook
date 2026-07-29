import { describe, expect, it } from 'vitest';
import {
  dedupeTransitionEvents,
  parseTransitionTelemetryWindow,
  parsePrivateMotionTuning,
  summarizeTransitionTelemetry,
  transitionEventsForWindow,
} from './transitionTelemetry';

describe('deterministic production motion transition telemetry', () => {
  it('keeps tuning private while allowing the planted-shoe review candidate', () => {
    expect(parsePrivateMotionTuning(new URLSearchParams([
      ['motionSprintPhaseOffset', '0.609'],
    ]), 'cmu-jog16-ik')).toEqual({ sprintPhaseOffset: 0.609 });
    expect(parsePrivateMotionTuning(new URLSearchParams([
      ['motionSprintPhaseOffset', '0.609'],
    ]), 'cmu-jog16-ik-pbr')).toEqual({ sprintPhaseOffset: 0.609 });
  });
  it('parses a bounded private replay window', () => {
    const window = parseTransitionTelemetryWindow(new URLSearchParams(
      'motionWindowStart=1.35&motionWindowEnd=1.95&motionWindowPlayer=US_LD',
    ));

    expect(window).toEqual({
      key: '1.35:1.95:US_LD',
      start: 1.35,
      end: 1.95,
      playerId: 'US_LD',
    });
    expect(parseTransitionTelemetryWindow(new URLSearchParams('motionWindowStart=1&motionWindowEnd=4')))
      .toBeNull();
  });

  it('keeps phase tuning inside the private Subject 16 review', () => {
    const params = new URLSearchParams('motionSprintPhaseOffset=0.609');
    expect(parsePrivateMotionTuning(params, 'cmu-jog16')).toEqual({ sprintPhaseOffset: 0.609 });
    expect(parsePrivateMotionTuning(
      new URLSearchParams('motionSprintPhaseOffset=0.609&motionBlendSeconds=0.32'),
      'cmu-jog16',
    )).toEqual({ sprintPhaseOffset: 0.609, blendSeconds: 0.32 });
    expect(parsePrivateMotionTuning(params, null)).toBeNull();
    expect(parsePrivateMotionTuning(new URLSearchParams('motionSprintPhaseOffset=2'), 'cmu-jog16'))
      .toBeNull();
    expect(parsePrivateMotionTuning(new URLSearchParams('motionBlendSeconds=0.1'), 'cmu-jog16'))
      .toBeNull();
  });

  it('keeps mixer events inside the selected replay window', () => {
    const result = transitionEventsForWindow([
      { playerId: 'US_LD', from: 'jog', to: 'sprint', replayTime: 1.603 },
      { playerId: 'US_RD', from: 'jog', to: 'sprint', replayTime: 1.7 },
      { playerId: 'US_LD', from: 'sprint', to: 'pass', replayTime: 2.45 },
    ], { start: 1.35, end: 1.95, playerId: 'US_LD' });

    expect(result).toEqual([{
      playerId: 'US_LD',
      from: 'jog',
      to: 'sprint',
      replayTime: 1.603,
    }]);
  });

  it('deduplicates development effect replays without merging real boundaries', () => {
    expect(dedupeTransitionEvents([
      { playerId: 'US_LD', from: 'jog', to: 'sprint', replayTime: 1.602 },
      { playerId: 'US_LD', from: 'jog', to: 'sprint', replayTime: 1.61 },
      { playerId: 'US_LD', from: 'sprint', to: 'pass', replayTime: 2.45 },
    ])).toHaveLength(2);
  });

  it('combines the fixed replay window into one review result', () => {
    const summary = summarizeTransitionTelemetry({
      window: { key: '1.35:1.95:US_LD', start: 1.35, end: 1.95, playerId: 'US_LD' },
      frameIntervals: [16, 17, 18],
      footSlideSamples: [4, 7, 12],
      footMotionSamples: [8, 12, 24],
      authoredContactSampleCount: 4,
      authoredPlantedContactSampleCount: 3,
      authoredFootSlideSamples: [0.4, 0.8],
      authoredClearanceSamples: [4, 8, 12, 18],
      authoredOppositeClearanceSamples: [6, 10, 22],
      clipTransitions: [{
        playerId: 'US_LD', from: 'jog', to: 'sprint', replayTime: 1.6,
      }],
      groundContacts: [{ minimumY: 0.003, correction: 0.008, shoeCount: 2 }],
    });

    expect(summary).toMatchObject({
      status: 'complete',
      playerId: 'US_LD',
      transitionCount: 1,
      transitionFrom: 'jog',
      transitionTo: 'sprint',
      transitionReplayTime: 1.6,
      sampleCount: 3,
      p95Ms: 18,
      footSlideSampleCount: 3,
      footSlideP95Mm: 12,
      footMotionP95Mm: 24,
      footMotionPeakRatio: 1,
      authoredContactSampleCount: 4,
      authoredPlantedContactSampleCount: 3,
      authoredFootSlideSampleCount: 2,
      authoredFootSlideP95Mm: 0.8,
      authoredContactClearanceMinimumMm: 4,
      authoredContactClearanceP95Mm: 18,
      authoredContactClearanceMaximumMm: 18,
      authoredOppositeClearanceMinimumMm: 6,
      authoredOppositeClearanceMaximumMm: 22,
      groundMinimumMm: 3,
    });
  });
});
