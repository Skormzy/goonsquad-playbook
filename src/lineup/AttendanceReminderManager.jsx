import { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  Check,
  CheckCheck,
  Mail,
  Send,
  Smartphone,
  UsersRound,
} from 'lucide-react';
import {
  loadAttendanceReminderConfig,
  sendAttendanceReminder,
} from './attendanceReminders';

function memberLabel(member) {
  return [
    member.attendanceRole === 'EP' ? 'EP' : null,
    member.jerseyNumber ? `#${member.jerseyNumber}` : null,
    member.position,
  ].filter(Boolean).join(' - ') || `@${member.username || 'member'}`;
}

export default function AttendanceReminderManager({
  awaiting = [],
  competitionLabel,
  fixture,
  qaMode = false,
}) {
  const recipients = useMemo(
    () => awaiting.filter((member) => member.id && !member.trackingOnly && !String(member.id).startsWith('ep:')),
    [awaiting],
  );
  const recipientKey = recipients.map((member) => member.id).join('|');
  const [selected, setSelected] = useState(() => new Set(recipients.map((member) => member.id)));
  const [config, setConfig] = useState(null);
  const [channels, setChannels] = useState({ email: false, push: false });
  const [message, setMessage] = useState('Please confirm whether you are in for this game.');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setSelected(new Set(recipientKey ? recipientKey.split('|') : []));
  }, [recipientKey]);

  useEffect(() => {
    let active = true;
    if (qaMode) {
      setConfig({ emailConfigured: true, pushConfigured: true, responseLinksConfigured: true });
      setChannels({ email: true, push: true });
      return undefined;
    }
    loadAttendanceReminderConfig().then((next) => {
      if (!active) return;
      setConfig(next);
      setChannels({ email: next.emailConfigured, push: next.pushConfigured });
    }).catch((loadError) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Reminder settings could not load.');
    });
    return () => { active = false; };
  }, [qaMode]);

  const toggleRecipient = (id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const send = async () => {
    if (busy || !selected.size) return;
    setBusy(true);
    setStatus('');
    setError('');
    try {
      const result = qaMode ? {
        recipientCount: selected.size,
        pushDevices: channels.push ? selected.size : 0,
        emailRecipients: channels.email ? selected.size : 0,
        noDeliveryRecipients: 0,
      } : await sendAttendanceReminder({
        channels,
        fixture: {
          id: fixture.id,
          opponent: fixture.opponent,
          scheduledAt: fixture.scheduledAt,
          competitionLabel,
        },
        message,
        recipientIds: [...selected],
      });
      const delivery = [
        result.pushDevices ? `${result.pushDevices} phone${result.pushDevices === 1 ? '' : 's'}` : null,
        result.emailRecipients ? `${result.emailRecipients} email${result.emailRecipients === 1 ? '' : 's'}` : null,
      ].filter(Boolean).join(' and ');
      setStatus(
        result.noDeliveryRecipients
          ? `Reminder sent by ${delivery || 'available channels'}. ${result.noDeliveryRecipients} selected player${result.noDeliveryRecipients === 1 ? '' : 's'} need email or push enabled.`
          : result.failedDeliveries
            ? `Reminder sent by ${delivery}. ${result.failedDeliveries} delivery attempt${result.failedDeliveries === 1 ? '' : 's'} could not be completed.`
            : `Reminder sent to ${result.recipientCount} player${result.recipientCount === 1 ? '' : 's'} by ${delivery}.`,
      );
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'The reminder could not be sent.');
    } finally {
      setBusy(false);
    }
  };

  const canSend = selected.size > 0
    && (channels.email || channels.push)
    && config?.responseLinksConfigured;

  return (
    <details className="attendance-reminder-manager">
      <summary>
        <BellRing aria-hidden="true" />
        <span>
          <strong>Remind waiting</strong>
          <small>{recipients.length ? `${recipients.length} player${recipients.length === 1 ? '' : 's'} have not answered` : 'Everyone with an account has answered'}</small>
        </span>
        <b>{recipients.length}</b>
      </summary>
      <div className="attendance-reminder-body">
        {!recipients.length ? (
          <p className="attendance-reminder-complete"><CheckCheck aria-hidden="true" /> No reminder needed.</p>
        ) : (
          <>
            <div className="attendance-reminder-channels" aria-label="Reminder channels">
              <label data-disabled={!config?.pushConfigured}>
                <input
                  type="checkbox"
                  checked={channels.push}
                  disabled={!config?.pushConfigured}
                  onChange={(event) => setChannels((current) => ({ ...current, push: event.target.checked }))}
                />
                <Smartphone aria-hidden="true" /> Phone push
              </label>
              <label data-disabled={!config?.emailConfigured}>
                <input
                  type="checkbox"
                  checked={channels.email}
                  disabled={!config?.emailConfigured}
                  onChange={(event) => setChannels((current) => ({ ...current, email: event.target.checked }))}
                />
                <Mail aria-hidden="true" /> Email
              </label>
            </div>
            {config && (!config.pushConfigured || !config.emailConfigured) && (
              <p className="attendance-reminder-setup">
                {!config.pushConfigured && !config.emailConfigured
                  ? 'Phone push and email sender setup are still required.'
                  : !config.emailConfigured
                    ? 'Phone push is ready. Email sender setup is still required.'
                    : 'Email is ready. Members must enable push on each device.'}
              </p>
            )}
            <label className="attendance-reminder-message">
              <span>Coach note</span>
              <textarea value={message} maxLength={180} rows={2} onChange={(event) => setMessage(event.target.value)} />
            </label>
            <div className="attendance-reminder-recipient-tools">
              <span><UsersRound aria-hidden="true" /> {selected.size} selected</span>
              <button type="button" onClick={() => setSelected(new Set(recipients.map((member) => member.id)))}>All</button>
              <button type="button" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
            <div className="attendance-reminder-recipients">
              {recipients.map((member) => (
                <label key={member.id}>
                  <input type="checkbox" checked={selected.has(member.id)} onChange={() => toggleRecipient(member.id)} />
                  <span className="attendance-reminder-avatar">{member.displayName?.slice(0, 1).toUpperCase() || '?'}</span>
                  <span><strong>{member.displayName}</strong><small>{memberLabel(member)}</small></span>
                  {selected.has(member.id) && <Check aria-hidden="true" />}
                </label>
              ))}
            </div>
            <button type="button" className="attendance-reminder-send" disabled={busy || !canSend} onClick={send}>
              <Send aria-hidden="true" />
              {busy ? 'Sending...' : `Send to ${selected.size} waiting`}
            </button>
          </>
        )}
        {status && <p className="attendance-reminder-status" role="status">{status}</p>}
        {error && <p className="attendance-reminder-error" role="alert">{error}</p>}
      </div>
    </details>
  );
}
