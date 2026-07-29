import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react';
import {
  deleteManagedAccount,
  loadManagedAccounts,
  sendManagedAccountPasswordReset,
  setManagedAccountSuspension,
  updateManagedAccount,
} from './accountAdmin';
import { isValidUsername, normalizeUsername } from './username';

function roleLabel(account) {
  if (account.isOwner) return 'Owner';
  if (account.role === 'admin') return 'Admin';
  if (account.role === 'stat_manager') return 'Stats manager';
  return 'Member';
}

function formatActivity(value) {
  if (!value) return 'Never signed in';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Never signed in';
  return `Active ${new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  }).format(date)}`;
}

export default function AccountAdminPanel({ onClose }) {
  const [accounts, setAccounts] = useState([]);
  const [permissions, setPermissions] = useState({ isOwner: false });
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [deleteArmed, setDeleteArmed] = useState(false);

  const applySnapshot = (snapshot) => {
    setAccounts(snapshot.accounts || []);
    setPermissions(snapshot.permissions || { isOwner: false });
    if (selectedId) {
      const selected = (snapshot.accounts || []).find((account) => account.id === selectedId);
      setDraft(selected ? { ...selected } : null);
      if (!selected) setSelectedId('');
    }
  };

  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      applySnapshot(await loadManagedAccounts());
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // The console owns its refresh lifecycle while mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleAccounts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return accounts;
    return accounts.filter((account) => (
      account.displayName.toLowerCase().includes(needle)
      || account.username.toLowerCase().includes(needle)
      || account.email.toLowerCase().includes(needle)
      || roleLabel(account).toLowerCase().includes(needle)
    ));
  }, [accounts, query]);

  const summary = useMemo(() => ({
    total: accounts.length,
    admins: accounts.filter((account) => account.role === 'admin').length,
    pending: accounts.filter((account) => !account.emailConfirmed).length,
  }), [accounts]);

  const selectAccount = (account) => {
    setSelectedId(account.id);
    setDraft({ ...account });
    setDeleteArmed(false);
    setStatus('');
    setError('');
  };

  const runAction = async (key, operation, successMessage) => {
    setWorking(key);
    setStatus('');
    setError('');
    try {
      const snapshot = await operation();
      if (snapshot?.accounts) applySnapshot(snapshot);
      setStatus(successMessage);
      setDeleteArmed(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorking('');
    }
  };

  const canEditRole = Boolean(
    draft
    && permissions.isOwner
    && !draft.isOwner,
  );
  const draftReady = Boolean(
    draft?.displayName.trim()
    && isValidUsername(draft?.username)
    && !working,
  );

  return (
    <section className="account-admin" aria-labelledby="account-admin-title">
      <header className="account-admin-header">
        <button type="button" className="account-admin-back" onClick={onClose}>
          <ArrowLeft aria-hidden="true" /> Account
        </button>
        <div>
          <span>TEAM ACCESS</span>
          <h2 id="account-admin-title">Member administration</h2>
          <p>Manage who can access team tools without handling anyone&apos;s password.</p>
        </div>
        <button
          type="button"
          className="account-admin-refresh"
          onClick={refresh}
          disabled={loading || Boolean(working)}
          aria-label="Refresh member accounts"
          title="Refresh"
        >
          <RefreshCcw aria-hidden="true" />
        </button>
      </header>

      <div className="account-admin-summary" aria-label="Account summary">
        <div><Users aria-hidden="true" /><strong>{summary.total}</strong><span>Accounts</span></div>
        <div><ShieldCheck aria-hidden="true" /><strong>{summary.admins}</strong><span>Admins</span></div>
        <div><CheckCircle2 aria-hidden="true" /><strong>{summary.pending}</strong><span>Awaiting email</span></div>
      </div>

      {error && <p className="account-admin-notice" data-tone="error" role="alert">{error}</p>}
      {status && <p className="account-admin-notice" data-tone="success" role="status">{status}</p>}

      {draft && (
        <form
          className="account-admin-editor"
          onSubmit={(event) => {
            event.preventDefault();
            runAction('save', () => updateManagedAccount({
              ...draft,
              username: normalizeUsername(draft.username),
            }), 'Member account updated.');
          }}
        >
          <div className="account-admin-editor-heading">
            <div className="account-admin-member-mark" aria-hidden="true">
              {(draft.displayName || draft.username || '?').slice(0, 1).toUpperCase()}
            </div>
            <div><span>MANAGE MEMBER</span><strong>{draft.displayName || draft.email}</strong><small>{draft.email}</small></div>
            <button type="button" onClick={() => { setDraft(null); setSelectedId(''); }}>Close</button>
          </div>
          <div className="account-admin-editor-fields">
            <label>
              <span>Display name</span>
              <input
                type="text"
                maxLength="80"
                value={draft.displayName}
                onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
                required
              />
            </label>
            <label>
              <span>Username</span>
              <div className="account-admin-username">
                <span aria-hidden="true">@</span>
                <input
                  type="text"
                  autoComplete="off"
                  maxLength="24"
                  value={draft.username}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    username: normalizeUsername(event.target.value),
                  }))}
                  required
                />
              </div>
            </label>
            <label>
              <span>Access level</span>
              <select
                value={draft.role}
                disabled={!canEditRole}
                onChange={(event) => setDraft((current) => ({ ...current, role: event.target.value }))}
              >
                <option value="member">Member</option>
                <option value="stat_manager">Stats manager</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </div>
          <div className="account-admin-editor-actions">
            <button type="submit" className="is-primary" disabled={!draftReady}>
              {working === 'save' ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <Save aria-hidden="true" />}
              Save changes
            </button>
            <button
              type="button"
              disabled={Boolean(working)}
              onClick={() => runAction(
                'reset',
                () => sendManagedAccountPasswordReset(draft.id),
                `Password reset sent to ${draft.email}.`,
              )}
            >
              <KeyRound aria-hidden="true" /> Send reset
            </button>
            <button
              type="button"
              disabled={Boolean(working) || draft.isOwner}
              onClick={() => runAction(
                'suspend',
                () => setManagedAccountSuspension(draft.id, !draft.suspended),
                draft.suspended ? 'Member access restored.' : 'Member access suspended.',
              )}
            >
              {draft.suspended ? <CheckCircle2 aria-hidden="true" /> : <Ban aria-hidden="true" />}
              {draft.suspended ? 'Restore access' : 'Suspend'}
            </button>
            {!deleteArmed ? (
              <button
                type="button"
                className="is-danger"
                disabled={Boolean(working) || draft.isOwner}
                onClick={() => setDeleteArmed(true)}
              >
                <Trash2 aria-hidden="true" /> Delete
              </button>
            ) : (
              <button
                type="button"
                className="is-danger is-confirm"
                disabled={Boolean(working)}
                onClick={() => runAction(
                  'delete',
                  () => deleteManagedAccount(draft.id),
                  'Member account deleted.',
                )}
              >
                <Trash2 aria-hidden="true" /> Confirm delete
              </button>
            )}
          </div>
          {!permissions.isOwner && (
            <small className="account-admin-owner-note">The account owner controls admin promotions.</small>
          )}
        </form>
      )}

      <div className="account-admin-directory">
        <label className="account-admin-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Search members</span>
          <input
            type="search"
            placeholder="Search members"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        {loading ? (
          <div className="account-admin-loading"><LoaderCircle className="is-spinning" aria-hidden="true" /> Loading member accounts</div>
        ) : (
          <div className="account-admin-table" role="table" aria-label="Member accounts">
            <div className="account-admin-table-head" role="row">
              <span role="columnheader">Member</span>
              <span role="columnheader">Access</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Action</span>
            </div>
            {visibleAccounts.map((member) => (
              <div className="account-admin-table-row" role="row" key={member.id} data-selected={selectedId === member.id}>
                <div role="cell">
                  <strong>{member.displayName || member.username}</strong>
                  <small>@{member.username} · {member.email}</small>
                </div>
                <span className="account-admin-role" role="cell" data-role={member.isOwner ? 'owner' : member.role}>
                  {roleLabel(member)}
                </span>
                <div role="cell">
                  <strong>{member.suspended ? 'Suspended' : member.emailConfirmed ? 'Active' : 'Email pending'}</strong>
                  <small>{formatActivity(member.lastSignInAt)}</small>
                </div>
                <button type="button" role="cell" onClick={() => selectAccount(member)}>
                  <UserCog aria-hidden="true" /> Manage
                </button>
              </div>
            ))}
            {!visibleAccounts.length && (
              <div className="account-admin-empty">No member accounts match that search.</div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
