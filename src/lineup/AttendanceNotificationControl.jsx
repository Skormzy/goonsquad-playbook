import { useEffect, useState } from 'react';
import {
  BellRing,
  BellOff,
  CheckCircle2,
  LoaderCircle,
  Smartphone,
} from 'lucide-react';
import {
  attendancePushCapability,
  currentAttendancePushSubscription,
  disableAttendancePush,
  enableAttendancePush,
  loadAttendanceReminderConfig,
} from './attendanceReminders';

export default function AttendanceNotificationControl({ qaMode = false }) {
  const [config, setConfig] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const capability = attendancePushCapability();

  useEffect(() => {
    let active = true;
    if (qaMode) {
      setConfig({ pushConfigured: true, emailConfigured: true });
      return undefined;
    }
    Promise.all([
      loadAttendanceReminderConfig(),
      currentAttendancePushSubscription(),
    ]).then(([nextConfig, subscription]) => {
      if (!active) return;
      setConfig(nextConfig);
      setEnabled(Boolean(subscription));
    }).catch((error) => {
      if (active) setMessage(error instanceof Error ? error.message : 'Reminder settings could not load.');
    });
    return () => { active = false; };
  }, [qaMode]);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      if (qaMode) {
        setEnabled((value) => !value);
      } else if (enabled) {
        await disableAttendancePush();
        setEnabled(false);
      } else {
        await enableAttendancePush();
        setEnabled(true);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Push reminders could not be updated.');
    } finally {
      setBusy(false);
    }
  };

  const unavailableCopy = capability.supported
    ? 'Phone notifications are not configured yet.'
    : capability.installed
      ? 'This device does not support web push.'
      : 'On iPhone, add Goonsquad to your Home Screen first.';
  const detail = enabled
    ? 'Coach reminders can appear on this device.'
    : config?.pushConfigured && capability.supported
      ? 'Get coach attendance reminders on this device.'
      : unavailableCopy;
  const Icon = busy ? LoaderCircle : enabled ? BellRing : capability.supported ? Smartphone : BellOff;

  return (
    <details className="attendance-notification-control">
      <summary>
        <Icon aria-hidden="true" className={busy ? 'is-spinning' : ''} />
        <span>
          <strong>Game reminders</strong>
          <small>{detail}</small>
        </span>
        <b data-enabled={enabled}>{enabled ? 'ON' : 'SET UP'}</b>
      </summary>
      <div>
        <p>
          {config?.emailConfigured
            ? 'Email reminders go to your registered email. Phone push is optional.'
            : 'Phone push is available now. Email delivery is awaiting sender setup.'}
        </p>
        <button
          type="button"
          disabled={busy || (!enabled && (!config?.pushConfigured || !capability.supported))}
          onClick={toggle}
        >
          {enabled ? <BellOff aria-hidden="true" /> : <BellRing aria-hidden="true" />}
          {enabled ? 'Turn off on this device' : 'Enable phone reminders'}
        </button>
        {enabled && <span className="attendance-notification-success"><CheckCircle2 aria-hidden="true" /> This device is ready.</span>}
        {message && <span className="attendance-notification-error" role="alert">{message}</span>}
      </div>
    </details>
  );
}
