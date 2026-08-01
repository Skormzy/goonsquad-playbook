import { useApp } from '../context/AppContext';
import {
  positionsForTeamJobs,
  roleLensForPosition,
  teamPlanPreview,
} from '../play-engine/teamJobs';

const POSITION_NAMES = Object.freeze({
  LW: 'left winger',
  C: 'center',
  RW: 'right winger',
  LD: 'left defense',
  RD: 'right defense',
  G: 'goalie',
});

export default function RolePositionSelector({
  className = '',
  jobs = [],
  onPositionSelect,
  onTeamSelect,
}) {
  const {
    roleFocusMode,
    selectedPosition,
    setRoleFocusMode,
    setSelectedPosition,
  } = useApp();
  const positions = positionsForTeamJobs(jobs);
  const preview = teamPlanPreview(jobs, roleFocusMode, selectedPosition);

  const chooseTeam = () => {
    setRoleFocusMode('team');
    onTeamSelect?.();
  };

  const choosePosition = (position) => {
    setSelectedPosition(position);
    setRoleFocusMode(roleLensForPosition(position));
    onPositionSelect?.(position);
  };

  return (
    <div
      className={['role-position-selector', className].filter(Boolean).join(' ')}
      role="group"
      aria-label="Position responsibility"
      data-testid="role-position-selector"
    >
      <button
        type="button"
        aria-label="View full team plan"
        aria-pressed={roleFocusMode === 'team'}
        data-testid="role-position-team"
        onClick={chooseTeam}
        title="Full team plan"
      >
        ALL
      </button>
      {positions.map((position) => (
        <button
          type="button"
          key={position}
          aria-label={`View ${POSITION_NAMES[position]} responsibility`}
          aria-pressed={roleFocusMode !== 'team' && preview.role === position}
          data-position={position}
          data-testid={`role-position-${position.toLowerCase()}`}
          onClick={() => choosePosition(position)}
          title={POSITION_NAMES[position]}
        >
          {position}
        </button>
      ))}
    </div>
  );
}
