import { Shield, Swords } from 'lucide-react';
import { CURRICULUM_LANES } from '../data/coreCatalog';

const LANE_ICONS = Object.freeze({
  defence: Shield,
  offence: Swords,
});

export default function CurriculumLaneSwitch({
  compact = false,
  items = [],
  onChange,
  value,
}) {
  return (
    <div
      className={`curriculum-lane-switch ${compact ? 'is-compact' : ''}`}
      role="group"
      aria-label="Choose offence or defence"
      data-curriculum-lane={value}
    >
      {CURRICULUM_LANES.map((lane) => {
        const Icon = LANE_ICONS[lane.id];
        const active = lane.id === value;
        const count = items.filter((item) => item.lane === lane.id).length;
        return (
          <button
            type="button"
            key={lane.id}
            aria-pressed={active}
            className={active ? 'is-active' : ''}
            data-lane={lane.id}
            onClick={() => onChange(lane.id)}
            title={lane.description}
          >
            <Icon aria-hidden="true" />
            <span>{lane.shortLabel}</span>
            <small>{count}</small>
          </button>
        );
      })}
    </div>
  );
}
