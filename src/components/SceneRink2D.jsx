import { useMemo } from 'react';
import { playSceneToRinkPhase } from '../play-engine/toRinkPhase';
import RinkSVG from './RinkSVG';

export default function SceneRink2D({
  scene,
  time,
  roleFocusMode = null,
  selectedPosition = null,
  showOpponents = true,
  trailSeconds = 0.55,
}) {
  const phase = useMemo(() => playSceneToRinkPhase(scene, time), [scene, time]);
  const previous = useMemo(
    () => playSceneToRinkPhase(scene, Math.max(0, time - trailSeconds)),
    [scene, time, trailSeconds],
  );

  return (
    <RinkSVG
      mode="scene"
      phaseData={phase}
      prevPhaseData={previous.pos}
      roleFocusMode={roleFocusMode}
      selectedPosition={selectedPosition}
      showOpponents={showOpponents}
      ariaLabel={`${scene.title} at ${phase.time.toFixed(1)} seconds`}
    />
  );
}
