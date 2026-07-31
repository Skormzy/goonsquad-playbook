import {
  BookOpenText,
  BrainCircuit,
  House,
  LockKeyhole,
  PencilRuler,
} from 'lucide-react';

function SegmentButton({
  active,
  disabled = false,
  icon: Icon,
  label,
  locked = false,
  lockMessage = '',
  onClick,
  testId,
  title,
}) {
  return (
    <button
      type="button"
      className="workspace-segment-button"
      data-state={active ? 'active' : 'idle'}
      data-locked={locked || undefined}
      data-testid={testId}
      aria-pressed={active}
      aria-current={active ? 'page' : undefined}
      aria-disabled={disabled || undefined}
      aria-haspopup={locked ? 'dialog' : undefined}
      disabled={disabled}
      onClick={onClick}
      title={locked ? lockMessage : title || label}
    >
      {Icon && <Icon className="workspace-segment-icon" aria-hidden="true" />}
      <span>{label}</span>
      {locked && (
        <>
          <LockKeyhole className="workspace-lock-mark" aria-hidden="true" />
          <span className="workspace-lock-tooltip" role="tooltip">{lockMessage}</span>
        </>
      )}
    </button>
  );
}

export default function WorkspaceSwitcher({
  content,
  mode,
  onContentChange,
  onModeChange,
  allowStrategy3d = false,
  privateAccess = true,
  accessMessage = 'Create an account and request player access to unlock this area.',
  colors,
}) {
  const privateButton = (content) => ({
    locked: !privateAccess,
    lockMessage: accessMessage,
    onClick: () => onContentChange(content),
  });

  return (
    <div
      className="workspace-switcher"
      data-content={content}
      style={{
        '--ws-accent': colors.accent,
        '--ws-accent-bg': colors.accentBackground,
        '--ws-brand': colors.brand,
        '--ws-border': colors.border,
        '--ws-track': colors.track,
        '--ws-text': colors.text,
        '--ws-muted': colors.muted,
      }}
    >
      <nav className="workspace-segment-group workspace-primary-nav" aria-label="Primary navigation">
        <SegmentButton
          label="HOME"
          icon={House}
          title="Team home"
          active={content === 'stats'}
          onClick={() => onContentChange('stats')}
          testId="workspace-content-stats"
        />
        <SegmentButton
          label="PLAYS"
          icon={BookOpenText}
          active={content === 'plays'}
          {...privateButton('plays')}
          testId="workspace-content-plays"
        />
        <SegmentButton
          label="STRATEGY"
          icon={BrainCircuit}
          active={content === 'strategy'}
          {...privateButton('strategy')}
          testId="workspace-content-strategy"
        />
        <SegmentButton
          label="CREATE"
          icon={PencilRuler}
          active={content === 'playmaker'}
          {...privateButton('playmaker')}
          testId="workspace-content-playmaker"
        />
      </nav>

      {!['playmaker', 'stats', 'profile', 'account'].includes(content) && (
        <>
          <span className="workspace-switcher-divider" aria-hidden="true" />

          <div className="workspace-segment-group workspace-view-group" role="group" aria-label="View">
            <SegmentButton
              label="2D"
              title="2D coaching view"
              active={mode === '2d'}
              onClick={() => onModeChange('2d')}
              testId="workspace-view-2d"
            />
            <SegmentButton
              label="3D"
              title="3D replay view"
              active={mode === '3d'}
              disabled={content === 'strategy' && !allowStrategy3d}
              onClick={() => onModeChange('3d')}
              testId="workspace-view-3d"
            />
          </div>
        </>
      )}
    </div>
  );
}
