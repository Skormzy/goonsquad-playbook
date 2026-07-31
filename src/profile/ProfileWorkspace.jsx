import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  ChevronRight,
  CircleUserRound,
  ExternalLink,
  History,
  Link2,
  LoaderCircle,
  LogIn,
  Medal,
  RefreshCcw,
  Search,
  Settings2,
  ShieldCheck,
  Target,
  TrendingUp,
  Unlink,
  UserRoundCheck,
  UsersRound,
  X,
} from 'lucide-react';
import { useAccount } from '../account/AccountContext';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { formatGameDate, formatPercentage, formatScheduleName } from '../stats/statsModel';
import { loadStatisticsDataset } from '../stats/statsCloud';
import { memberProfileSnapshot, playerRosterCandidates } from './profileModel';
import './profile.css';

function positionLabel(position) {
  if (position === 'G') return 'Goalie';
  if (position === 'D') return 'Defense';
  if (position === 'C') return 'Center';
  if (position === 'W') return 'Winger';
  return 'Team member';
}

function linkCopy() {
  return { label: 'Player profile approved', detail: 'Your account is linked to the official team archive. An admin can update this assignment at any time.' };
}

function ProfileMetric({ detail, label, value }) {
  return <div className="profile-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
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
      <footer><ShieldCheck aria-hidden="true" /><span>Your request goes to a team admin for approval. It never changes the official statistics archive.</span></footer>
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
            ? 'Home remains available. Plays, Strategy, and Create unlock after an admin confirms this is you.'
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
      <p>{account.configured ? 'Home and public statistics are open to everyone. Link your squad player profile to unlock Plays, Strategy, and Create after admin approval.' : 'Public schedules, results, standings, and player statistics remain available on Home.'}</p>
      <button type="button" onClick={onAccount}>{account.configured ? <><LogIn aria-hidden="true" /> Sign in or create account</> : <><Settings2 aria-hidden="true" /> View account status</>}</button>
    </section>
  );
}

