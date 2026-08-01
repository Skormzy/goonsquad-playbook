import { useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { teamPlanPreview } from '../play-engine/teamJobs';
import RolePositionSelector from './RolePositionSelector';

export default function MobileTeamPlan({
  children,
  className = '',
  contentClassName = '',
  eyebrow = 'TEAM PLAN',
  fallbackText,
  jobs = [],
  onPositionSelect,
  onTeamSelect,
  onToggle,
  open = false,
  ...sectionProps
}) {
  const { roleFocusMode, selectedPosition } = useApp();
  const contentId = useId();
  const preview = teamPlanPreview(
    jobs,
    roleFocusMode,
    selectedPosition,
    fallbackText,
  );

  return (
    <section
      className={[
        'mobile-team-plan',
        open ? 'is-open' : '',
        className,
      ].filter(Boolean).join(' ')}
      data-active-lens={roleFocusMode}
      data-active-role={preview.role ?? 'team'}
      data-testid="mobile-team-plan"
      {...sectionProps}
    >
      <div className="mobile-team-plan-command-row">
        <span className="mobile-team-plan-eyebrow">{eyebrow}</span>
        <RolePositionSelector
          jobs={jobs}
          onPositionSelect={onPositionSelect}
          onTeamSelect={onTeamSelect}
        />
        <button
          type="button"
          className="mobile-team-plan-toggle"
          aria-controls={contentId}
          aria-expanded={open}
          aria-label={`${open ? 'Close' : 'Open'} complete team responsibilities`}
          onClick={onToggle}
        >
          <ChevronDown aria-hidden="true" />
        </button>
      </div>

      <div className="mobile-team-plan-read" aria-live="polite">
        <strong>{preview.role ?? preview.label}</strong>
        <span>{preview.text}</span>
      </div>

      {open ? (
        <div
          id={contentId}
          className={['mobile-team-plan-content', contentClassName].filter(Boolean).join(' ')}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
