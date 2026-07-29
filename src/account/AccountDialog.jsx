import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  CloudOff,
  KeyRound,
  LockKeyhole,
  LogOut,
  Mail,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useApp } from '../context/AppContext';
import { getPlaymakerAuthPersistence } from '../playmaker/playmakerCloud';
import { useAccount } from './AccountContext';
import UsernameField from './UsernameField';
import { isValidUsername, normalizeUsername } from './username';
import './account.css';

function roleLabel(role) {
  if (role === 'admin') return 'Admin';
  if (role === 'stat_manager') return 'Stats manager';
  return 'Member';
}

export default function AccountDialog() {
  const { theme, themes } = useTheme();
  const { favorites, setActiveView } = useApp();
  const account = useAccount();
  const [mode, setMode] = useState('signin');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [verifiedUsername, setVerifiedUsername] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [remember, setRemember] = useState(getPlaymakerAuthPersistence);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const t = themes[theme];

  if (!account.dialogOpen) return null;

  const submit = async (operation) => {
    try { await operation(); } catch { /* AccountContext exposes the message. */ }
  };

  const openProfile = () => {
    setActiveView('profile');
    account.closeAccount();
  };

  const openAdmin = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('content', 'account');
      url.searchParams.set('mode', '2d');
      url.searchParams.set('panel', 'admin');
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    } catch { /* URL state is non-critical. */ }
    setActiveView('account');
    account.closeAccount();
  };

  const linkedClaims = account.playerClaims.length;
  const pendingClaims = account.playerClaimRequests.filter((claim) => claim.status === 'pending').length;

  return (
    <div className="account-backdrop" role="presentation" onMouseDown={account.closeAccount}>
      <section
        className="account-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-dialog-title"
        style={{
          '--account-surface': t.sf,
          '--account-panel': t.cb,
          '--account-border': t.bd,
          '--account-text': t.tx,
          '--account-muted': t.tm,
          '--account-accent': t.ac,
          '--account-accent-bg': t.ab,
          '--account-brand': t.br,
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="account-dialog-header">
          <div>
            <span>GOONSQUAD ID</span>
            <h2 id="account-dialog-title">{account.user ? 'Your team account' : 'Goon with the squad'}</h2>
          </div>
          <button type="button" className="account-icon-button" onClick={account.closeAccount} aria-label="Close account" title="Close">
            <X aria-hidden="true" />
          </button>
        </header>

        {!account.configured && (
          <div className="account-connection-state is-offline">
            <CloudOff aria-hidden="true" />
            <div>
              <strong>Accounts are temporarily unavailable</strong>
              <p>Your local plays remain safe. You can keep using the playbook and Create.</p>
            </div>
          </div>
        )}

        {account.configured && account.passwordRecovery && (
          <form className="account-auth-form" onSubmit={(event) => {
            event.preventDefault();
            submit(() => account.updatePassword(newPassword));
          }}>
            <div className="account-auth-intro">
              <KeyRound aria-hidden="true" />
              <div><strong>Choose a new password</strong><p>Use at least eight characters. Your other account data stays unchanged.</p></div>
            </div>
            <label>
              <span>New password</span>
              <div className="account-input-with-icon"><LockKeyhole aria-hidden="true" /><input type="password" autoComplete="new-password" minLength="8" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></div>
            </label>
            <button type="submit" className="account-primary-action" disabled={account.busy || newPassword.length < 8}>Update password <ArrowRight aria-hidden="true" /></button>
          </form>
        )}

        {account.configured && !account.user && !account.passwordRecovery && (
          <div className="account-auth-shell">
            <div className="account-auth-tabs" role="tablist" aria-label="Account access">
              <button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => { setMode('signin'); setRecoveryOpen(false); account.clearStatus(); }}>Sign in</button>
              <button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => { setMode('signup'); setRecoveryOpen(false); account.clearStatus(); }}>Create account</button>
            </div>
            <form className="account-auth-form" onSubmit={(event) => {
              event.preventDefault();
              submit(() => mode === 'signup'
                ? account.signUp(identifier, password, displayName, username, remember)
                : account.signIn(identifier, password, remember));
            }}>
              {mode === 'signup' && <label><span>Your name</span><input type="text" autoComplete="name" maxLength="80" value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label>}
              {mode === 'signup' && <UsernameField account={account} id="dialog-signup-username" value={username} onChange={setUsername} onAvailabilityChange={(available, checkedUsername) => setVerifiedUsername(available ? checkedUsername : '')} />}
              <label>
                <span>{mode === 'signup' ? 'Email' : 'Email or username'}</span>
                <div className="account-input-with-icon">
                  {mode === 'signup' ? <Mail aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
                  <input
                    type={mode === 'signup' ? 'email' : 'text'}
                    autoComplete={mode === 'signup' ? 'email' : 'username'}
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    required
                  />
                </div>
              </label>
              <label>
                <span>Password</span>
                <div className="account-input-with-icon"><LockKeyhole aria-hidden="true" /><input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength="8" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
              </label>
              <label className="account-remember">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                <span><strong>Keep me signed in on this device</strong><small>Best for your own phone or computer.</small></span>
              </label>
              <button type="submit" className="account-primary-action" disabled={account.busy || !identifier || password.length < 8 || (mode === 'signup' && (!identifier.includes('@') || !displayName.trim() || verifiedUsername !== username || !isValidUsername(username)))}>
                {mode === 'signup' ? <><UserPlus aria-hidden="true" /> Create my account</> : <>Sign in <ArrowRight aria-hidden="true" /></>}
              </button>
              {mode === 'signin' && !recoveryOpen && <button type="button" className="account-forgot-button" disabled={account.busy} onClick={() => {
                setRecoveryEmail(identifier.includes('@') ? identifier : '');
                setRecoveryOpen(true);
              }}>Forgot password?</button>}
            </form>
            {mode === 'signin' && recoveryOpen && (
              <form className="account-recovery-inline is-dialog" onSubmit={(event) => {
                event.preventDefault();
                submit(() => account.resetPassword(recoveryEmail));
              }}>
                <div><KeyRound aria-hidden="true" /><span><strong>Reset your password</strong><small>Enter the email attached to the account.</small></span></div>
                <label><span>Email</span><input type="email" autoComplete="email" value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} required /></label>
                <div><button type="submit" disabled={account.busy || !recoveryEmail.includes('@')}>Send reset link</button><button type="button" onClick={() => setRecoveryOpen(false)}>Cancel</button></div>
              </form>
            )}
            <p className="account-trust-note"><ShieldCheck aria-hidden="true" /> Your account controls only your profile, favorites, and created plays. Team statistics remain source-verified.</p>
          </div>
        )}

        {account.configured && account.user && !account.passwordRecovery && (
          <div className="account-session">
            <div className="account-identity">
              <div className="account-avatar" aria-hidden="true">{account.displayName.slice(0, 1).toUpperCase()}</div>
              <div><strong>{account.displayName}</strong><span>{account.user.email}</span></div>
              <span className="account-role"><ShieldCheck aria-hidden="true" /> {roleLabel(account.profile?.role)}</span>
            </div>

            <button type="button" className="account-profile-entry" onClick={openProfile}>
              <span className="account-profile-entry-icon"><CheckCircle2 aria-hidden="true" /></span>
              <span><strong>Open my profile</strong><small>{linkedClaims ? `${linkedClaims} approved player profile${linkedClaims === 1 ? '' : 's'}` : pendingClaims ? 'Player profile request awaiting review' : 'Request your squad player profile'}</small></span>
              <ArrowRight aria-hidden="true" />
            </button>

            {account.profile?.role === 'admin' && (
              <button type="button" className="account-profile-entry" onClick={openAdmin}>
                <span className="account-profile-entry-icon"><Users aria-hidden="true" /></span>
                <span><strong>Manage team accounts</strong><small>Access, player links, roles, password help, and account controls</small></span>
                <ArrowRight aria-hidden="true" />
              </button>
            )}

            <div className="account-sync-summary">
              <Cloud aria-hidden="true" />
              <div><strong>{favorites.size}</strong><span>saved plays</span></div>
              <p>Favorites and Create ownership follow this account across devices.</p>
            </div>

            <form className="account-profile-form" onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              submit(() => account.saveProfile({ displayName: formData.get('displayName'), username: username || account.username }));
            }}>
              <label><span>Display name</span><input key={account.displayName} name="displayName" defaultValue={account.displayName === 'Guest' ? '' : account.displayName} maxLength="80" required /></label>
              <UsernameField account={account} currentUsername={account.username} id="dialog-profile-username" value={username || account.username || normalizeUsername(account.displayName)} onChange={setUsername} onAvailabilityChange={(available, checkedUsername) => setVerifiedUsername(available ? checkedUsername : '')} />
              <button type="submit" disabled={account.busy || !isValidUsername(username || account.username || normalizeUsername(account.displayName)) || ((username || account.username) !== account.username && verifiedUsername !== username)}>Update account</button>
            </form>

            <button type="button" className="account-signout" disabled={account.busy} onClick={() => submit(account.signOut)}><LogOut aria-hidden="true" /> Sign out</button>
          </div>
        )}

        {account.status && (
          <p
            className="account-status"
            data-tone={account.statusTone || 'info'}
            role={account.statusTone === 'error' ? 'alert' : 'status'}
          >
            {account.status}
          </p>
        )}
      </section>
    </div>
  );
}
