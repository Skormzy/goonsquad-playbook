import { createElement, useMemo, useState } from 'react';
import {
  Check,
  Database,
  HelpCircle,
  LoaderCircle,
  Search,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';
import {
  attendanceAccessLabel,
  attendanceGrantMatches,
  leagueEpDirectory,
  memberScheduleLabels,
} from './attendanceModel';
import {
  addGameEp,
  grantAttendanceAccess,
  removeGameEp,
  revokeAttendanceAccess,
  updateGameEp,
} from './lineupCloud';

const MODES = Object.freeze([
  { id: 'accounts', label: 'Accounts', Icon: UsersRound },
  { id: 'league', label: 'League records', Icon: Database },
  { id: 'new', label: 'New EP', Icon: UserPlus },
]);

const EP_RESPONSES = Object.freeze([
  { id: 'in', label: 'In', Icon: Check },
  { id: 'maybe', label: 'Maybe', Icon: HelpCircle },
  { id: 'out', label: 'Out', Icon: X },
]);

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

function matchesQuery(query, ...values) {
  const needle = normalized(query);
  return !needle || values.some((value) => normalized(value).includes(needle));
}

function ResultButton({ disabled, label, meta, onClick, source }) {
  return (
    <button type="button" className="attendance-ep-result" disabled={disabled} onClick={onClick}>
      <span className="attendance-ep-result-mark">{label?.slice(0, 1).toUpperCase() || '?'}</span>
      <span><strong>{label}</strong><small>{meta}</small></span>
      <b>{source}</b>
      <UserPlus aria-hidden="true" />
    </button>
  );
}

export default function EpManager({
  accessConfigured,
  actorId,
  dataset,
  epConfigured,
  epPlayers,
  fixture,
  grants,
  members,
  onAccessChanged,
  onEpChanged,
  participants,
  qaMode,
}) {
  const [mode, setMode] = useState('accounts');
  const [query, setQuery] = useState('');
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');
  const [manual, setManual] = useState({ displayName: '', jerseyNumber: '', position: '' });
  const participantIds = useMemo(
    () => new Set(participants.filter((member) => !member.trackingOnly).map((member) => member.id)),
    [participants],
  );
  const fixtureGrants = grants.filter((grant) => attendanceGrantMatches(grant, fixture));
  const grantedMembers = fixtureGrants
    .map((grant) => ({ grant, member: members.find((member) => member.id === grant.userId) }))
    .filter((entry) => entry.member);
  const accountCandidates = members
    .filter((member) => !participantIds.has(member.id))
    .filter((member) => matchesQuery(
      query,
      member.displayName,
      member.username,
      memberScheduleLabels(dataset, member).join(' '),
    ))
    .slice(0, 10);
  const directory = useMemo(() => leagueEpDirectory({
    dataset,
    members,
    fixture,
    excludedPlayerIds: epPlayers.map((player) => player.playerId),
  }), [dataset, epPlayers, fixture, members]);
  const leagueCandidates = directory
    .filter((player) => matchesQuery(
      query,
      player.displayName,
      player.rosterLabel,
      player.position,
      player.jerseyNumber,
    ))
    .slice(0, 12);
  const scopeType = fixture.kind === 'tournament' ? 'tournament' : 'fixture';
  const scopeId = fixture.kind === 'tournament' ? fixture.tournamentId : fixture.id;

  const run = async (key, action, successMessage) => {
    if (working) return;
    setWorking(key);
    setMessage('');
    try {
      await action();
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That EP change could not be saved.');
    } finally {
      setWorking('');
    }
  };

  const addAccount = (member) => run(
    `account:${member.id}`,
    async () => {
      if (!qaMode) {
        await grantAttendanceAccess({
          scopeType,
          scopeId,
          userId: member.id,
          assignedBy: actorId,
        });
      }
      await onAccessChanged({
        optimisticGrant: qaMode ? {
          scopeType,
          scopeId,
          userId: member.id,
          assignedBy: actorId,
        } : null,
      });
    },
    `${member.displayName} added as an EP with their account.`,
  );

  const removeAccount = ({ grant, member }) => run(
    `remove-account:${member.id}`,
    async () => {
      if (!qaMode) {
        await revokeAttendanceAccess({
          scopeType: grant.scopeType,
          scopeId: grant.scopeId,
          userId: member.id,
        });
      }
      await onAccessChanged({ optimisticRemoval: qaMode ? grant : null });
    },
    `${member.displayName} removed from this EP list.`,
  );

  const addLeaguePlayer = (player) => run(
    `league:${player.id}`,
    async () => {
      const optimisticPlayer = {
        id: `ep:${player.id}`,
        playerId: player.id,
        playerExternalId: player.externalId,
        displayName: player.displayName,
        jerseyNumber: player.jerseyNumber,
        position: player.position,
        sourceUrl: player.sourceUrl,
        response: 'in',
        entrySource: 'league',
        attendanceRole: 'EP',
        trackingOnly: true,
      };
      if (!qaMode) {
        await addGameEp({
          fixtureId: fixture.id,
          playerExternalId: player.externalId,
          displayName: player.displayName,
          jerseyNumber: player.jerseyNumber,
          position: player.position,
          sourceUrl: player.sourceUrl,
          entrySource: 'league',
          response: 'in',
        });
      }
      await onEpChanged({ optimisticAdd: qaMode ? optimisticPlayer : null });
    },
    `${player.displayName} added as a tracking-only EP.`,
  );

  const createManual = () => {
    const displayName = manual.displayName.trim();
    if (!displayName) {
      setMessage('Enter the EP name first.');
      return;
    }
    run(
      'manual:new',
      async () => {
        const optimisticId = `manual-${Date.now()}`;
        const optimisticPlayer = {
          id: `ep:${optimisticId}`,
          playerId: optimisticId,
          displayName,
          jerseyNumber: manual.jerseyNumber.trim(),
          position: manual.position,
          response: 'in',
          entrySource: 'manual',
          attendanceRole: 'EP',
          trackingOnly: true,
        };
        if (!qaMode) {
          await addGameEp({
            fixtureId: fixture.id,
            displayName,
            jerseyNumber: manual.jerseyNumber,
            position: manual.position,
            entrySource: 'manual',
            response: 'in',
          });
        }
        await onEpChanged({ optimisticAdd: qaMode ? optimisticPlayer : null });
        setManual({ displayName: '', jerseyNumber: '', position: '' });
      },
      `${displayName} created as a tracking-only EP.`,
    );
  };

  const setResponse = (player, response) => run(
    `response:${player.playerId}:${response}`,
    async () => {
      if (!qaMode) {
        await updateGameEp({
          fixtureId: fixture.id,
          playerId: player.playerId,
          response,
          note: player.note,
        });
      }
      await onEpChanged({
        optimisticUpdate: qaMode ? { playerId: player.playerId, response } : null,
      });
    },
    `${player.displayName} marked ${response}.`,
  );

  const removeTrackingPlayer = (player) => run(
    `remove-ep:${player.playerId}`,
    async () => {
      if (!qaMode) await removeGameEp({ fixtureId: fixture.id, playerId: player.playerId });
      await onEpChanged({ optimisticRemoval: qaMode ? player.playerId : null });
    },
    `${player.displayName} removed from this EP list.`,
  );

  const modeConfigured = qaMode || (mode === 'accounts' ? accessConfigured : epConfigured);
  const setupMessage = mode === 'accounts'
    ? 'Account-backed EP access is finishing setup. Run the scoped-attendance migration, then refresh.'
    : 'League-record EPs are finishing setup. Run the game EP migration, then refresh.';

  return (
    <details className="attendance-access-manager">
      <summary>
        <UserPlus aria-hidden="true" />
        <span><strong>Manage EPs</strong><small>{attendanceAccessLabel(fixture)}</small></span>
        <b>{grantedMembers.length + epPlayers.length}</b>
      </summary>
      <div className="attendance-access-manager-body">
        {!modeConfigured && (
          <p className="attendance-access-message is-warning">{setupMessage}</p>
        )}

        <div className="attendance-ep-modes" role="tablist" aria-label="Choose EP source">
          {MODES.map(({ id, label, Icon }) => (
            <button type="button" role="tab" aria-selected={mode === id} key={id} onClick={() => { setMode(id); setMessage(''); }}>
              {createElement(Icon, { 'aria-hidden': 'true' })} {label}
            </button>
          ))}
        </div>

        {mode !== 'new' && (
          <label className="attendance-ep-search">
            <span className="sr-only">Search {mode === 'accounts' ? 'member accounts' : 'league player records'}</span>
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={mode === 'accounts' ? 'Search team accounts' : 'Search league player records'}
              disabled={!modeConfigured}
            />
          </label>
        )}

        {mode === 'accounts' && (
          <div className="attendance-ep-results" aria-label="Account-backed EP candidates">
            {accountCandidates.map((member) => (
              <ResultButton
                key={member.id}
                label={member.displayName}
                meta={[member.username ? `@${member.username}` : '', ...memberScheduleLabels(dataset, member)].filter(Boolean).join(' · ')}
                source="ACCOUNT"
                disabled={!modeConfigured || Boolean(working)}
                onClick={() => addAccount(member)}
              />
            ))}
            {!accountCandidates.length && <p>No matching accounts available.</p>}
          </div>
        )}

        {mode === 'league' && (
          <div className="attendance-ep-results" aria-label="League player EP candidates">
            {leagueCandidates.map((player) => (
              <ResultButton
                key={player.id}
                label={player.displayName}
                meta={[
                  player.fixtureRostered ? 'Current roster record' : player.rosterLabel,
                  player.position,
                  player.jerseyNumber ? `#${player.jerseyNumber}` : '',
                ].filter(Boolean).join(' · ')}
                source="LEAGUE"
                disabled={!modeConfigured || Boolean(working)}
                onClick={() => addLeaguePlayer(player)}
              />
            ))}
            {!leagueCandidates.length && <p>No matching league records available. Create a new EP instead.</p>}
          </div>
        )}

        {mode === 'new' && (
          <div className="attendance-ep-create">
            <label><span>Player name</span><input value={manual.displayName} maxLength={100} onChange={(event) => setManual((value) => ({ ...value, displayName: event.target.value }))} placeholder="Full name" disabled={!modeConfigured} /></label>
            <label><span>Number</span><input value={manual.jerseyNumber} inputMode="numeric" maxLength={3} onChange={(event) => setManual((value) => ({ ...value, jerseyNumber: event.target.value.replace(/\D/gu, '') }))} placeholder="Optional" disabled={!modeConfigured} /></label>
            <label><span>Position</span><select value={manual.position} onChange={(event) => setManual((value) => ({ ...value, position: event.target.value }))} disabled={!modeConfigured}><option value="">Optional</option><option value="G">Goalie</option><option value="D">Defence</option><option value="C">Center</option><option value="W">Winger</option></select></label>
            <button type="button" onClick={createManual} disabled={!modeConfigured || !manual.displayName.trim() || Boolean(working)}>
              {working === 'manual:new' ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
              Create and add EP
            </button>
            <p>This creates a private attendance card, not an app account.</p>
          </div>
        )}

        {(grantedMembers.length > 0 || epPlayers.length > 0) && (
          <div className="attendance-ep-active" aria-label="EPs on this game">
            <h3>Game EPs <span>{grantedMembers.length + epPlayers.length}</span></h3>
            {grantedMembers.map(({ grant, member }) => (
              <article key={`${grant.scopeType}:${grant.scopeId}:${member.id}`}>
                <span className="attendance-ep-result-mark">{member.displayName?.slice(0, 1).toUpperCase()}</span>
                <span><strong>{member.displayName}</strong><small>EP · Account · answers for themselves</small></span>
                <button type="button" className="attendance-ep-remove" aria-label={`Remove ${member.displayName}`} title="Remove EP" disabled={Boolean(working)} onClick={() => removeAccount({ grant, member })}>
                  {working === `remove-account:${member.id}` ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
                </button>
              </article>
            ))}
            {epPlayers.map((player) => (
              <article key={player.playerId}>
                <span className="attendance-ep-result-mark">{player.displayName?.slice(0, 1).toUpperCase()}</span>
                <span><strong>{player.displayName}</strong><small>EP · {player.entrySource === 'manual' ? 'Tracking card' : 'League record'}{player.position ? ` · ${player.position}` : ''}{player.jerseyNumber ? ` · #${player.jerseyNumber}` : ''}</small></span>
                <div className="attendance-ep-response" role="group" aria-label={`${player.displayName} attendance`}>
                  {EP_RESPONSES.map(({ id, label, Icon }) => (
                    <button type="button" key={id} aria-pressed={player.response === id} data-response={id} title={label} disabled={Boolean(working)} onClick={() => setResponse(player, id)}>
                      {createElement(Icon, { 'aria-hidden': 'true' })}<span>{label}</span>
                    </button>
                  ))}
                </div>
                <button type="button" className="attendance-ep-remove" aria-label={`Remove ${player.displayName}`} title="Remove EP" disabled={Boolean(working)} onClick={() => removeTrackingPlayer(player)}>
                  {working === `remove-ep:${player.playerId}` ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
                </button>
              </article>
            ))}
          </div>
        )}

        {message && <p className="attendance-access-message" role="status">{message}</p>}
      </div>
    </details>
  );
}
