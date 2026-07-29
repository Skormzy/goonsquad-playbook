import { summarizeFootSlideSamples } from './footSliding';
import { summarizeGroundContacts } from './grounding';
import { summarizeFrameIntervals } from './renderProfile';

const MAX_WINDOW_SECONDS = 2;
const round = (value, precision = 3) => Number(value.toFixed(precision));

export function parseTransitionTelemetryWindow(searchParams) {
  if (!searchParams.has('motionWindowStart') || !searchParams.has('motionWindowEnd')) return null;

  const start = Number(searchParams.get('motionWindowStart'));
  const end = Number(searchParams.get('motionWindowEnd'));
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) return null;
  if (end - start > MAX_WINDOW_SECONDS) return null;

  const playerId = searchParams.get('motionWindowPlayer')?.trim() || null;
  return {
    key: `${round(start)}:${round(end)}:${playerId ?? 'all'}`,
    start: round(start),
    end: round(end),
    playerId,
  };
}

export function parsePrivateMotionTuning(searchParams, motionReview) {
  if (![
    'cmu-jog16',
    'cmu-jog16-ik',
    'cmu-jog16-ik-uniform',
    'cmu-jog16-ik-red-sleeve',
    'cmu-jog16-ik-continuous-jersey',
    'cmu-jog16-ik-upper-body',
    'cmu-jog16-ik-open-face',
    'cmu-jog16-ik-natural-grip',
    'cmu-jog16-ik-diagonal-stick',
    'cmu-jog16-ik-pbr',
    'cmu-jog16-ik-silhouette',
    'cmu-jog16-ik-tailored-uniform',
    'cmu-jog16-ik-cloth-drape',
    'cmu-jog16-ik-helmet-detail',
    'cmu-jog16-ik-face-pose',
    'cmu-jog16-ik-neck-boundary',
  ].includes(motionReview)) return null;
  const tuning = {};

  if (searchParams.has('motionSprintPhaseOffset')) {
    const sprintPhaseOffset = Number(searchParams.get('motionSprintPhaseOffset'));
    if (!Number.isFinite(sprintPhaseOffset) || Math.abs(sprintPhaseOffset) > 1) return null;
    tuning.sprintPhaseOffset = round(sprintPhaseOffset);
  }
  if (searchParams.has('motionBlendSeconds')) {
    const blendSeconds = Number(searchParams.get('motionBlendSeconds'));
    if (!Number.isFinite(blendSeconds) || blendSeconds < 0.18 || blendSeconds > 0.5) return null;
    tuning.blendSeconds = round(blendSeconds);
  }

  return Object.keys(tuning).length > 0 ? tuning : null;
}

export function dedupeTransitionEvents(events) {
  const unique = [];
  for (const event of events) {
    const duplicate = unique.some((candidate) => (
      candidate.playerId === event.playerId
      && candidate.from === event.from
      && candidate.to === event.to
      && Math.abs(candidate.replayTime - event.replayTime) <= 0.05
    ));
    if (!duplicate) unique.push(event);
  }
  return unique;
}

export function transitionEventsForWindow(events, window) {
  return dedupeTransitionEvents(events.filter((event) => (
    event.replayTime >= window.start
      && event.replayTime <= window.end
      && (!window.playerId || event.playerId === window.playerId)
  )));
}

export function summarizeTransitionTelemetry({
  window,
  frameIntervals,
  footSlideSamples,
  footMotionSamples,
  authoredContactSampleCount = 0,
  authoredPlantedContactSampleCount = 0,
  authoredFootSlideSamples = [],
  authoredClearanceSamples = [],
  authoredOppositeClearanceSamples = [],
  clipTransitions,
  groundContacts,
}) {
  const frameTiming = summarizeFrameIntervals(frameIntervals) ?? {};
  const footSliding = summarizeFootSlideSamples(footSlideSamples) ?? {};
  const footMotion = summarizeFootSlideSamples(footMotionSamples) ?? {};
  const authoredFootSliding = summarizeFootSlideSamples(authoredFootSlideSamples) ?? {};
  const validClearances = authoredClearanceSamples
    .filter((sample) => Number.isFinite(sample))
    .sort((a, b) => a - b);
  const validOppositeClearances = authoredOppositeClearanceSamples
    .filter((sample) => Number.isFinite(sample))
    .sort((a, b) => a - b);
  const clearanceP95Index = Math.min(
    validClearances.length - 1,
    Math.floor(validClearances.length * 0.95),
  );
  const grounding = summarizeGroundContacts(groundContacts) ?? {};
  const uniqueTransitions = dedupeTransitionEvents(clipTransitions);
  const firstTransition = uniqueTransitions[0] ?? null;

  return {
    status: 'complete',
    windowKey: window.key,
    windowStart: window.start,
    windowEnd: window.end,
    windowDurationSeconds: round(window.end - window.start),
    playerId: window.playerId,
    transitionCount: uniqueTransitions.length,
    transitionFrom: firstTransition?.from ?? null,
    transitionTo: firstTransition?.to ?? null,
    transitionReplayTime: firstTransition?.replayTime ?? null,
    ...frameTiming,
    ...footSliding,
    footMotionSampleCount: footMotion.footSlideSampleCount ?? 0,
    footMotionMeanMm: footMotion.footSlideMeanMm ?? null,
    footMotionP95Mm: footMotion.footSlideP95Mm ?? null,
    footMotionMaxMm: footMotion.footSlideMaxMm ?? null,
    footMotionPeakRatio: footMotion.footSlideP95Mm
      ? round(footMotion.footSlideMaxMm / footMotion.footSlideP95Mm)
      : null,
    authoredContactSampleCount,
    authoredPlantedContactSampleCount,
    authoredFootSlideSampleCount: authoredFootSliding.footSlideSampleCount ?? 0,
    authoredFootSlideMeanMm: authoredFootSliding.footSlideMeanMm ?? null,
    authoredFootSlideP95Mm: authoredFootSliding.footSlideP95Mm ?? null,
    authoredFootSlideMaxMm: authoredFootSliding.footSlideMaxMm ?? null,
    authoredContactClearanceMinimumMm: validClearances.length > 0
      ? round(validClearances[0], 2)
      : null,
    authoredContactClearanceP95Mm: validClearances.length > 0
      ? round(validClearances[clearanceP95Index], 2)
      : null,
    authoredContactClearanceMaximumMm: validClearances.length > 0
      ? round(validClearances.at(-1), 2)
      : null,
    authoredOppositeClearanceMinimumMm: validOppositeClearances.length > 0
      ? round(validOppositeClearances[0], 2)
      : null,
    authoredOppositeClearanceMaximumMm: validOppositeClearances.length > 0
      ? round(validOppositeClearances.at(-1), 2)
      : null,
    ...grounding,
  };
}
