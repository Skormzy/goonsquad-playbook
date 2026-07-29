import { useEffect, useState } from 'react';
import {
  AtSign,
  CheckCircle2,
  LoaderCircle,
  XCircle,
} from 'lucide-react';
import { normalizeUsername, usernameValidationMessage } from './username';

export default function UsernameField({
  account,
  currentUsername = '',
  disabled = false,
  id = 'account-username',
  onAvailabilityChange,
  onChange,
  value,
}) {
  const [remoteState, setRemoteState] = useState({ username: '', kind: 'idle', message: '' });
  const normalizedCurrent = normalizeUsername(currentUsername);
  const username = normalizeUsername(value);
  const validationError = usernameValidationMessage(username);
  const current = Boolean(username && username === normalizedCurrent);

  useEffect(() => {
    if (validationError || current) return undefined;

    let active = true;
    const timer = window.setTimeout(() => {
      account.checkUsername(username)
        .then((result) => {
          if (!active) return;
          const available = Boolean(result.available);
          setRemoteState({
            username,
            kind: available ? 'available' : 'taken',
            message: available ? `@${username} is available.` : `@${username} is already taken.`,
          });
          onAvailabilityChange?.(available, username);
        })
        .catch(() => {
          if (!active) return;
          setRemoteState({ username, kind: 'error', message: 'Availability check is temporarily unavailable.' });
          onAvailabilityChange?.(false, username);
        });
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [account, current, onAvailabilityChange, username, validationError]);

  const state = validationError
    ? {
      kind: username ? 'invalid' : 'idle',
      message: username ? validationError : '3-24 letters, numbers, or underscores.',
    }
    : current
      ? { kind: 'available', message: 'This is your current username.' }
      : remoteState.username === username
        ? remoteState
        : { kind: 'checking', message: 'Checking availability...' };

  const StatusIcon = state.kind === 'checking'
    ? LoaderCircle
    : state.kind === 'available'
      ? CheckCircle2
      : state.kind === 'invalid' || state.kind === 'taken' || state.kind === 'error'
        ? XCircle
        : null;

  return (
    <label className="account-username-field" htmlFor={id}>
      <span>Username</span>
      <div className="account-input-with-icon">
        <AtSign aria-hidden="true" />
        <input
          id={id}
          type="text"
          autoCapitalize="none"
          autoComplete="username"
          autoCorrect="off"
          disabled={disabled}
          maxLength="24"
          minLength="3"
          pattern="[a-z0-9_]{3,24}"
          value={value}
          onChange={(event) => onChange(normalizeUsername(event.target.value))}
          required
          aria-describedby={`${id}-status`}
        />
      </div>
      <small id={`${id}-status`} className="account-username-status" data-state={state.kind}>
        {StatusIcon && <StatusIcon aria-hidden="true" />}
        {state.message}
      </small>
    </label>
  );
}
