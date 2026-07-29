import { useApp } from '../context/AppContext';

const OPTIONS = Object.freeze([
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
]);

export default function FaceoffOutcomeControl({
  compact = false,
  className = '',
  play = null,
  outcome = null,
  onOutcomeChange = null,
}) {
  const {
    currentPlay,
    faceoffOutcome,
    setFaceoffOutcome,
  } = useApp();
  const activePlay = play ?? currentPlay;
  const activeOutcome = outcome ?? faceoffOutcome;
  const changeOutcome = onOutcomeChange ?? setFaceoffOutcome;

  if (!activePlay?.faceoff) return null;

  return (
    <div
      className={`faceoff-outcome-control ${compact ? 'is-compact' : ''} ${className}`.trim()}
      data-faceoff-outcome={activeOutcome}
      data-testid="faceoff-outcome-control"
    >
      <span className="faceoff-outcome-label">DRAW RESULT</span>
      <div className="faceoff-outcome-options" role="group" aria-label="Faceoff result">
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            data-outcome={option.id}
            aria-pressed={activeOutcome === option.id}
            onClick={() => changeOutcome(option.id)}
          >
            <span aria-hidden="true" />
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
