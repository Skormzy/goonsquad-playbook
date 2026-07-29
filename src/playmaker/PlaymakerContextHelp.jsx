import { CircleHelp } from 'lucide-react';

export default function PlaymakerContextHelp({ label, children }) {
  return (
    <details className="playmaker-context-help">
      <summary aria-label={label} title={label}>
        <CircleHelp aria-hidden="true" />
      </summary>
      <div role="note">{children}</div>
    </details>
  );
}
