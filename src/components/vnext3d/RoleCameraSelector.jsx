const ROLE_CAMERA_POSITIONS = Object.freeze([
  { id: 'LW', label: 'LW', name: 'Left winger' },
  { id: 'C', label: 'C', name: 'Center' },
  { id: 'RW', label: 'RW', name: 'Right winger' },
  { id: 'LD', label: 'LD', name: 'Left defense' },
  { id: 'RD', label: 'RD', name: 'Right defense' },
  { id: 'G', label: 'G', name: 'Goalie' },
]);

export default function RoleCameraSelector({
  className = '',
  onSelect,
  selectedPosition,
}) {
  return (
    <div
      className={['vnext3d-role-camera-selector', className].filter(Boolean).join(' ')}
      role="group"
      aria-label="Player to follow"
    >
      <span>FOLLOW</span>
      {ROLE_CAMERA_POSITIONS.map((position) => (
        <button
          type="button"
          key={position.id}
          aria-label={`Follow ${position.name}`}
          aria-pressed={selectedPosition === position.id}
          onClick={() => onSelect(position.id)}
          title={`Follow ${position.name}`}
        >
          {position.label}
        </button>
      ))}
    </div>
  );
}
