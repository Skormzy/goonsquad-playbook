import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookMarked,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  PencilRuler,
  ShieldCheck,
  Sparkles,
  UserRound,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { getPlaymakerAuthPersistence } from '../playmaker/playmakerCloud';
import AccountAdminPanel from './AccountAdminPanel';
import { useAccount } from './AccountContext';
import UsernameField from './UsernameField';
import { isValidUsername, normalizeUsername } from './username';
import './account.css';

function initialAuthMode() {
  try {
    return new URL(window.location.href).searchParams.get('auth') === 'signin' ? 'signin' : 'signup';
  } catch {
    return 'signup';
  }
}

function updateAuthModeInUrl(mode) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('content', 'account');
    url.searchParams.set('mode', '2d');
    url.searchParams.set('auth', mode);
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  } catch { /* URL state is non-critical. */ }
}

function initialAdminPanel() {
  try {
    return new URL(window.location.href).searchParams.get('panel') === 'admin';
  } catch {
    return false;
  }
}

function updateAdminPanelInUrl(open) {
  try {
    const url = new URL(window.location.href);
    if (open) url.searchParams.set('panel', 'admin');
    else url.searchParams.delete('panel');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  } catch { /* URL state is non-critical. */ }
}

function AccountValue({ children, title, text }) {
  return (
    <div className="account-value-row">
      <span>{children}</span>
      <div><strong>{title}</strong><small>{text}</small></div>
      <Check aria-hidden="true" />
    </div>
  );
}

function SignedInAccount({ account, onOpenAdmin, setActiveView }) {
  const [profileName, setProfileName] = useState(account.displayName === 'Guest' ? '' : account.displayName);
  const [profileUsername, setProfileUsername] = useState(account.username || normalizeUsername(account.displayName));
  const [verifiedUsername, setVerifiedUsername] = useState('');
  const profileUsernameIsCurrent = normalizeUsername(profileUsername) === normalizeUsername(account.username);
  const profileReady = Boolean(
    profileName.trim()
    && isValidUsername(profileUsername)
    && (profileUsernameIsCurrent || verifiedUsername === profileUsername),
  );

  const submitProfile = async (event) => {
    event.preventDefault();
    try {
      await account.saveProfile({ displayName: profileName, username: profileUsername });
    } catch { /* AccountContext exposes the message. */ }
  };

  return (
    <div className="account-workspace-session">
      <header className="account-workspace-heading">
        <div className="account-workspace-avatar" aria-hidden="true">{account.displayName.slice(0, 1).toUpperCase()}</div>
        <span>ACCOUNT READY</span>
        <h2 id="account-workspace-title">{account.displayName}</h2>
        <p>{account.user.email}</p>
      </header>
      <form className="account-workspace-form" onSubmit={submitProfile}>
        <label htmlFor="account-profile-name"><span>Display name</span><div className="account-input-with-icon"><UserRound aria-hidden="true" /><input id="account-profile-name" type="text" autoComplete="name" maxLength="80" value={profileName} onChange={(event) => setProfileName(event.target.value)} required /></div></label>
        <UsernameField
          account={account}
          currentUsername={account.username}
          id="account-profile-username"
          value={profileUsername}
          onChange={setProfileUsername}
          onAvailabilityChange={(available, checkedUsername) => setVerifiedUsername(available ? checkedUsername : '')}
        />
        <button type="submit" className="account-workspace-primary" disabled={account.busy || !profileReady}><Sparkles aria-hidden="true" /> Save account</button>
      </form>
      <div className="account-workspace-session-actions">
        <button type="button" onClick={() => setActiveView('profile')}><UserRoundCheck aria-hidden="true" /> Open player profile</button>
        {account.profile?.role === 'admin' && (
          <button type="button" onClick={onOpenAdmin}><Users aria-hidden="true" /> Manage members</button>
        )}
        <button type="button" onClick={() => account.signOut().catch(() => {})} disabled={account.busy}><LogOut aria-hidden="true" /> Sign out</button>
      </div>
    </div>
  );
}

function PasswordInput({ autoComplete, id, label, onChange, value }) {
  const [visible, setVisible] = useState(false);
  return (
    <label htmlFor={id}>
      <span>{label}</span>
      <div className="account-input-with-icon account-password-input">
        <LockKeyhole aria-hidden="true" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          minLength="8"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
        />
        <button
          type="button"
          className="account-password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
    </label>
  );
}

