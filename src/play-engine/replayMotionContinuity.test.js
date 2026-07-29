import { describe, expect, it } from 'vitest';
import {
  getRegisteredFaceoffOutcomeScenes,
  getRegisteredPlayScenes,
  getRegisteredStrategyScenes,
} from './sceneRegistry';
import { PLAYS } from '../data/plays';
import { TACTICS } from '../data/tactics';
import { sampleTacticalReplay } from '../tactical3d/sampleTacticalReplay';
import { isPenaltyBoxPlayer } from './penaltyBox';

const SAMPLE_SECONDS = 1 / 30;

function sampleSceneMotion(scene, sceneIndex) {
  const previousPositions = new Map();
  const previousVelocities = new Map();
  const metrics = [];
  const sceneKey = `${scene.id}:${scene.presentation?.faceoff?.outcome ?? sceneIndex}`;

  for (let time = 0; time <= scene.duration + 0.0001; time += SAMPLE_SECONDS) {
    const frame = sampleTacticalReplay(scene, Math.min(time, scene.duration));
    frame.players.forEach((player) => {
      if (isPenaltyBoxPlayer(player)) return;
      const previousPosition = previousPositions.get(player.id);
      const previousVelocity = previousVelocities.get(player.id);
      if (previousPosition) {
        const velocity = {
          x: (player.worldPosition[0] - previousPosition[0]) / SAMPLE_SECONDS,
          z: (player.worldPosition[2] - previousPosition[2]) / SAMPLE_SECONDS,
        };
        const speed = Math.hypot(velocity.x, velocity.z);
        metrics.push({
          acceleration: previousVelocity === undefined ? 0 : Math.hypot(
            velocity.x - previousVelocity.x,
            velocity.z - previousVelocity.z,
          ) / SAMPLE_SECONDS,
          playerId: player.id,
          sceneId: scene.id,
          sceneKey,
          speed,
          time,
        });
        previousVelocities.set(player.id, velocity);
      }
      previousPositions.set(player.id, player.worldPosition);
    });
  }

  return metrics;
}

describe('replay motion continuity', () => {
  it('keeps every canonical and alternate replay inside one smooth motion envelope', () => {
    const canonicalPlays = getRegisteredPlayScenes();
    const alternateFaceoffs = getRegisteredFaceoffOutcomeScenes().filter((scene) => (
      scene.presentation?.faceoff?.outcome === 'lost'
    ));
    const scenes = [
      ...canonicalPlays,
      ...alternateFaceoffs,
      ...getRegisteredStrategyScenes(),
    ];
    const metrics = scenes.flatMap((scene, sceneIndex) => sampleSceneMotion(scene, sceneIndex));
    const fastest = [...metrics].sort((a, b) => b.speed - a.speed)[0];
    const sharpest = [...metrics].sort((a, b) => b.acceleration - a.acceleration)[0];
    const distances = new Map();
    metrics.forEach((metric) => {
      const key = `${metric.sceneKey}:${metric.playerId}`;
      distances.set(key, (distances.get(key) ?? 0) + metric.speed * SAMPLE_SECONDS);
    });
    const shortest = [...distances.entries()].sort((a, b) => a[1] - b[1])[0];
    const expectedSceneCount = PLAYS.length
      + PLAYS.filter((play) => play.faceoff).length
      + TACTICS.length * 2;
    const expectedMovingPlayerCount = scenes.reduce(
      (total, scene) => total + scene.players.filter((player) => !isPenaltyBoxPlayer(player)).length,
      0,
    );

    expect(scenes).toHaveLength(expectedSceneCount);
    expect(metrics.length).toBeGreaterThan(10_000);
    expect(metrics.every(({ acceleration, speed }) => (
      Number.isFinite(speed) && Number.isFinite(acceleration)
    ))).toBe(true);
    expect(
      fastest.speed,
      `${fastest.sceneId} ${fastest.playerId} reached ${fastest.speed.toFixed(3)} m/s`,
    ).toBeLessThanOrEqual(6);
    expect(
      sharpest.acceleration,
      `${sharpest.sceneId} ${sharpest.playerId} reached ${sharpest.acceleration.toFixed(3)} m/s2`,
    ).toBeLessThanOrEqual(7);
    expect(distances).toHaveLength(expectedMovingPlayerCount);
    expect(
      shortest[1],
      `${shortest[0]} moved only ${shortest[1].toFixed(3)} m`,
    ).toBeGreaterThan(0.06);
  });

});
