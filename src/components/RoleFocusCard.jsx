import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { resolveRoleFocus } from '../play-engine/roleFocus';

const URGENCY = {
  sprint: { label: 'SPRINT', color: '#f97316' },
  run: { label: 'RUN', color: '#22c55e' },
  drift: { label: 'DRIFT', color: '#38bdf8' },
  hold: { label: 'HOLD', color: '#94a3b8' },
};

export default function RoleFocusCard({ compact = false, embedded = false, className = '' }) {
  const { theme, themes } = useTheme();
  const t = themes[theme];
  const { selectedPosition, currentReplayPhases, instructionPhase, isMirrored } = useApp();
  const phase = currentReplayPhases[instructionPhase];
  const focus = resolveRoleFocus(phase, selectedPosition, isMirrored);
  const detail = focus.responsibility;

  if (!detail) return null;

  const urgency = URGENCY[detail.u] ?? URGENCY.hold;
  const roleColor = t.pc[focus.role];
  const bodyFont = "'Trebuchet MS','Lucida Grande',sans-serif";

  return (
    <section
      className={`role-focus-card ${className}`.trim()}
      data-testid="role-focus-card"
      data-role={focus.role}
      aria-live="polite"
      style={{
        width: '100%',
        maxWidth: compact || embedded ? undefined : 390,
        background: embedded ? 'transparent' : t.sf,
        borderRadius: embedded ? 0 : (compact ? 7 : 8),
        borderStyle: 'solid',
        borderWidth: embedded ? 0 : 1,
        borderColor: `${roleColor}28`,
        borderLeftWidth: 3,
        borderLeftColor: roleColor,
        padding: embedded ? '7px 9px' : (compact ? '6px 8px' : '10px 12px'),
        marginBottom: compact ? 5 : 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 7 : 9, marginBottom: compact ? 5 : 8 }}>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: compact ? 24 : 30,
            height: compact ? 24 : 30,
            flexShrink: 0,
            border: `2px solid ${roleColor}`,
            borderRadius: '50%',
            background: `${roleColor}22`,
            color: roleColor,
            fontFamily: 'monospace',
            fontSize: compact ? 9 : 11,
            fontWeight: 900,
          }}
        >
          {focus.role}
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ color: t.td, fontFamily: 'monospace', fontSize: compact ? 7 : 8, fontWeight: 900, letterSpacing: 1.1 }}>
            ROLE FOCUS
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2 }}>
            <strong style={{ color: t.tx, fontSize: compact ? 10 : 12, lineHeight: 1.15 }}>
              {focus.roleLabel}
            </strong>
            <span style={{
              padding: '1px 5px',
              border: `1px solid ${urgency.color}44`,
              borderRadius: 3,
              background: `${urgency.color}18`,
              color: urgency.color,
              fontFamily: 'monospace',
              fontSize: 7,
              fontWeight: 900,
              letterSpacing: 0.8,
            }}>
              {urgency.label}
            </span>
          </div>
        </div>
      </div>

      <p style={{
        margin: 0,
        color: t.tx,
        fontFamily: bodyFont,
        fontSize: compact ? 10.5 : 12.5,
        lineHeight: compact ? 1.45 : 1.6,
      }}>
        {detail.role}
      </p>

      {(detail.key || detail.comm) && (
        <div className="role-focus-notes" style={{ marginTop: compact ? 6 : 8 }}>
          {detail.key && (
            <div style={{ borderColor: '#eab30855', background: '#eab30810' }}>
              <span style={{ color: '#eab308' }}>KEY READ</span>
              <p style={{ color: t.tx }}>{detail.key}</p>
            </div>
          )}
          {detail.comm && (
            <div style={{ borderColor: '#22c55e55', background: '#22c55e10' }}>
              <span style={{ color: '#22c55e' }}>CALL OUT</span>
              <p style={{ color: '#22c55e', fontFamily: 'monospace', fontWeight: 900 }}>
                &quot;{detail.comm}&quot;
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
