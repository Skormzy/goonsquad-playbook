import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Ban,
  CheckCircle2,
  CircleX,
  ExternalLink,
  KeyRound,
  Link2,
  LoaderCircle,
  RefreshCcw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Unlink,
  UserCog,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import {
  assignManagedPlayer,
  deleteManagedAccount,
  loadManagedAccounts,
  reviewManagedPlayerClaim,
  sendManagedAccountPasswordReset,
  setManagedAccountSuspension,
  unlinkManagedPlayer,
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
  const [claims, setClaims] = useState([]);
  const [players, setPlayers] = useState([]);
  const [permissions, setPermissions] = useState({ isOwner: false });
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [assignmentPlayerId, setAssignmentPlayerId] = useState('');
  const [confirmation, setConfirmation] = useState(null);

  const applySnapshot = (snapshot) => {
    setAccounts(snapshot.accounts || []);
    setClaims(snapshot.claims || []);
    setPlayers(snapshot.players || []);
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
    pending: claims.filter((claim) => claim.status === 'pending').length,
  }), [accounts, claims]);

  const pendingClaims = useMemo(
    () => claims.filter((claim) => claim.status === 'pending'),
    [claims],
  );

  const selectedClaims = useMemo(
    () => claims.filter((claim) => claim.userId === draft?.id && claim.status === 'approved'),
    [claims, draft?.id],
  );

  const assignablePlayers = useMemo(() => players.filter((player) => (
    !player.linked || selectedClaims.some((claim) => claim.playerId === player.id)
  )), [players, selectedClaims]);

  const assignmentPlayer = useMemo(
    () => players.find((player) => player.id === assignmentPlayerId) || null,
    [assignmentPlayerId, players],
  );

  const selectAccount = (account) => {
    setSelectedId(account.id);
    setDraft({ ...account });
    setDeleteArmed(false);
    setAssignmentPlayerId('');
    setConfirmation(null);
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
      setAssignmentPlayerId('');
      setConfirmation(null);
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

  const approveClaim = (claim) => {
    const competing = pendingClaims.filter((candidate) => (
      candidate.playerId === claim.playerId && candidate.userId !== claim.userId
    )).length;
    const operation = () => reviewManagedPlayerClaim(claim.userId, claim.playerId, 'approved');
    const successMessage = `${claim.player?.displayName || 'Player profile'} linked to ${claim.member?.displayName || 'member'}.`;
    if (!competing) {
      runAction(`approve:${claim.userId}:${claim.playerId}`, operation, successMessage);
      return;
    }
    setConfirmation({
      key: `approve:${claim.userId}:${claim.playerId}`,
      title: `Approve ${claim.member?.displayName || 'this member'}?`,
      detail: `This will deny ${competing} competing request${competing === 1 ? '' : 's'} for ${claim.player?.displayName || 'the same player profile'}.`,
      confirmLabel: 'Approve and resolve',
      operation,
      successMessage,
    });
  };

  const confirmAssignment = () => {
    if (!draft || !assignmentPlayer) return;
    const memberPending = pendingClaims.filter((claim) => claim.userId === draft.id).length;
    const details = [
      selectedClaims.some((claim) => claim.primary) ? 'replace the current primary player' : '',
      memberPending ? `resolve ${memberPending} pending request${memberPending === 1 ? '' : 's'}` : '',
    ].filter(Boolean);
    setConfirmation({
      key: `assign:${draft.id}:${assignmentPlayer.id}`,
      title: `Assign ${assignmentPlayer.displayName} to ${draft.displayName || draft.username}?`,
      detail: details.length
        ? `This will ${details.join(' and ')}. Historical approved records remain available.`
        : 'This links the official player statistics to this account immediately.',
      confirmLabel: 'Assign player',
      operation: () => assignManagedPlayer(draft.id, assignmentPlayer.id),
      successMessage: 'Player profile assigned.',
    });
  };

  const confirmUnlink = (claim) => {
    if (!draft) return;
    setConfirmation({
      key: `unlink:${draft.id}:${claim.playerId}`,
      title: `Unlink ${claim.player?.displayName || 'this player profile'}?`,
      detail: `The official statistics remain intact, but they will no longer appear on ${draft.displayName || draft.username}'s profile.`,
      confirmLabel: 'Unlink player',
      operation: () => unlinkManagedPlayer(draft.id, claim.playerId),
      successMessage: 'Player profile unlinked.',
    });
  };

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
        <div><UserRoundCheck aria-hidden="true" /><strong>{summary.pending}</strong><span>Profile requests</span></div>
      </div>

      {error && <p className="account-admin-notice" data-tone="error" role="alert">{error}</p>}
      {status && <p className="account-admin-notice" data-tone="success" role="status">{status}</p>}
      {confirmation && (
        <section className="account-admin-confirmation" role="alertdialog" aria-labelledby="account-admin-confirmation-title">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong id="account-admin-confirmation-title">{confirmation.title}</strong>
            <small>{confirmation.detail}</small>
          </div>
          <div>
            <button type="button" disabled={Boolean(working)} onClick={() => setConfirmation(null)}>Cancel</button>
            <button
              type="button"
              className="is-confirm"
              disabled={Boolean(working)}
              onClick={() => runAction(
                confirmation.key,
                confirmation.operation,
                confirmation.successMessage,
              )}
            >
              {working === confirmation.key && <LoaderCircle className="is-spinning" aria-hidden="true" />}
              {confirmation.confirmLabel}
            </button>
          </div>
        </section>
      )}

      {pendingClaims.length > 0 && (
        <section className="account-admin-claims" aria-labelledby="account-admin-claims-title">
          <header>
            <div>
              <Link2 aria-hidden="true" />
              <span>
                <strong id="account-admin-claims-title">Player profile requests</strong>
                <small>Confirm that each member selected their own squad record.</small>
              </span>
            </div>
            <span>{pendingClaims.length} WAITING</span>
          </header>
          <div>
            {pendingClaims.map((claim) => (
              <article key={`${claim.userId}:${claim.playerId}`}>
                <span className="account-admin-member-mark" aria-hidden="true">
                  {(claim.member?.displayName || claim.member?.username || '?').slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>{claim.member?.displayName || claim.member?.username || 'Member'}</strong>
                  <small>
                    @{claim.member?.username || 'member'} · {claim.member?.email || 'email unavailable'}
                  </small>
                  <small>
                    Wants {claim.player?.displayName || 'a player profile'}
                    {claim.player?.jerseyNumber ? ` #${claim.player.jerseyNumber}` : ''}
                    {claim.player?.rosterLabel ? ` · ${claim.player.rosterLabel}` : ''}
                    {claim.player?.externalId ? ` · League ID ${claim.player.externalId}` : ''}
                  </small>
                </div>
                {claim.player?.sourceUrl && (
                  <a
                    className="account-admin-claim-source"
                    href={claim.player.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Official profile <ExternalLink aria-hidden="true" />
                  </a>
                )}
                <div>
                  <button
                    type="button"
                    className="is-approve"
                    disabled={Boolean(working)}
                    onClick={() => approveClaim(claim)}
                  >
                    <BadgeCheck aria-hidden="true" /> Approve
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(working)}
                    onClick={() => runAction(
                      `reject:${claim.userId}:${claim.playerId}`,
                      () => reviewManagedPlayerClaim(claim.userId, claim.playerId, 'rejected'),
                      'Player profile request denied.',
                    )}
                  >
                    <CircleX aria-hidden="true" /> Deny
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

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
          <section className="account-admin-player-assignment">
            <header>
              <Link2 aria-hidden="true" />
              <span>
                <strong>Player profile</strong>
                <small>Assign this member directly or replace their primary player.</small>
              </span>
            </header>
            {selectedClaims.length > 0 && (
              <div className="account-admin-player-links">
                {selectedClaims.map((claim) => (
                  <span key={claim.playerId}>
                    <strong>
                      {claim.player?.displayName || 'Player record'}
                      {claim.player?.jerseyNumber ? ` #${claim.player.jerseyNumber}` : ''}
                    </strong>
                    <small>{claim.primary ? 'Primary profile' : 'Linked history'}</small>
                    {claim.player?.rosterLabel && <small>{claim.player.rosterLabel}</small>}
                    <button
                      type="button"
                      disabled={Boolean(working)}
                      aria-label={`Unlink ${claim.player?.displayName || 'player profile'}`}
                      title="Unlink player profile"
                      onClick={() => confirmUnlink(claim)}
                    >
                      <Unlink aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="account-admin-player-picker">
              <label>
                <span>Assign squad player</span>
                <select
                  value={assignmentPlayerId}
                  onChange={(event) => setAssignmentPlayerId(event.target.value)}
                >
                  <option value="">Choose a player</option>
                  {assignablePlayers.map((player) => (
                    <option value={player.id} key={player.id}>
                      {player.displayName}
                      {player.jerseyNumber ? ` #${player.jerseyNumber}` : ''}
                      {player.position ? ` · ${player.position}` : ''}
                      {player.rosterLabel ? ` · ${player.rosterLabel}` : ''}
                      {player.externalId ? ` · ID ${player.externalId}` : ''}
                      {player.active ? '' : ' · historical'}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="is-primary"
                disabled={Boolean(working) || !assignmentPlayerId}
                onClick={confirmAssignment}
              >
                <UserRoundCheck aria-hidden="true" /> Assign player
              </button>
            </div>
            {assignmentPlayer && (
              <div className="account-admin-player-preview">
                <div>
                  <strong>{assignmentPlayer.displayName}</strong>
                  <small>
                    {assignmentPlayer.rosterLabel || 'No season context'}
                    {assignmentPlayer.externalId ? ` · League ID ${assignmentPlayer.externalId}` : ''}
                  </small>
                </div>
                {assignmentPlayer.sourceUrl && (
                  <a href={assignmentPlayer.sourceUrl} target="_blank" rel="noreferrer">
                    Verify official profile <ExternalLink aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
          </section>
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
                  <small>
                    {claims.some((claim) => claim.userId === member.id && claim.status === 'approved')
                      ? 'Player linked'
                      : formatActivity(member.lastSignInAt)}
                  </small>
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
