import { sampleTacticalReplay } from '../tactical3d/sampleTacticalReplay';
import { rinkPositionToWorld } from '../vnext3d/runtimeMapping';
import { isPenaltyBoxPlayer } from './penaltyBox';
import { validatePlayScene } from './validatePlayScene';

const SAMPLE_INTERVAL_SECONDS = 0.2;
const RUN_ALIGNMENT_SPEED_MPS = 0.35;
const SETTLED_SPEED_MPS = 0.01;
const RELEASE_WINDOW_BEFORE_SECONDS = 0.34;
const RELEASE_WINDOW_AFTER_SECONDS = 0.28;

export const THREE_D_MECHANICS_LIMITS = {
  minimumPlayDurationSeconds: 8,
  minimumStrategyDurationSeconds: 12,
  minimumTeachingBeats: 2,
  minimumBeatSpacingSeconds: 2,
  minimumFaceoffBeatSpacingSeconds: 0.5,
  minimumResolutionSeconds: 2.5,
  maximumRunAlignmentDegrees: 15,
  maximumCarryAlignmentDegrees: 15,
  maximumReleaseAlignmentDegrees: 10,
  maximumReceiveAlignmentDegrees: 18,
  maximumGoalieBallAlignmentDegrees: 1,
  maximumSettledBallAlignmentDegrees: 1,
};

function angleDifferenceRadians(first, second) {
  return Math.abs(Math.atan2(Math.sin(first - second), Math.cos(first - second)));
}

function degrees(radians) {
  return radians * 180 / Math.PI;
}

function headingToWorldPosition(player, worldPosition) {
  return Math.atan2(
    worldPosition[0] - player.worldPosition[0],
    worldPosition[2] - player.worldPosition[2],
  );
}

function worldPosition(rinkPosition) {
  const point = rinkPositionToWorld(rinkPosition);
  return [point.x, 0, point.z];
}

function worldDistance(first, second) {
  const firstWorld = worldPosition(first);
  const secondWorld = worldPosition(second);
  return Math.hypot(firstWorld[0] - secondWorld[0], firstWorld[2] - secondWorld[2]);
}

function releaseTarget(segment) {
  if (segment.type === 'board-pass' && segment.impact) return segment.impact;
  const start = segment.start ?? segment.incoming ?? segment.path?.[0] ?? segment.end;
  const pathTarget = segment.path?.find((point) => worldDistance(start, point) > 0.05);
  return pathTarget ?? segment.end ?? segment.exitTarget;
}

function receiveSource(segment) {
  if (segment.type === 'board-pass' && segment.impact) return segment.impact;
  if (segment.path?.length > 2) return segment.path.at(-2);
  return segment.start ?? segment.incoming;
}

function activeSegment(scene, time) {
  const finalIndex = scene.ball.segments.length - 1;
  return scene.ball.segments.find((segment, index) => (
    time >= segment.from
    && (index === finalIndex ? time <= segment.to : time < segment.to)
  )) ?? scene.ball.segments.at(-1);
}

function inReleaseWindow(scene, playerId, time) {
  return scene.ball.segments.some((segment) => (
    segment.fromPlayerId === playerId
    && time >= segment.from - RELEASE_WINDOW_BEFORE_SECONDS
    && time <= segment.from + RELEASE_WINDOW_AFTER_SECONDS
  ));
}

function angleToTravel(player) {
  const travelHeading = Math.atan2(player.worldVelocity[0], player.worldVelocity[2]);
  return degrees(angleDifferenceRadians(player.worldRotation, travelHeading));
}

function recordMaximum(metrics, key, value, detail) {
  if (value > metrics[key].degrees) metrics[key] = { degrees: value, detail };
}

function alignmentMetrics() {
  return {
    runAlignment: { degrees: 0, detail: null },
    carryAlignment: { degrees: 0, detail: null },
    releaseAlignment: { degrees: 0, detail: null },
    receiveAlignment: { degrees: 0, detail: null },
    goalieBallAlignment: { degrees: 0, detail: null },
    settledBallAlignment: { degrees: 0, detail: null },
  };
}

