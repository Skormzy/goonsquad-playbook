import { useEffect, useId, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  normalizeRoleLens,
  roleLensLabel,
  rolesForRoleLens,
} from '../play-engine/teamJobs';

const JOB_COLORS = Object.freeze({
  wingers: '#39d7ff',
  center: '#aeb8c4',
  defense: '#e3263f',
  goalie: '#f0b85c',
});

function selectPrimaryRole(job, selectedPosition) {
  if (job.roles.includes(selectedPosition)) return selectedPosition;
  return job.primaryRole ?? job.roles[0] ?? 'C';
}

function actionRoleLabel(job, action) {
  return job.generic && job.roles.length > 1
    ? job.roles.join('/')
    : action.role;
}

export default function TeamJobsPanel({
  compact = false,
  eyebrow = 'TEAM JOBS',
  jobs = [],
  meta = null,
  summary = null,
  wide = false,
}) {
  const {
    roleFocusMode,
    selectedPosition,
    setRoleFocusMode,
    setSelectedPosition,
  } = useApp();
  const panelId = useId();
  const availableIds = useMemo(() => new Set(jobs.map((job) => job.id)), [jobs]);
  const normalizedLens = normalizeRoleLens(roleFocusMode);
  const activeLens = normalizedLens === 'team' || availableIds.has(normalizedLens)
    ? normalizedLens
    : 'team';
  const activeJob = jobs.find((job) => job.id === activeLens) ?? null;

  useEffect(() => {
    if (activeLens !== roleFocusMode) setRoleFocusMode(activeLens);
  }, [activeLens, roleFocusMode, setRoleFocusMode]);

  const chooseLens = (lensId) => {
    setRoleFocusMode(lensId);
    const job = jobs.find((candidate) => candidate.id === lensId);
    if (job) setSelectedPosition(selectPrimaryRole(job, selectedPosition));
  };

  return (
    <section
      className={['team-jobs-panel', compact ? 'is-compact' : '', wide ? 'is-wide' : ''].filter(Boolean).join(' ')}
      data-testid="team-jobs-panel"
      data-active-lens={activeLens}
    >
      {(summary || meta) && (
        <header className="team-jobs-heading">
          <span>{eyebrow}</span>
          {summary && <strong>{summary}</strong>}
          {meta && <small>{meta}</small>}
        </header>
      )}

      <div className="team-job-lenses" role="tablist" aria-label="Role lens">
        <button
          type="button"
          role="tab"
          id={`${panelId}-team`}
          aria-controls={`${panelId}-content`}
          aria-selected={activeLens === 'team'}
          className={activeLens === 'team' ? 'is-active' : ''}
          data-testid="role-lens-team"
          onClick={() => chooseLens('team')}
        >
          Team
        </button>
        {jobs.map((job) => (
          <button
            type="button"
            role="tab"
            id={`${panelId}-${job.id}`}
            aria-controls={`${panelId}-content`}
            aria-selected={activeLens === job.id}
            className={activeLens === job.id ? 'is-active' : ''}
            data-testid={'role-lens-' + job.id}
            key={job.id}
            onClick={() => chooseLens(job.id)}
            style={{ '--job-accent': JOB_COLORS[job.id] }}
          >
            {job.label}
          </button>
        ))}
      </div>

      {activeJob ? (
        <article
          className="team-job-detail"
          aria-live="polite"
          aria-labelledby={`${panelId}-${activeJob.id}`}
          id={`${panelId}-content`}
          role="tabpanel"
          style={{ '--job-accent': JOB_COLORS[activeJob.id] }}
        >
          <div className="team-job-detail-heading">
            <span>{roleLensLabel(activeJob.id)}</span>
            <small>{rolesForRoleLens(activeJob.id).length > 1 ? 'GROUP LENS' : 'ROLE LENS'}</small>
          </div>
          <div className="team-job-detail-actions">
            {activeJob.actions.map((action, index) => (
              <div key={[activeJob.id, action.role, index].join('-')}>
                <div className="team-job-action-meta">
                  <b className="team-job-action-role">{actionRoleLabel(activeJob, action)}</b>
                  {action.urgency !== 'hold' && <span>{action.urgency.toUpperCase()}</span>}
                </div>
                <p>{action.text}</p>
                {action.key && <strong>KEY READ: {action.key}</strong>}
                {action.callout && <strong className="is-callout">&quot;{action.callout}&quot;</strong>}
              </div>
            ))}
          </div>
        </article>
      ) : (
        <div
          className="team-job-grid"
          aria-labelledby={`${panelId}-team`}
          aria-live="polite"
          id={`${panelId}-content`}
          role="tabpanel"
        >
          {jobs.map((job) => (
            <button
              type="button"
              className="team-job-card"
              key={job.id}
              onClick={() => chooseLens(job.id)}
              style={{ '--job-accent': JOB_COLORS[job.id] }}
            >
              <span>{job.label}</span>
              <div>
                {job.actions.map((action, index) => (
                  <p key={[job.id, action.role, index].join('-')}>
                    <b>{actionRoleLabel(job, action)}</b>
                    <span>{action.text}</span>
                  </p>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
