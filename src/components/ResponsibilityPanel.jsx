import { useApp } from '../context/AppContext';
import { teamJobsFromPhase } from '../play-engine/teamJobs';
import TeamJobsPanel from './TeamJobsPanel';

export default function ResponsibilityPanel({ compact = false, jobs: providedJobs = null }) {
  const { currentReplayPhases, currentPhase, isMirrored } = useApp();
  const phase = currentReplayPhases[currentPhase];
  if (!phase) return null;
  const title = phase.t || phase.desc || `Phase ${currentPhase + 1}`;
  const description = phase.desc && phase.desc !== title ? phase.desc : null;

  return (
    <TeamJobsPanel
      compact={compact}
      eyebrow={`PHASE ${currentPhase + 1} OF ${currentReplayPhases.length}`}
      jobs={providedJobs ?? teamJobsFromPhase(phase, isMirrored)}
      meta={description}
      summary={title}
    />
  );
}
