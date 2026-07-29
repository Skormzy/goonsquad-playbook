import { getPlayScene } from '../src/play-engine/sceneRegistry';
import { samplePlayScene } from '../src/play-engine/samplePlayScene';
import { createProductionRuntimePlayers } from '../src/vnext3d/runtimeMapping';

const replay = getPlayScene('brk');
const sampleTimes = [1.55, 1.6, 1.611, 1.65, 1.7, 1.8, 1.9, 1.944];

for (const time of sampleTimes) {
  const frame = samplePlayScene(replay, time);
  const player = createProductionRuntimePlayers(
    frame,
    'cmu-jog16-ik',
    { sprintPhaseOffset: 0.609 },
  ).find((candidate) => candidate.id === 'US_LD');

  console.log(JSON.stringify({
    time,
    clipName: player.clipName,
    speedMps: player.speedMps,
    worldPosition: player.worldPosition,
    worldRotation: player.worldRotation,
    motionPhaseCycles: player.motionPhaseCycles,
  }));
}
