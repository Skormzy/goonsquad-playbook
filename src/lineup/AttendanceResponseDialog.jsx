import { useMemo, useState } from 'react';
import {
  CalendarCheck2,
  Check,
  CheckCircle2,
  Clock3,
  HelpCircle,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  attendanceTokenPreview,
  confirmAttendanceResponse,
} from './attendanceReminders';
import { GOONSQUAD_LOGO_SRC } from '../brand/teamBrand';
import './attendanceResponse.css';

const RESPONSE_DETAILS = Object.freeze({
  in: { label: "I'm in", Icon: Check, tone: 'in' },
  maybe: { label: 'Maybe', Icon: HelpCircle, tone: 'maybe' },
  out: { label: "I'm out", Icon: X, tone: 'out' },
});

function gameTime(value) {
  const date = new Date(value || '');
  if (!Number.isFinite(date.getTime())) return 'Upcoming game';
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Toronto',
  }).format(date);
}

export default function AttendanceResponseDialog({ token, onClose }) {
  const preview = useMemo(() => attendanceTokenPreview(token), [token]);
  const response = RESPONSE_DETAILS[preview?.response] || null;
  const [state, setState] = useState('ready');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const ResponseIcon = response?.Icon || CalendarCheck2;

  const confirm = async () => {
    if (!response || state === 'confirming') return;
    setState('confirming');
    setError('');
    try {
      const next = await confirmAttendanceResponse(token);
      setResult(next);
      setState('complete');
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : 'Your attendance could not be updated.');
      setState('error');
    }
  };

  return (
    <div className="attendance-response-scrim" role="presentation">
      <section className="attendance-response-dialog" role="dialog" aria-modal="true" aria-labelledby="attendance-response-title">
        <header>
          <div className="attendance-response-brand" aria-label="Goonsquad">
            <span aria-hidden="true" style={{ '--attendance-brand-image': `url(${GOONSQUAD_LOGO_SRC})` }} />
            <strong><b>GOON</b><em>SQUAD</em></strong>
          </div>
          <button type="button" onClick={onClose} aria-label="Close attendance response"><X aria-hidden="true" /></button>
        </header>
        {state === 'complete' ? (
          <div className="attendance-response-complete">
            <CheckCircle2 aria-hidden="true" />
            <span>LINEUP UPDATED</span>
            <h1 id="attendance-response-title">You&apos;re marked {RESPONSE_DETAILS[result?.response]?.label || 'answered'}.</h1>
            <p>vs {result?.opponent || preview?.opponent || 'opponent'}</p>
            <button type="button" onClick={onClose}>Back to Goonsquad</button>
          </div>
        ) : (
          <>
            <div className="attendance-response-heading">
              <span>ATTENDANCE CHECK</span>
              <h1 id="attendance-response-title">Confirm your lineup status</h1>
              <p>The coach will see your answer immediately.</p>
            </div>
            <div className="attendance-response-game">
              <CalendarCheck2 aria-hidden="true" />
              <span><small>{preview?.competitionLabel || 'GOONSQUAD'}</small><strong>vs {preview?.opponent || 'Opponent'}</strong></span>
              <time><Clock3 aria-hidden="true" /> {gameTime(preview?.scheduledAt)}</time>
            </div>
            {response ? (
              <button type="button" className="attendance-response-choice" data-response={response.tone} disabled={state === 'confirming'} onClick={confirm}>
                <ResponseIcon aria-hidden="true" />
                <span><small>YOUR CHOICE</small><strong>{response.label}</strong></span>
                <b>{state === 'confirming' ? 'SAVING...' : 'CONFIRM'}</b>
              </button>
            ) : (
              <p className="attendance-response-error" role="alert">This attendance link is invalid. Open the app to answer.</p>
            )}
            {error && <p className="attendance-response-error" role="alert">{error}</p>}
            <footer><ShieldCheck aria-hidden="true" /> Signed Goonsquad link. No sign-in required.</footer>
          </>
        )}
      </section>
    </div>
  );
}
