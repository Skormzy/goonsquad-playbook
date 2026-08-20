import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  CalendarClock,
  Camera,
  ChevronRight,
  CircleUserRound,
  ExternalLink,
  Hash,
  History,
  Link2,
  Layers3,
  LoaderCircle,
  LogIn,
  Medal,
  Trash2,
  RefreshCcw,
  Search,
  Save,
  Settings2,
  ShieldCheck,
  Target,
  TrendingUp,
  Trophy,
  Unlink,
  UserRoundCheck,
  UsersRound,
  X,
} from 'lucide-react';
import { useAccount } from '../account/AccountContext';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import {
  formatGameDate,
  formatLeagueName,
  formatLeagueScheduleName,
  formatPercentage,
} from '../stats/statsModel';
import { loadStatisticsDataset } from '../stats/statsCloud';
import { loadTournamentArchive } from '../stats/tournamentCloud';
import { TOURNAMENT_ARCHIVE } from '../stats/tournamentModel';
import {
  COMPETITION_SCOPE_META,
  COMPETITION_SCOPE_ORDER,
} from '../stats/competitionScopeModel';
import { memberProfileSnapshot, playerRosterCandidates } from './profileModel';
import OfficialSocialLinks from '../brand/OfficialSocialLinks';
import './profile.css';

function positionLabel(position) {
  if (position === 'G') return 'Goalie';
  if (['D', 'LD', 'RD'].includes(position)) return 'Defence';
  if (position === 'C') return 'Center';
  if (['W', 'LW', 'RW'].includes(position)) return 'Winger';
  return 'Team member';
}

function linkCopy() {
  return { label: 'Player profile linked', detail: 'Your account is linked to your Goonsquad player record. An admin can update this assignment at any time.' };
}

function ProfileMetric({ detail, label, value }) {
  return <div className="profile-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function CompetitionIcon({ scopeId }) {
  if (scopeId === 'regular') return <CalendarDays aria-hidden="true" />;
  if (scopeId === 'playoffs') return <ShieldCheck aria-hidden="true" />;
  if (scopeId === 'tournaments') return <Trophy aria-hidden="true" />;
  return <Layers3 aria-hidden="true" />;
}