export default function AccountWorkspace() {
  const account = useAccount();
  const { setActiveView } = useApp();
  const { theme, themes } = useTheme();
  const t = themes[theme];
  const [mode, setMode] = useState(initialAuthMode);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [verifiedUsername, setVerifiedUsername] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [remember, setRemember] = useState(getPlaymakerAuthPersistence);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [adminOpen, setAdminOpen] = useState(initialAdminPanel);

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setRecoveryOpen(false);
    account.clearStatus();
    updateAuthModeInUrl(nextMode);
  };

  const signupReady = useMemo(
    () => Boolean(displayName.trim() && identifier.includes('@') && password.length >= 8 && verifiedUsername === username && isValidUsername(username)),
    [displayName, identifier, password.length, username, verifiedUsername],
  );

  const signinReady = Boolean(identifier.trim() && password.length >= 8);

  const submitAuth = async (event) => {
    event.preventDefault();
    try {
      if (mode === 'signup') {
        await account.signUp(identifier, password, displayName, username, remember);
        return;
      }
      await account.signIn(identifier, password, remember);
      setActiveView('profile');
    } catch { /* AccountContext exposes the message. */ }
  };

  const openAdmin = () => {
    setAdminOpen(true);
    updateAdminPanelInUrl(true);
  };

  const closeAdmin = () => {
    setAdminOpen(false);
    updateAdminPanelInUrl(false);
  };

  return (
    <main
      className="account-workspace"
      style={{
        '--account-bg': t.bg,
        '--account-surface': t.sf,
        '--account-panel': t.cb,
        '--account-border': t.bd,
        '--account-text': t.tx,
        '--account-muted': t.tm,
        '--account-dim': t.td,
        '--account-accent': t.ac,
        '--account-accent-bg': t.ab,
        '--account-brand': t.br,
      }}
    >
      <div className={`account-workspace-frame ${account.user && account.profile?.role === 'admin' && adminOpen ? 'is-admin' : ''}`}>
        <aside className="account-workspace-identity">
          <div className="account-workspace-kicker"><span /> GOONSQUAD ID</div>
          <h1>{account.user ? 'Your team identity.' : 'Goon with the squad.'}</h1>
          <p>{account.user ? 'Keep your name, username, and team profile current.' : 'One account for your playbook, player profile, and created plays.'}</p>
          <div className="account-value-list">
            <AccountValue title="Saved plays" text="Your favorites follow you."><BookMarked aria-hidden="true" /></AccountValue>
            <AccountValue title="Player profile" text="Link your Goonsquad player record."><UserRoundCheck aria-hidden="true" /></AccountValue>
            <AccountValue title="Create ownership" text="Keep and share the plays you build."><PencilRuler aria-hidden="true" /></AccountValue>
          </div>
          <div className="account-workspace-trust"><LockKeyhole aria-hidden="true" /><span>Your account details stay separate from team statistics.</span></div>
        </aside>

        <section
          className={`account-workspace-panel ${account.user && account.profile?.role === 'admin' && adminOpen ? 'is-admin' : ''}`}
          aria-labelledby={account.user && account.profile?.role === 'admin' && adminOpen ? 'account-admin-title' : 'account-workspace-title'}
        >
          {!account.configured ? (
            <div className="account-workspace-unavailable">
              <ShieldCheck aria-hidden="true" />
              <span>ACCOUNT SERVICE</span>
              <h2 id="account-workspace-title">Accounts are temporarily unavailable</h2>
              <p>Your local plays remain safe. You can keep using the playbook and Create.</p>
            </div>
          ) : account.passwordRecovery ? (
            <form className="account-workspace-form" onSubmit={(event) => {
              event.preventDefault();
              account.updatePassword(newPassword).catch(() => {});
            }}>
              <div className="account-workspace-heading"><KeyRound aria-hidden="true" /><span>SECURE RECOVERY</span><h2 id="account-workspace-title">Choose a new password</h2><p>Use at least eight characters.</p></div>
              <PasswordInput id="account-new-password" label="New password" autoComplete="new-password" value={newPassword} onChange={setNewPassword} />
              <button type="submit" className="account-workspace-primary" disabled={account.busy || newPassword.length < 8}>Update password <ArrowRight aria-hidden="true" /></button>
            </form>
          ) : account.user && account.profile?.role === 'admin' && adminOpen ? (
            <AccountAdminPanel onClose={closeAdmin} />
          ) : account.user ? (
            <SignedInAccount
              key={`${account.user.id}:${account.profile?.updated_at || 'new'}`}
              account={account}
              onOpenAdmin={openAdmin}
              setActiveView={setActiveView}
            />
          ) : (
            <div className="account-workspace-auth">
              <header className="account-workspace-heading">
                <span>{mode === 'signup' ? 'CREATE YOUR ID' : 'WELCOME BACK'}</span>
                <h2 id="account-workspace-title">{mode === 'signup' ? 'Create your account' : 'Sign in'}</h2>
                <p>{mode === 'signup' ? 'Choose the identity your teammates will recognize.' : 'Continue with your saved plays and profile.'}</p>
              </header>

              <div className="account-workspace-tabs" role="tablist" aria-label="Account access">
                <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => changeMode('signup')}>Sign up</button>
                <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => changeMode('signin')}>Sign in</button>
              </div>

              <form className="account-workspace-form" onSubmit={submitAuth}>
                {mode === 'signup' && (
                  <>
                    <label htmlFor="account-signup-name"><span>Display name</span><div className="account-input-with-icon"><UserRound aria-hidden="true" /><input id="account-signup-name" type="text" autoComplete="name" maxLength="80" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></div></label>
                    <UsernameField
                      account={account}
                      id="account-signup-username"
                      value={username}
                      onChange={setUsername}
                      onAvailabilityChange={(available, checkedUsername) => setVerifiedUsername(available ? checkedUsername : '')}
                    />
                  </>
                )}
                <label htmlFor="account-identifier">
                  <span>{mode === 'signup' ? 'Email' : 'Email or username'}</span>
                  <div className="account-input-with-icon">
                    {mode === 'signup' ? <Mail aria-hidden="true" /> : <UserRound aria-hidden="true" />}
                    <input
                      id="account-identifier"
                      type={mode === 'signup' ? 'email' : 'text'}
                      autoComplete={mode === 'signup' ? 'email' : 'username'}
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                      required
                    />
                  </div>
                </label>
                <PasswordInput id="account-password" label="Password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={setPassword} />
                <label className="account-remember">
                  <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                  <span><strong>Keep me signed in on this device</strong><small>Best for your own phone or computer.</small></span>
                </label>
                <button type="submit" className="account-workspace-primary" disabled={account.busy || (mode === 'signup' ? !signupReady : !signinReady)}>
                  {mode === 'signup' ? <><UserRoundCheck aria-hidden="true" /> Create account</> : <><LogIn aria-hidden="true" /> Sign in</>}
                </button>
                {mode === 'signin' && !recoveryOpen && (
                  <button type="button" className="account-workspace-forgot" disabled={account.busy} onClick={() => {
                    setRecoveryEmail(identifier.includes('@') ? identifier : '');
                    setRecoveryOpen(true);
                  }}>Forgot password?</button>
                )}
              </form>
              {mode === 'signin' && recoveryOpen && (
                <form className="account-recovery-inline" onSubmit={(event) => {
                  event.preventDefault();
                  account.resetPassword(recoveryEmail).catch(() => {});
                }}>
                  <div><KeyRound aria-hidden="true" /><span><strong>Reset your password</strong><small>Enter the email attached to the account.</small></span></div>
                  <label htmlFor="account-recovery-email"><span>Email</span><input id="account-recovery-email" type="email" autoComplete="email" value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} required /></label>
                  <div><button type="submit" disabled={account.busy || !recoveryEmail.includes('@')}>Send reset link</button><button type="button" onClick={() => setRecoveryOpen(false)}>Cancel</button></div>
                </form>
              )}
            </div>
          )}

          {account.status && (
            <p
              className="account-workspace-status"
              data-tone={account.statusTone || 'info'}
              role={account.statusTone === 'error' ? 'alert' : 'status'}
            >
              {account.status}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