function addAlignmentError(errors, scene, label, metric, maximum) {
  if (metric.degrees <= maximum) return;
  errors.push(
    `${scene.id} ${label} reached ${metric.degrees.toFixed(2)} degrees (${metric.detail}); maximum ${maximum}.`,
  );
}

function auditSequence(scene, errors) {
  const minimumDuration = scene.kind === 'strategy'
    ? THREE_D_MECHANICS_LIMITS.minimumStrategyDurationSeconds
    : THREE_D_MECHANICS_LIMITS.minimumPlayDurationSeconds;
  if (scene.duration < minimumDuration) {
    errors.push(`${scene.id} lasts ${scene.duration}s; minimum ${minimumDuration}s.`);
  }

  const beats = scene.sourcePhaseTimes ?? [];
  if (beats.length < THREE_D_MECHANICS_LIMITS.minimumTeachingBeats) {
    errors.push(`${scene.id} needs at least ${THREE_D_MECHANICS_LIMITS.minimumTeachingBeats} teaching beats.`);
  }
  beats.slice(1).forEach((time, index) => {
    const spacing = time - beats[index];
    const minimumBeatSpacing = scene.presentation?.faceoff
      ? THREE_D_MECHANICS_LIMITS.minimumFaceoffBeatSpacingSeconds
      : THREE_D_MECHANICS_LIMITS.minimumBeatSpacingSeconds;
    if (spacing < minimumBeatSpacing) {
      errors.push(`${scene.id} teaching beats ${index + 1}-${index + 2} are only ${spacing}s apart.`);
    }
  });
  const resolutionSeconds = scene.duration - (beats.at(-1) ?? 0);
  if (resolutionSeconds < THREE_D_MECHANICS_LIMITS.minimumResolutionSeconds) {
    errors.push(`${scene.id} leaves only ${resolutionSeconds}s for the final read.`);
  }
  if ((scene.events?.length ?? 0) < beats.length) {
    errors.push(`${scene.id} needs a coaching event for every teaching beat.`);
  }
}

function auditSampledFacing(scene, metrics) {
  for (let time = 0; time <= scene.duration + 0.0001; time += SAMPLE_INTERVAL_SECONDS) {
    const frame = sampleTacticalReplay(scene, Math.min(time, scene.duration));
    const segment = activeSegment(scene, frame.time);
    const involvedIds = [frame.ball.ownerId, frame.ball.fromPlayerId, frame.ball.toPlayerId];

    frame.players.forEach((player) => {
      if (isPenaltyBoxPlayer(player)) return;
      const detail = `${player.id} at ${frame.time.toFixed(2)}s`;
      if (player.role === 'G') {
        const ballDistance = Math.hypot(
          frame.ball.worldPosition[0] - player.worldPosition[0],
          frame.ball.worldPosition[2] - player.worldPosition[2],
        );
        if (ballDistance < 0.1) return;
        const ballHeading = headingToWorldPosition(player, frame.ball.worldPosition);
        recordMaximum(
          metrics,
          'goalieBallAlignment',
          degrees(angleDifferenceRadians(player.worldRotation, ballHeading)),
          detail,
        );
        return;
      }

      if (player.speedMps >= RUN_ALIGNMENT_SPEED_MPS && !inReleaseWindow(scene, player.id, frame.time)) {
        recordMaximum(metrics, 'runAlignment', angleToTravel(player), detail);
      }

      if (
        segment.type === 'carry'
        && segment.ownerId === player.id
        && player.speedMps >= RUN_ALIGNMENT_SPEED_MPS
        && !inReleaseWindow(scene, player.id, frame.time)
      ) {
        recordMaximum(metrics, 'carryAlignment', angleToTravel(player), detail);
      }

      if (
        player.speedMps < SETTLED_SPEED_MPS
        && !involvedIds.includes(player.id)
        && Math.hypot(
          frame.ball.worldPosition[0] - player.worldPosition[0],
          frame.ball.worldPosition[2] - player.worldPosition[2],
        ) > 0.1
      ) {
        const ballHeading = headingToWorldPosition(player, frame.ball.worldPosition);
        recordMaximum(
          metrics,
          'settledBallAlignment',
          degrees(angleDifferenceRadians(player.worldRotation, ballHeading)),
          detail,
        );
      }
    });
  }
}

