import {
  BookOpenText,
  CheckCircle2,
  Eye,
  Play,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { replayTeachingStage } from '../play-engine/replayTeachingStage';

const STAGES = Object.freeze({
  ready: {
    label: 'READY',
    instruction: 'Read the cue, then press play',
    icon: Play,
  },
  read: {
    label: 'READ',
    instruction: 'Formation held while you read',
    icon: BookOpenText,
  },
  watch: {
    label: 'WATCH',
    instruction: 'Watch the decision become movement',
    icon: Eye,
  },
  complete: {
    label: 'COMPLETE',
    instruction: 'Review the final shape or replay it',
    icon: CheckCircle2,
  },
});

export default function ReplayTeachingCue({
  accent = 'var(--gs-cyan)',
  children = null,
  className = '',
}) {
  const {
    currentPhase,
    currentReplayPhases,
    currentReplayScene,
    isPlaying,
    phaseTransitionTarget,
    playbackTime,
  } = useApp();
  const phaseCount = currentReplayPhases.length;
  const phase = currentReplayPhases[currentPhase] ?? currentReplayPhases[0];
  if (!phase) return null;

  const stageId = replayTeachingStage({
    currentPhase,
    isPlaying,
    isTransitioning: phaseTransitionTarget !== null,
    phaseCount,
    playbackTime,
    scene: currentReplayScene,
  });
  const stage = STAGES[stageId];
  const StageIcon = stage.icon;
  const title = phase.t || phase.desc || `Phase ${currentPhase + 1}`;
  const description = phase.desc && phase.desc !== title ? phase.desc : null;

  return (
    <section
      className={`replay-teaching-cue ${className}`.trim()}
      data-stage={stageId}
      data-testid="replay-teaching-cue"
      style={{
        '--phase-count': phaseCount,
        '--teaching-accent': accent,
      }}
      aria-label={`Phase ${currentPhase + 1} coaching cue`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="replay-teaching-cue-status">
        <StageIcon aria-hidden="true" />
        <span>{stage.label}</span>
      </div>

      <div
        className="replay-teaching-cue-copy"
        key={phase.id ?? currentPhase}
      >
        <small>
          PHASE {currentPhase + 1} OF {phaseCount}
          <span aria-hidden="true"> / </span>
          {stage.instruction}
        </small>
        <strong>{title}</strong>
        {description && <p>{description}</p>}
      </div>

      {children && <div className="replay-teaching-cue-action">{children}</div>}

      <div className="replay-teaching-progress" aria-hidden="true">
        {currentReplayPhases.map((item, index) => (
          <span
            key={item.id ?? index}
            className={[
              index === currentPhase ? 'is-current' : '',
              index < currentPhase ? 'is-complete' : '',
            ].filter(Boolean).join(' ')}
          />
        ))}
      </div>
    </section>
  );
}
