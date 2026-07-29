import { useApp } from '../context/AppContext';
import { teamJobsFromPhase } from '../play-engine/teamJobs';
import TeamJobsPanel from './TeamJobsPanel';

export default function ResponsibilityPanel({ compact = false }) {
  const { currentReplayPhases, currentPhase, isMirrored } = useApp();
  const phase = currentReplayPhases[currentPhase];
  if (!phase) return null;

  return (
    <TeamJobsPanel
      compact={compact}
      eyebrow="PHASE PLAN"
      jobs={teamJobsFromPhase(phase, isMirrored)}
      summary={phase.desc}
    />
  );
}