function eventCountLabel(scopeId, count) {
  const singular = scopeId === 'tournaments'
    ? 'tournament'
    : scopeId === 'playoffs'
      ? 'postseason'
      : scopeId === 'all'
        ? 'entry'
        : 'season';
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function historyContext(row) {
  const parts = [];
  if (row.competition === 'tournaments') {
    parts.push('Tournament');
  } else if (!row.schedules?.length) {
    const league = formatLeagueName(row.season);
    if (league && league !== 'League archive') parts.push(league);
  }
  if (row.schedules?.length) parts.push(row.schedules.join(' / '));
  if (row.competition === 'playoffs') parts.push('Playoffs');
  if (row.competition === 'regular') parts.push('Regular season');
  return parts.join(' · ') || 'Goonsquad';
}

function RosterPicker({ account, claims, requests = [], dataset, onClose, onLinked, open }) {
  const [query, setQuery] = useState('');
  const [includeHistory, setIncludeHistory] = useState(false);
  if (!open) return null;
  const claimedExternalIds = new Set(
    [...claims, ...requests.filter((request) => request.status === 'pending')]
      .map((claim) => claim.player?.externalId)
      .filter(Boolean),
  );
  const candidates = playerRosterCandidates(dataset, { includeHistory, query })
    .filter((candidate) => !claimedExternalIds.has(candidate.externalId))
    .slice(0, query ? 40 : 24);

  return (
    <section className="profile-roster-picker" aria-labelledby="profile-roster-picker-title">
      <header>
        <div><span>REQUEST PLAYER PROFILE</span><h2 id="profile-roster-picker-title">Find yourself on the squad</h2><p>Choose your player record. A team admin will confirm the link before statistics appear on your profile.</p></div>
        {onClose && <button type="button" onClick={onClose} aria-label="Close player selector" title="Close"><X aria-hidden="true" /></button>}
      </header>
      <div className="profile-roster-tools">
        <label><Search aria-hidden="true" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search player name" aria-label="Search squad players" /></label>
        <button type="button" aria-pressed={includeHistory} onClick={() => setIncludeHistory((value) => !value)}><History aria-hidden="true" /> {includeHistory ? 'Current roster only' : 'Search all seasons'}</button>
      </div>
      <div className="profile-roster-results" role="list" aria-label="Squad players">
        {candidates.map((candidate) => (
          <button
            type="button"
            role="listitem"
            key={candidate.id}
            disabled={account.busy || !candidate.externalId}
            onClick={async () => {
              try {
                await account.claimPlayer({ playerId: candidate.cloudPlayerId, externalId: candidate.externalId });
                onLinked?.();
              } catch { /* AccountContext exposes the message. */ }
            }}
          >
            <span className="profile-roster-number">{candidate.jerseyNumber ? `#${candidate.jerseyNumber}` : candidate.displayName.slice(0, 1)}</span>
            <span><strong>{candidate.displayName}</strong><small>{positionLabel(candidate.position)} · {candidate.latestSeason}</small></span>
            <span className="profile-roster-meta">{candidate.current ? 'CURRENT' : `${candidate.seasonCount} SEASON${candidate.seasonCount === 1 ? '' : 'S'}`}</span>
            <ChevronRight aria-hidden="true" />
          </button>
        ))}
        {!candidates.length && <div className="profile-roster-empty"><UsersRound aria-hidden="true" /><strong>No matching squad record</strong><p>Check the spelling or search all seasons. A team manager can add a missing record.</p></div>}
      </div>
      {account.status && (
        <p
          className="profile-inline-status"
          data-tone={account.statusTone || 'info'}
          role={account.statusTone === 'error' ? 'alert' : 'status'}
        >
          {account.status}
        </p>
      )}
      <footer><Link2 aria-hidden="true" /><span>Your request goes to a team admin to match your account to the right player record.</span></footer>
    </section>
  );
}

function PlayerLinkRequest({ account, request }) {
  const pending = request.status === 'pending';
  return (
    <section className="profile-link-request" data-status={request.status}>
      <span className="profile-record-avatar" aria-hidden="true">
        {request.player?.displayName?.slice(0, 1) || '?'}
      </span>
      <div>
        <span>{pending ? 'AWAITING ADMIN REVIEW' : 'REQUEST NOT APPROVED'}</span>
        <strong>
          {request.player?.displayName || 'Squad player'}
          {request.player?.jerseyNumber ? ` #${request.player.jerseyNumber}` : ''}
        </strong>
        <small>
          {pending
            ? 'Home and Stats remain available. Squad Live, Plays, Strategy, and Create unlock after an admin confirms this is you.'
            : 'Remove this request, then choose the correct player record or ask an admin to assign it directly.'}
        </small>
      </div>
      <div className="profile-link-request-actions">
        {pending && (
          <button
            type="button"
            disabled={account.busy}
            onClick={() => account.refreshProfile()}
          >
            <RefreshCcw aria-hidden="true" /> Check status
          </button>
        )}
        <button
          type="button"
          disabled={account.busy}
          onClick={() => account.releasePlayer(request.playerId).catch(() => {})}
        >
          {pending ? 'Cancel request' : 'Remove request'}
        </button>
      </div>
    </section>
  );
}

function ProfileGate({ account, onAccount }) {
  return (
    <section className="profile-gate">
      <span className="profile-gate-icon"><CircleUserRound aria-hidden="true" /></span>
      <span>YOUR GOONSQUAD ID</span>
      <h1>{account.configured ? 'Sign in to request team access' : 'Team accounts are temporarily unavailable'}</h1>
      <p>{account.configured ? 'Home and public statistics are open to everyone. Link your squad player profile to unlock Squad Live, Plays, Strategy, and Create after admin approval.' : 'Public schedules, results, standings, and player statistics remain available in Stats.'}</p>
      <button type="button" onClick={onAccount}>{account.configured ? <><LogIn aria-hidden="true" /> Sign in or create account</> : <><Settings2 aria-hidden="true" /> View account status</>}</button>
    </section>
  );
}

export default function ProfileWorkspace() {
  const { theme, themes } = useTheme();
  const account = useAccount();
  const { favorites, setActiveView } = useApp();
  const [dataset, setDataset] = useState(null);
  const [tournamentArchive, setTournamentArchive] = useState(TOURNAMENT_ARCHIVE);
  const [requestedCompetitionScopeId, setRequestedCompetitionScopeId] = useState('regular');
  const [snapshotTime] = useState(() => Date.now());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rosterEditorOpen, setRosterEditorOpen] = useState(false);
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [primaryPosition, setPrimaryPosition] = useState('');
  const [rosterStatus, setRosterStatus] = useState('');
  const photoInputRef = useRef(null);
  const t = themes[theme];

  useEffect(() => {
    let active = true;
    Promise.all([
      loadStatisticsDataset(),
      loadTournamentArchive(TOURNAMENT_ARCHIVE).catch(() => ({ tournaments: TOURNAMENT_ARCHIVE })),
    ]).then(([nextDataset, nextTournaments]) => {
      if (!active) return;
      setDataset(nextDataset);
      setTournamentArchive(nextTournaments.tournaments || TOURNAMENT_ARCHIVE);
    });
    return () => { active = false; };
  }, []);

  const profile = useMemo(() => dataset ? memberProfileSnapshot(
    dataset,
    account.playerClaims,
    snapshotTime,
    { tournaments: tournamentArchive },
  ) : null, [account.playerClaims, dataset, snapshotTime, tournamentArchive]);
  const availableCompetitionScopes = profile?.availableCompetitionScopes || [];
  const competitionScopeId = availableCompetitionScopes.includes(requestedCompetitionScopeId)
    ? requestedCompetitionScopeId
    : availableCompetitionScopes[0] || 'regular';
  const activeCompetition = profile?.competitionStats?.[competitionScopeId] || null;
  const linkState = profile ? linkCopy() : null;
  const pendingRequest = account.playerClaimRequests.find((request) => request.status === 'pending');
  const rejectedRequests = account.playerClaimRequests.filter((request) => request.status === 'rejected');
  const scopeCareerField = activeCompetition?.careerField || profile?.careerField;
  const scopeCareerGoalie = activeCompetition?.careerGoalie || profile?.careerGoalie;
  const scopeHistory = activeCompetition?.seasonHistory || profile?.seasonHistory || [];
  const scopeGames = activeCompetition?.recentGames || profile?.recentGames || [];
  const scopeEventCount = activeCompetition?.eventCount ?? scopeHistory.length;
  const goalieProfile = scopeCareerGoalie
    && scopeCareerGoalie.gamesPlayed > scopeCareerField.gamesPlayed;
  const primaryClaim = account.playerClaims.find((claim) => claim.primary) || account.playerClaims[0] || null;

  const saveRosterDetails = async (event) => {
    event.preventDefault();
    if (!primaryClaim?.playerId) return;
    setRosterStatus('');
    try {
      await account.savePlayerDetails(primaryClaim.playerId, {
        jerseyNumber,
        position: primaryPosition,
      });
      setRosterEditorOpen(false);
      setRosterStatus('Roster card updated.');
    } catch (error) {
      setRosterStatus(error instanceof Error ? error.message : 'Roster details could not be saved.');
    }
  };

  const openLinkedGame = (gameId) => {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('content', 'stats');
    url.searchParams.set('game', gameId);
    window.location.assign(url.toString());
  };

  return (
    <main className={`profile-workspace ${!account.user ? 'is-signed-out' : ''}`} style={{
      '--profile-bg': t.bg,
      '--profile-surface': t.sf,
      '--profile-panel': t.cb,
      '--profile-border': t.bd,
      '--profile-text': t.tx,
      '--profile-muted': t.tm,
      '--profile-dim': t.td,
      '--profile-accent': t.ac,
      '--profile-accent-bg': t.ab,
      '--profile-brand': t.br,
    }}>
      {!account.user ? <ProfileGate account={account} onAccount={() => setActiveView('account')} /> : !dataset ? <div className="profile-loading"><LoaderCircle aria-hidden="true" /> Loading your squad profile...</div> : !account.playerClaims.length ? <div className="profile-onboarding">
        <header>
          <span>{pendingRequest ? 'REQUEST RECEIVED' : 'PLAYER PROFILE'}</span>
          <h1>{pendingRequest ? `We sent it, ${account.displayName}` : `Find yourself, ${account.displayName}`}</h1>
          <p>{pendingRequest ? 'An admin will confirm the player link. Home and Stats stay available while the private team areas wait for approval.' : 'Request your squad player record to unlock Squad Live and the team playbook after admin approval.'}</p>
        </header>
        {pendingRequest && <PlayerLinkRequest account={account} request={pendingRequest} />}
        {!pendingRequest && rejectedRequests.map((request) => <PlayerLinkRequest account={account} request={request} key={request.playerId} />)}
        {!pendingRequest && (
          <RosterPicker
            account={account}
            claims={account.playerClaims}
            requests={account.playerClaimRequests}
            dataset={dataset}
            open
          />
        )}
      </div> : profile ? <>
        <header className="profile-hero">
          <div className="profile-avatar">
            {account.profile?.avatar_url
              ? <img src={account.profile.avatar_url} alt={`${profile.primaryPlayer.displayName} player profile`} />
              : <span aria-hidden="true">{profile.primaryPlayer.displayName.slice(0, 1).toUpperCase()}</span>}
          </div>
          <div className="profile-identity">
            <span>PLAYER PROFILE</span>
            <h1>{profile.primaryPlayer.displayName}</h1>
            <div className="profile-roster-facts">
              <strong>{profile.jerseyNumber ? `#${profile.jerseyNumber}` : 'NO #'}</strong>
              <strong>{positionLabel(profile.position)}</strong>
              <span>{profile.currentTeams.map(formatLeagueScheduleName).join(' / ') || 'Goonsquad'}</span>
            </div>
            <div className="profile-badges"><span data-status="linked"><Link2 aria-hidden="true" /> {linkState.label}</span><span><History aria-hidden="true" /> {profile.seasonsPlayed} season{profile.seasonsPlayed === 1 ? '' : 's'}</span></div>
          </div>
          <div className="profile-hero-actions">
            <input
              ref={photoInputRef}
              className="profile-photo-input"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) account.uploadAvatar(file).catch(() => {});
                event.target.value = '';
              }}
            />
            <button
              type="button"
              disabled={account.busy}
              onClick={() => photoInputRef.current?.click()}
            >
              <Camera aria-hidden="true" />
              {account.profile?.avatar_url ? 'Change picture' : 'Add player picture'}
            </button>
            {account.profile?.avatar_url && (
              <button
                type="button"
                className="is-danger"
                disabled={account.busy}
                onClick={() => account.removeAvatar().catch(() => {})}
              >
                <Trash2 aria-hidden="true" /> Remove
              </button>
            )}
            <button
              type="button"
              disabled={Boolean(pendingRequest)}
              onClick={() => setPickerOpen(true)}
              title={pendingRequest ? 'An admin is reviewing your current request' : 'Request another player record'}
            >
              {pendingRequest ? <CalendarClock aria-hidden="true" /> : <Link2 aria-hidden="true" />}
              {pendingRequest ? 'Request pending' : 'Request another record'}
            </button>
            <button
              type="button"
              onClick={() => {
                setRosterStatus('');
                if (!rosterEditorOpen) {
                  setJerseyNumber(profile.jerseyNumber || '');
                  setPrimaryPosition(profile.position || '');
                }
                setRosterEditorOpen((open) => !open);
              }}
            >
              <Hash aria-hidden="true" /> Edit roster card
            </button>
            <button type="button" onClick={() => setActiveView('account')}><Settings2 aria-hidden="true" /> Account</button>
          </div>
        </header>

        <div className="profile-photo-note">
          <Camera aria-hidden="true" />
          <span>Optional. Your picture appears on your linked public player page and in the private squad feed.</span>
        </div>

        {rosterEditorOpen && (
          <form className="profile-roster-editor" onSubmit={saveRosterDetails}>
            <div>
              <span>ROSTER CARD</span>
              <strong>Add your player number and primary position</strong>
            </div>
            <label>
              <span>Number</span>
              <input
                value={jerseyNumber}
                maxLength={3}
                inputMode="numeric"
                pattern="[0-9]{0,3}"
                placeholder="e.g. 19"
                onChange={(event) => setJerseyNumber(event.target.value.replace(/\D/gu, '').slice(0, 3))}
              />
            </label>
            <label>
              <span>Position</span>
              <select value={primaryPosition} onChange={(event) => setPrimaryPosition(event.target.value)}>
                <option value="">Not set</option>
                <option value="W">Winger</option>
                <option value="C">Center</option>
                <option value="D">Defence</option>
                <option value="G">Goalie</option>
              </select>
            </label>
            <div className="profile-roster-editor-actions">
              <button type="button" onClick={() => setRosterEditorOpen(false)}>Cancel</button>
              <button type="submit" disabled={account.busy}>
                <Save aria-hidden="true" /> Save card
              </button>
            </div>
          </form>
        )}
        {rosterStatus && <p className="profile-roster-status" role="status">{rosterStatus}</p>}

        <div className="profile-verification-note" data-status="linked"><Link2 aria-hidden="true" /><div><strong>{linkState.label}</strong><span>{linkState.detail}</span></div></div>

        <section className="profile-competition" aria-label="Choose competition statistics">
          <div className="profile-competition-tabs" role="tablist" aria-label="Competition type">
            {COMPETITION_SCOPE_ORDER.map((scopeId) => {
              const scope = profile.competitionStats?.[scopeId];
              const available = Boolean(scope?.available);
              return (
                <button
                  type="button"
                  role="tab"
                  key={scopeId}
                  aria-selected={competitionScopeId === scopeId}
                  disabled={!available}
                  onClick={() => setRequestedCompetitionScopeId(scopeId)}
                >
                  <CompetitionIcon scopeId={scopeId} />
                  <span>
                    <strong>{COMPETITION_SCOPE_META[scopeId].label}</strong>
                    <small>{available ? eventCountLabel(scopeId, scope.eventCount) : 'No stats yet'}</small>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="profile-competition-readout">
            <span>{activeCompetition?.eyebrow}</span>
            <strong>{activeCompetition?.label}</strong>
            <p>{activeCompetition?.description}</p>
          </div>
        </section>

        <section className="profile-metric-strip" aria-label={`${activeCompetition?.label || 'Career'} statistics`}>
          {goalieProfile ? <>
            <ProfileMetric label="Games" value={scopeCareerGoalie.gamesPlayed || '—'} detail={eventCountLabel(competitionScopeId, scopeEventCount)} />
            <ProfileMetric label="Record" value={scopeCareerGoalie.gamesPlayed ? `${scopeCareerGoalie.wins}-${scopeCareerGoalie.losses}-${scopeCareerGoalie.ties}` : '—'} detail="wins · losses · ties" />
            <ProfileMetric label="Save rate" value={scopeCareerGoalie.gamesPlayed ? formatPercentage(scopeCareerGoalie.savePercentage) : '—'} detail={Number.isFinite(scopeCareerGoalie.saves) ? `${scopeCareerGoalie.saves} saves` : 'Published rate'} />
            <ProfileMetric label="Shutouts" value={scopeCareerGoalie.gamesPlayed ? scopeCareerGoalie.shutouts : '—'} detail={scopeCareerGoalie.gamesPlayed && Number.isFinite(scopeCareerGoalie.goalsAgainstAverage) ? `${scopeCareerGoalie.goalsAgainstAverage.toFixed(2)} GAA` : 'No goalie line published'} />
          </> : <>
            <ProfileMetric label="Games" value={scopeCareerField.gamesPlayed || '—'} detail={eventCountLabel(competitionScopeId, scopeEventCount)} />
            <ProfileMetric label="Goals" value={scopeCareerField.gamesPlayed ? scopeCareerField.goals : '—'} detail={`${scopeCareerField.powerPlayGoals} power play`} />
            <ProfileMetric label="Assists" value={scopeCareerField.gamesPlayed ? scopeCareerField.assists : '—'} detail="career total" />
            <ProfileMetric label="Points" value={scopeCareerField.gamesPlayed ? scopeCareerField.points : '—'} detail={scopeCareerField.gamesPlayed ? `${scopeCareerField.pointsPerGame.toFixed(2)} per game` : 'No player line published'} />
          </>}
        </section>

        <section className="profile-command-strip">
          <button type="button" onClick={() => setActiveView('playbook')}><Target aria-hidden="true" /><span><strong>{favorites.size} saved plays</strong><small>Open your playbook</small></span><ArrowRight aria-hidden="true" /></button>
          <button type="button" onClick={() => setActiveView('playmaker')}><TrendingUp aria-hidden="true" /><span><strong>Create and share</strong><small>Build your next team play</small></span><ArrowRight aria-hidden="true" /></button>
          {profile.nextGame && <button type="button" onClick={() => openLinkedGame(profile.nextGame.id)}><CalendarClock aria-hidden="true" /><span><strong>Next: {profile.nextGame.opponent}</strong><small>{formatGameDate(profile.nextGame.scheduledAt)}</small></span><ArrowRight aria-hidden="true" /></button>}
        </section>

        <OfficialSocialLinks className="profile-social-links" />

        <div className="profile-content-grid">
          <section className="profile-band profile-season-history">
            <header><Medal aria-hidden="true" /><div><span>STAT HISTORY</span><h2>{activeCompetition?.label} history</h2></div></header>
            <div className="profile-season-rows">
              {scopeHistory.map((row) => <article key={row.id || row.season.id} data-current={row.season.current}>
                <div><strong>{row.season.name}</strong><small>{historyContext(row)}</small></div>
                {row.goalie.gamesPlayed > row.field.gamesPlayed ? <div className="profile-season-line"><span><b>{row.goalie.gamesPlayed}</b> GP</span><span><b>{row.goalie.wins}</b> W</span><span><b>{formatPercentage(row.goalie.savePercentage)}</b> SV%</span><span><b>{row.goalie.shutouts}</b> SO</span></div> : <div className="profile-season-line"><span><b>{row.field.gamesPlayed}</b> GP</span><span><b>{row.field.goals}</b> G</span><span><b>{row.field.assists}</b> A</span><span><b>{row.field.points}</b> PTS</span></div>}
                {row.season.current && <span className="profile-current-season">CURRENT</span>}
              </article>)}
              {!scopeHistory.length && <div className="profile-empty"><History aria-hidden="true" /><strong>No {activeCompetition?.label.toLowerCase()} totals published</strong><p>This scope will appear when player statistics are available.</p></div>}
            </div>
          </section>

          <section className="profile-band profile-recent-games">
            <header><History aria-hidden="true" /><div><span>GAME LOG</span><h2>Recent appearances</h2></div></header>
            <div className="profile-game-rows">
              {scopeGames.slice(0, 8).map((row) => <button type="button" key={row.game.id} onClick={() => openLinkedGame(row.game.id)}>
                <span className={`profile-game-result is-${row.result.toLowerCase()}`}>{row.result}</span>
                <span><strong>{row.game.opponent}</strong><small>{formatGameDate(row.game.scheduledAt)} · {[row.team ? formatLeagueScheduleName(row.team) : row.season ? formatLeagueName(row.season) : null, row.game.stage === 'playoffs' ? 'Playoffs' : 'Regular season'].filter(Boolean).join(' · ')}</small></span>
                <span>{row.field ? <><b>{row.points}</b><small>PTS</small></> : <><b>{formatPercentage(row.goalie?.savePercentage)}</b><small>SV%</small></>}</span>
                <ChevronRight aria-hidden="true" />
              </button>)}
              {!scopeGames.length && <div className="profile-empty"><History aria-hidden="true" /><strong>No detailed {activeCompetition?.label.toLowerCase()} appearances published</strong><p>Available totals remain visible above.</p></div>}
            </div>
          </section>
        </div>

        <section className="profile-band profile-linked-records">
          <header><UserRoundCheck aria-hidden="true" /><div><span>IDENTITY LINKS</span><h2>League records in this profile</h2></div></header>
          {account.playerClaims.map((claim) => <article key={claim.playerId}><span className="profile-record-avatar" aria-hidden="true">{claim.player?.displayName?.slice(0, 1) || '?'}</span><div><strong>{claim.player?.displayName || 'League player'}</strong><small>{claim.primary ? 'Primary record' : 'Historical record'} · {formatLeagueName(claim.player)} · linked</small></div>{claim.player?.sourceUrl && <a href={claim.player.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open league profile for ${claim.player.displayName}`}><ExternalLink aria-hidden="true" /></a>}<button type="button" disabled={account.busy} onClick={() => { if (window.confirm('Remove this league record from your profile?')) account.releasePlayer(claim.playerId).catch(() => {}); }} aria-label={`Remove ${claim.player?.displayName || 'player'} from profile`}><Unlink aria-hidden="true" /></button></article>)}
        </section>

        {account.playerClaimRequests.map((request) => (
          <section className="profile-band profile-request-band" key={request.playerId}>
            <PlayerLinkRequest account={account} request={request} />
          </section>
        ))}

        <RosterPicker account={account} claims={account.playerClaims} requests={account.playerClaimRequests} dataset={dataset} onClose={() => setPickerOpen(false)} onLinked={() => setPickerOpen(false)} open={pickerOpen} />
      </> : <section className="profile-gate"><UsersRound aria-hidden="true" /><h1>Your linked player record is unavailable</h1><p>Refresh your account or ask a team manager to confirm the roster import.</p><button type="button" onClick={account.refreshProfile}>Refresh profile</button></section>}
    </main>
  );
}