export default function ProfileWorkspace() {
  const { theme, themes } = useTheme();
  const account = useAccount();
  const { favorites, setActiveView } = useApp();
  const [dataset, setDataset] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const t = themes[theme];

  useEffect(() => {
    let active = true;
    loadStatisticsDataset().then((next) => { if (active) setDataset(next); });
    return () => { active = false; };
  }, []);

  const profile = useMemo(() => dataset ? memberProfileSnapshot(dataset, account.playerClaims) : null, [account.playerClaims, dataset]);
  const linkState = profile ? linkCopy() : null;
  const pendingRequest = account.playerClaimRequests.find((request) => request.status === 'pending');
  const rejectedRequests = account.playerClaimRequests.filter((request) => request.status === 'rejected');
  const goalieProfile = profile && profile.careerGoalie.gamesPlayed > profile.careerField.gamesPlayed;

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
          <p>{pendingRequest ? 'An admin will confirm the player link. Home stays available while Plays, Strategy, and Create wait for approval.' : 'Request your squad player record to unlock the team playbook after admin approval.'}</p>
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
          <div className="profile-avatar" aria-hidden="true">{profile.primaryPlayer.displayName.slice(0, 1).toUpperCase()}</div>
          <div className="profile-identity">
            <span>PLAYER PROFILE</span>
            <h1>{profile.primaryPlayer.displayName}</h1>
            <p>{[profile.jerseyNumber ? `#${profile.jerseyNumber}` : null, positionLabel(profile.position), profile.currentTeams.map(formatScheduleName).join(' / ')].filter(Boolean).join(' · ')}</p>
            <div className="profile-badges"><span data-status="linked"><BadgeCheck aria-hidden="true" /> {linkState.label}</span><span><History aria-hidden="true" /> {profile.seasonsPlayed} season{profile.seasonsPlayed === 1 ? '' : 's'}</span></div>
          </div>
          <div className="profile-hero-actions">
            <button
              type="button"
              disabled={Boolean(pendingRequest)}
              onClick={() => setPickerOpen(true)}
              title={pendingRequest ? 'An admin is reviewing your current request' : 'Request another player record'}
            >
              {pendingRequest ? <CalendarClock aria-hidden="true" /> : <Link2 aria-hidden="true" />}
              {pendingRequest ? 'Request pending' : 'Request another record'}
            </button>
            <button type="button" onClick={() => setActiveView('account')}><Settings2 aria-hidden="true" /> Account</button>
          </div>
        </header>

        <div className="profile-verification-note" data-status="linked"><ShieldCheck aria-hidden="true" /><div><strong>{linkState.label}</strong><span>{linkState.detail}</span></div></div>

        <section className="profile-metric-strip" aria-label="Career statistics">
          {goalieProfile ? <>
            <ProfileMetric label="Games" value={profile.careerGoalie.gamesPlayed} detail={`${profile.seasonsPlayed} seasons`} />
            <ProfileMetric label="Record" value={`${profile.careerGoalie.wins}-${profile.careerGoalie.losses}-${profile.careerGoalie.ties}`} detail="wins · losses · ties" />
            <ProfileMetric label="Save rate" value={formatPercentage(profile.careerGoalie.savePercentage)} detail={`${profile.careerGoalie.saves} saves`} />
            <ProfileMetric label="Shutouts" value={profile.careerGoalie.shutouts} detail={`${profile.careerGoalie.goalsAgainstAverage.toFixed(2)} GAA`} />
          </> : <>
            <ProfileMetric label="Games" value={profile.careerField.gamesPlayed} detail={`${profile.seasonsPlayed} seasons`} />
            <ProfileMetric label="Goals" value={profile.careerField.goals} detail={`${profile.careerField.powerPlayGoals} power play`} />
            <ProfileMetric label="Assists" value={profile.careerField.assists} detail="career total" />
            <ProfileMetric label="Points" value={profile.careerField.points} detail={`${profile.careerField.pointsPerGame.toFixed(2)} per game`} />
          </>}
        </section>

        <section className="profile-command-strip">
          <button type="button" onClick={() => setActiveView('playbook')}><Target aria-hidden="true" /><span><strong>{favorites.size} saved plays</strong><small>Open your playbook</small></span><ArrowRight aria-hidden="true" /></button>
          <button type="button" onClick={() => setActiveView('playmaker')}><TrendingUp aria-hidden="true" /><span><strong>Create and share</strong><small>Build your next team play</small></span><ArrowRight aria-hidden="true" /></button>
          {profile.nextGame && <button type="button" onClick={() => openLinkedGame(profile.nextGame.id)}><CalendarClock aria-hidden="true" /><span><strong>Next: {profile.nextGame.opponent}</strong><small>{formatGameDate(profile.nextGame.scheduledAt)}</small></span><ArrowRight aria-hidden="true" /></button>}
        </section>

        <div className="profile-content-grid">
          <section className="profile-band profile-season-history">
            <header><Medal aria-hidden="true" /><div><span>SEASON HISTORY</span><h2>Every linked Goonsquad season</h2></div></header>
            <div className="profile-season-rows">
              {profile.seasonHistory.map((row) => <article key={row.season.id} data-current={row.season.current}>
                <div><strong>{row.season.name}</strong><small>{row.schedules.join(' / ')}</small></div>
                {row.goalie.gamesPlayed > row.field.gamesPlayed ? <div className="profile-season-line"><span><b>{row.goalie.gamesPlayed}</b> GP</span><span><b>{row.goalie.wins}</b> W</span><span><b>{formatPercentage(row.goalie.savePercentage)}</b> SV%</span><span><b>{row.goalie.shutouts}</b> SO</span></div> : <div className="profile-season-line"><span><b>{row.field.gamesPlayed}</b> GP</span><span><b>{row.field.goals}</b> G</span><span><b>{row.field.assists}</b> A</span><span><b>{row.field.points}</b> PTS</span></div>}
                {row.season.current && <span className="profile-current-season">CURRENT</span>}
              </article>)}
            </div>
          </section>

          <section className="profile-band profile-recent-games">
            <header><History aria-hidden="true" /><div><span>GAME LOG</span><h2>Recent appearances</h2></div></header>
            <div className="profile-game-rows">
              {profile.recentGames.slice(0, 8).map((row) => <button type="button" key={row.game.id} onClick={() => openLinkedGame(row.game.id)}>
                <span className={`profile-game-result is-${row.result.toLowerCase()}`}>{row.result}</span>
                <span><strong>{row.game.opponent}</strong><small>{formatGameDate(row.game.scheduledAt)} · {row.team ? formatScheduleName(row.team) : 'League game'}</small></span>
                <span>{row.field ? <><b>{row.points}</b><small>PTS</small></> : <><b>{formatPercentage(row.goalie?.savePercentage)}</b><small>SV%</small></>}</span>
                <ChevronRight aria-hidden="true" />
              </button>)}
              {!profile.recentGames.length && <div className="profile-empty"><History aria-hidden="true" /><strong>No detailed game appearances published</strong><p>Season totals remain available above.</p></div>}
            </div>
          </section>
        </div>

        <section className="profile-band profile-linked-records">
          <header><UserRoundCheck aria-hidden="true" /><div><span>IDENTITY LINKS</span><h2>League records in this profile</h2></div></header>
          {account.playerClaims.map((claim) => <article key={claim.playerId}><span className="profile-record-avatar" aria-hidden="true">{claim.player?.displayName?.slice(0, 1) || '?'}</span><div><strong>{claim.player?.displayName || 'League player'}</strong><small>{claim.primary ? 'Primary record' : 'Historical record'} · linked</small></div>{claim.player?.sourceUrl && <a href={claim.player.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open official profile for ${claim.player.displayName}`}><ExternalLink aria-hidden="true" /></a>}<button type="button" disabled={account.busy} onClick={() => { if (window.confirm('Remove this league record from your profile?')) account.releasePlayer(claim.playerId).catch(() => {}); }} aria-label={`Remove ${claim.player?.displayName || 'player'} from profile`}><Unlink aria-hidden="true" /></button></article>)}
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
