const COURT_WIDTH_METERS = 24;
const COURT_LENGTH_METERS = 48;

const playerById = (frame, id) => frame?.players?.find((player) => player.id === id);

function metricPoint(point) {
  return {
    x: point.x / 100 * COURT_WIDTH_METERS,
    y: point.y / 100 * COURT_LENGTH_METERS,
  };
}

function distanceMeters(first, second) {
  if (!first || !second) return Number.POSITIVE_INFINITY;
  const a = metricPoint(first.position ?? first);
  const b = metricPoint(second.position ?? second);
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function horizontalMeters(first, second) {
  const a = metricPoint(first.position ?? first);
  const b = metricPoint(second.position ?? second);
  return Math.abs(a.x - b.x);
}

function verticalMeters(ahead, behind) {
  const first = metricPoint(ahead.position ?? ahead);
  const second = metricPoint(behind.position ?? behind);
  return first.y - second.y;
}

const round = (value) => Number(value.toFixed(2));

function result(phase, metrics, checks) {
  return {
    phase,
    status: checks.every(Boolean) ? 'pass' : 'fail',
    metrics: Object.fromEntries(
      Object.entries(metrics).map(([key, value]) => [key, round(value)]),
    ),
  };
}

export function standardBreakoutTacticalSpacing(frame) {
  if (!frame || !Number.isFinite(frame.time)) {
    return { phase: 'unavailable', status: 'fail', metrics: {} };
  }

  const ld = playerById(frame, 'US_LD');
  const rd = playerById(frame, 'US_RD');
  const lw = playerById(frame, 'US_LW');
  const center = playerById(frame, 'US_C');
  const rw = playerById(frame, 'US_RW');
  const f1 = playerById(frame, 'OP_F1');
  if (![ld, rd, lw, center, rw, f1].every(Boolean)) {
    return { phase: 'unavailable', status: 'fail', metrics: {} };
  }

  if (frame.time < 2.4) {
    const metrics = {
      pressureDistanceMeters: distanceMeters(ld, f1),
      safetyWidthMeters: horizontalMeters(ld, rd),
      centerOutletAheadMeters: verticalMeters(center, ld),
    };
    return result('retrieval', metrics, [
      metrics.pressureDistanceMeters >= 4 && metrics.pressureDistanceMeters <= 10,
      metrics.safetyWidthMeters >= 5,
      metrics.centerOutletAheadMeters >= 8,
    ]);
  }

  if (frame.time < 4.6) {
    const ball = frame.ball?.trajectoryPosition ?? frame.ball?.position;
    const metrics = {
      centerSupportDistanceMeters: distanceMeters(center, ball),
      weakSideWidthMeters: horizontalMeters(rw, ball),
      leftDefenseBehindMeters: verticalMeters(ball, ld),
      rightDefenseBehindMeters: verticalMeters(ball, rd),
    };
    return result('board-release', metrics, [
      metrics.centerSupportDistanceMeters >= 2 && metrics.centerSupportDistanceMeters <= 11,
      metrics.weakSideWidthMeters >= 12,
      metrics.leftDefenseBehindMeters >= 6,
      metrics.rightDefenseBehindMeters >= 6,
    ]);
  }

  if (frame.time >= 8.35) {
    const nearestPressure = Math.min(...frame.players
      .filter((player) => player.team === 'opponent' && player.role !== 'G')
      .map((player) => distanceMeters(lw, player)));
    const metrics = {
      carrierEntryY: lw.position.y,
      centerUnderneathMeters: verticalMeters(lw, center),
      centerInsideMeters: horizontalMeters(center, lw),
      weakSideWidthMeters: horizontalMeters(rw, lw),
      centerSupportY: center.position.y,
      weakSideSupportY: rw.position.y,
      nearestPressureMeters: nearestPressure,
    };
    return result('entry-settle', metrics, [
      metrics.carrierEntryY >= 68,
      metrics.centerUnderneathMeters >= 1.5 && metrics.centerUnderneathMeters <= 4.5,
      metrics.centerInsideMeters >= 5,
      metrics.weakSideWidthMeters >= 9,
      metrics.centerSupportY >= 64,
      metrics.weakSideSupportY >= 64,
      metrics.nearestPressureMeters >= 1.5 && metrics.nearestPressureMeters <= 6,
    ]);
  }

  if (frame.time >= 7.6) {
    const nearestPressure = Math.min(...frame.players
      .filter((player) => player.team === 'opponent' && player.role !== 'G')
      .map((player) => distanceMeters(lw, player)));
    const metrics = {
      carrierEntryY: lw.position.y,
      centerUnderneathMeters: verticalMeters(lw, center),
      centerInsideMeters: horizontalMeters(center, lw),
      weakSideWidthMeters: horizontalMeters(rw, lw),
      nearestPressureMeters: nearestPressure,
    };
    return result('controlled-entry', metrics, [
      metrics.carrierEntryY >= 64,
      metrics.centerUnderneathMeters >= 1.5 && metrics.centerUnderneathMeters <= 6,
      metrics.centerInsideMeters >= 5,
      metrics.weakSideWidthMeters >= 10,
      metrics.nearestPressureMeters >= 1.5 && metrics.nearestPressureMeters <= 6,
    ]);
  }

  if (frame.time >= 4.6) {
    const nearestPressure = Math.min(...frame.players
      .filter((player) => player.team === 'opponent' && player.role !== 'G')
      .map((player) => distanceMeters(lw, player)));
    const carrier = metricPoint(lw.position);
    const metrics = {
      carrierAdvanceY: lw.position.y,
      carrierWallDistanceMeters: carrier.x,
      centerUnderneathMeters: verticalMeters(lw, center),
      centerInsideMeters: horizontalMeters(center, lw),
      weakSideWidthMeters: horizontalMeters(rw, lw),
      leftDefenseBehindMeters: verticalMeters(lw, ld),
      rightDefenseBehindMeters: verticalMeters(lw, rd),
      nearestPressureMeters: nearestPressure,
    };
    return result('wall-advance', metrics, [
      metrics.carrierAdvanceY >= 52,
      metrics.carrierWallDistanceMeters <= 5.5,
      metrics.centerUnderneathMeters >= 1.5 && metrics.centerUnderneathMeters <= 8,
      metrics.centerInsideMeters >= 5,
      metrics.weakSideWidthMeters >= 10,
      metrics.leftDefenseBehindMeters >= 6,
      metrics.rightDefenseBehindMeters >= 6,
      metrics.nearestPressureMeters >= 1.5 && metrics.nearestPressureMeters <= 7,
    ]);
  }

  return { phase: 'transition', status: 'pass', metrics: {} };
}
