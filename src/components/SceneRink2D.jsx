import { useMemo } from 'react';
import { playSceneToRinkPhase } from '../play-engine/toRinkPhase';
import { mirrorPhase } from '../utils/mirror';
import RinkSVG from './RinkSVG';

export default function SceneRink2D({
  scene,
  time,
  roleFocusMode = null,
  selectedPosition = null,
  showOpponents = true,
  trailSeconds = 0.55,
  mirrored = false,
  tactical = false,
  coverage = null,
  arrows = null,
}) {
  const phase = useMemo(() => {
    const sampled = playSceneToRinkPhase(scene, time);
    const withOverlays = arrows ? { ...sampled, arrows } : sampled;
    return mirrored ? mirrorPhase(withOverlays) : withOverlays;
  }, [arrows, mirrored, scene, time]);
  const previous = useMemo(
    () => {
      const sampled = playSceneToRinkPhase(scene, Math.max(0, time - trailSeconds));
      return mirrored ? mirrorPhase(sampled) : sampled;
    },
    [mirrored, scene, time, trailSeconds],
  );

  return (
    <RinkSVG
      mode={tactical ? 'scene-tactics' : 'scene'}
      phaseData={phase}
      prevPhaseData={previous.pos}
      coverage={coverage}
      roleFocusMode={roleFocusMode}
      selectedPosition={selectedPosition}
      showOpponents={showOpponents}
      ariaLabel={`${scene.title} at ${phase.time.toFixed(1)} seconds`}
    />
  );
}
