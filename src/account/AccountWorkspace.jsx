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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
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

function AccountValue({ children, title, text }) {
  return (
    <div className="account-value-row">
      <span>{children}</span>
      <div><strong>{title}</strong><small>{text}</small></div>
      <Check aria-hidden="true" />
    </div>
  );
}

function SignedInAccount({ account, setActiveView }) {
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
        <button type="button" onClick={() => account.signOut().catch(() => {})} disabled={account.busy}><LogOut aria-hidden="true" /> Sign out</button>
      </div>
    </div>
  );
}

function GoogleButton({ account, label = 'Continue with Google' }) {
  return (
    <button
      type="button"
      className="account-workspace-google"
      disabled={account.busy}
      onClick={() => account.signInWithGoogle().catch(() => {})}
    >
      <span aria-hidden="true">G</span>
      {label}
    </button>
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const changeMode = (nextMode) => {
    setMode(nextMode);
    account.clearStatus();
    updateAuthModeInUrl(nextMode);
  };

  const signupReady = useMemo(
    () => Boolean(displayName.trim() && email && password.length >= 8 && verifiedUsername === username && isValidUsername(username)),
    [displayName, email, password.length, username, verifiedUsername],
  );

  const signinReady = Boolean(email && password.length >= 8);

  const submitAuth = async (event) => {
    event.preventDefault();
    try {
      if (mode === 'signup') {
        await account.signUp(email, password, displayName, username);
        return;
      }
      await account.signIn(email, password);
      setActiveView('profile');
    } catch { /* AccountContext exposes the message. */ }
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
      <div className="account-workspace-frame">
        <aside className="account-workspace-identity">
          <div className="account-workspace-kicker"><span /> GOONSQUAD ID</div>
          <h1>{account.user ? 'Your team identity.' : 'Goon with the squad.'}</h1>
          <p>{account.user ? 'Keep your name, username, and team profile current.' : 'One account for your playbook, player profile, and created plays.'}</p>
          <div className="account-value-list">
            <AccountValue title="Saved plays" text="Your favorites follow you."><BookMarked aria-hidden="true" /></AccountValue>
            <AccountValue title="Player profile" text="Link your official squad record."><UserRoundCheck aria-hidden="true" /></AccountValue>
            <AccountValue title="Create ownership" text="Keep and share the plays you build."><PencilRuler aria-hidden="true" /></AccountValue>
          </div>
          <div className="account-workspace-trust"><ShieldCheck aria-hidden="true" /><span>Official team statistics stay source-verified and separate from account details.</span></div>
        </aside>

        <section className="account-workspace-panel" aria-labelledby="account-workspace-title">
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
          ) : account.user ? (
            <SignedInAccount key={`${account.user.id}:${account.profile?.updated_at || 'new'}`} account={account} setActiveView={setActiveView} />
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

              <GoogleButton account={account} label={mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'} />
              <div className="account-workspace-divider"><span>or use email</span></div>

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
                <label htmlFor="account-email"><span>Email</span><div className="account-input-with-icon"><Mail aria-hidden="true" /><input id="account-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div></label>
                <PasswordInput id="account-password" label="Password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={setPassword} />
                <button type="submit" className="account-workspace-primary" disabled={account.busy || (mode === 'signup' ? !signupReady : !signinReady)}>
                  {mode === 'signup' ? <><UserRoundCheck aria-hidden="true" /> Create account</> : <><LogIn aria-hidden="true" /> Sign in</>}
                </button>
                {mode === 'signin' && <button type="button" className="account-workspace-forgot" disabled={account.busy || !email} onClick={() => account.resetPassword(email).catch(() => {})}>Forgot password?</button>}
              </form>
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