function auditContacts(scene, metrics) {
  scene.ball.segments.forEach((segment, index) => {
    if (!['pass', 'board-pass', 'shot'].includes(segment.type) || !segment.fromPlayerId) return;
    const releaseFrame = sampleTacticalReplay(scene, segment.from);
    const passer = releaseFrame.players.find((player) => player.id === segment.fromPlayerId);
    const target = releaseTarget(segment);
    if (passer && target) {
      const targetHeading = headingToWorldPosition(passer, worldPosition(target));
      recordMaximum(
        metrics,
        'releaseAlignment',
        degrees(angleDifferenceRadians(passer.worldRotation, targetHeading)),
        `${passer.id} segment ${index} at ${segment.from}s`,
      );
    }

    if (!segment.toPlayerId || !['pass', 'board-pass'].includes(segment.type)) return;
    const immediatelyReleases = scene.ball.segments.some((nextSegment) => (
      nextSegment.fromPlayerId === segment.toPlayerId
      && Math.abs(nextSegment.from - segment.to) < 0.02
    ));
    if (immediatelyReleases) return;
    const receiveFrame = sampleTacticalReplay(scene, segment.to);
    const receiver = receiveFrame.players.find((player) => player.id === segment.toPlayerId);
    const source = receiveSource(segment);
    if (!receiver || !source || receiver.speedMps >= SETTLED_SPEED_MPS) return;
    const sourceHeading = headingToWorldPosition(receiver, worldPosition(source));
    recordMaximum(
      metrics,
      'receiveAlignment',
      degrees(angleDifferenceRadians(receiver.worldRotation, sourceHeading)),
      `${receiver.id} segment ${index} at ${segment.to}s`,
    );
  });
}

export function auditThreeDSceneMechanics(scene) {
  const validation = validatePlayScene(scene);
  const errors = [...validation.errors];
  const metrics = alignmentMetrics();

  auditSequence(scene, errors);
  auditSampledFacing(scene, metrics);
  auditContacts(scene, metrics);

  addAlignmentError(
    errors,
    scene,
    'running alignment',
    metrics.runAlignment,
    THREE_D_MECHANICS_LIMITS.maximumRunAlignmentDegrees,
  );
  addAlignmentError(
    errors,
    scene,
    'ball-carrier alignment',
    metrics.carryAlignment,
    THREE_D_MECHANICS_LIMITS.maximumCarryAlignmentDegrees,
  );
  addAlignmentError(
    errors,
    scene,
    'release alignment',
    metrics.releaseAlignment,
    THREE_D_MECHANICS_LIMITS.maximumReleaseAlignmentDegrees,
  );
  addAlignmentError(
    errors,
    scene,
    'receive alignment',
    metrics.receiveAlignment,
    THREE_D_MECHANICS_LIMITS.maximumReceiveAlignmentDegrees,
  );
  addAlignmentError(
    errors,
    scene,
    'goalie-to-ball alignment',
    metrics.goalieBallAlignment,
    THREE_D_MECHANICS_LIMITS.maximumGoalieBallAlignmentDegrees,
  );
  addAlignmentError(
    errors,
    scene,
    'settled off-ball alignment',
    metrics.settledBallAlignment,
    THREE_D_MECHANICS_LIMITS.maximumSettledBallAlignmentDegrees,
  );

  return {
    valid: errors.length === 0,
    errors,
    metrics,
    playerCount: validation.playerCount,
    teachingBeatCount: scene.sourcePhaseTimes?.length ?? 0,
    duration: scene.duration,
  };
}

export function auditThreeDSceneLibrary(scenes) {
  const reports = scenes.map((scene) => ({
    sceneId: scene.id,
    kind: scene.kind,
    ...auditThreeDSceneMechanics(scene),
  }));
  return {
    valid: reports.every((report) => report.valid),
    sceneCount: reports.length,
    reports,
    errors: reports.flatMap((report) => report.errors),
  };
}
