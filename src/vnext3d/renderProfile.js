const PROFILES = Object.freeze({
  desktop: Object.freeze({
    id: 'desktop-high',
    dpr: Object.freeze([1, 1.5]),
    antialias: true,
    ballSegments: Object.freeze([24, 16]),
  }),
  tablet: Object.freeze({
    id: 'tablet-balanced',
    dpr: Object.freeze([1, 1.25]),
    antialias: true,
    ballSegments: Object.freeze([20, 12]),
  }),
  mobile: Object.freeze({
    id: 'mobile-efficient',
    dpr: Object.freeze([1.5, 2]),
    antialias: true,
    ballSegments: Object.freeze([24, 16]),
  }),
});

export function productionRenderProfile(layout) {
  return PROFILES[layout] ?? PROFILES.desktop;
}

export function tacticalAthletePresentationScale(cameraId, viewportWidth) {
  return cameraId === 'overhead' && viewportWidth < 640 ? 1.18 : 1;
}

export function summarizeFrameIntervals(intervals) {
  const valid = intervals.filter((value) => Number.isFinite(value) && value > 0 && value <= 250);
  if (valid.length === 0) return null;

  const sorted = [...valid].sort((a, b) => a - b);
  const total = valid.reduce((sum, value) => sum + value, 0);
  const percentileIndex = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);

  return {
    sampleCount: valid.length,
    meanMs: Number((total / valid.length).toFixed(2)),
    p95Ms: Number(sorted[percentileIndex].toFixed(2)),
    maxMs: Number(sorted.at(-1).toFixed(2)),
    under30FpsFrames: valid.filter((value) => value > 33.34).length,
  };
}
