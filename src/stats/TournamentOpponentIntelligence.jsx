import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  Clock3,
  Database,
  ExternalLink,
  FileQuestion,
  LockKeyhole,
  MapPin,
  Radar,
  Search,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react';
import { loadTournamentOpponentIntelligence } from './tournamentIntelligenceCloud';

function titleCaseStatus(value) {
  return String(value || 'unresolved')
    .split('-')
    .filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() || ''}${word.slice(1)}`)
    .join(' ');
}

function formatMeetingDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

function formatMeetingTime(value) {
  if (!value) return '';
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'p.m.' : 'a.m.'}`;
}

function IntelligenceSetupState({ configured, error }) {
  if (error) {
    return (
      <section className="tournament-intelligence-state is-error" role="alert">
        <AlertTriangle aria-hidden="true" />
        <div>
          <span>ADMIN RESEARCH UNAVAILABLE</span>
          <h3>The private team research could not be loaded.</h3>
          <p>{error}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="tournament-intelligence-state">
      <LockKeyhole aria-hidden="true" />
      <div>
        <span>{configured ? 'NO TEAM RESEARCH YET' : 'ONE-TIME PRIVATE SETUP'}</span>
        <h3>{configured ? 'This event has no admin research yet.' : 'Run the private tournament research migration.'}</h3>
        <p>{configured
          ? 'The tournament schedule remains available to the team; private opponent notes can be added later.'
          : 'The public tournament is ready. This protected tab will populate after the admin-only database table is created.'}</p>
      </div>
    </section>
  );
}

function TeamSelector({ records, selectedTeamId, onSelect }) {
  return (
    <div className="tournament-intelligence-team-list" role="list" aria-label="Tournament teams">
      {records.map((record) => (
        <button
          key={record.teamId}
          type="button"
          role="listitem"
          aria-pressed={record.teamId === selectedTeamId}
          onClick={() => onSelect(record.teamId)}
        >
          <span>{record.priority <= 2 ? `NEXT ${record.priority}` : record.poolName}</span>
          <strong>{record.teamName}</strong>
          <small>{record.identity?.label || titleCaseStatus(record.identity?.status)}</small>
        </button>
      ))}
    </div>
  );
}

function MeetingCard({ meeting }) {
  if (!meeting) return null;
  return (
    <section className="tournament-intelligence-meeting">
      <header>
        <CalendarClock aria-hidden="true" />
        <span>HEAD-TO-HEAD</span>
        <strong>Game {meeting.gameNumber}</strong>
      </header>
      <div>
        <span><strong>{formatMeetingDate(meeting.date)}</strong><small>{formatMeetingTime(meeting.time)}</small></span>
        <span><MapPin aria-hidden="true" /><strong>{meeting.location}</strong><small>{meeting.site}</small></span>
      </div>
    </section>
  );
}

function SourceList({ sources = [] }) {
  return (
    <section className="tournament-intelligence-sources">
      <header><ShieldCheck aria-hidden="true" /><div><span>RESEARCH TRAIL</span><h4>Sources and scope</h4></div></header>
      <div>
        {sources.map((source, index) => source.url ? (
          <a key={`${source.label}-${index}`} href={source.url} target="_blank" rel="noreferrer">
            <span><strong>{source.label}</strong><small>{source.scope}</small></span>
            <ExternalLink aria-hidden="true" />
          </a>
        ) : (
          <div key={`${source.label}-${index}`}>
            <span><strong>{source.label}</strong><small>{source.scope}</small></span>
            <LockKeyhole aria-hidden="true" />
          </div>
        ))}
      </div>
    </section>
  );
}

function RosterStatus({ rosterStatus }) {
  if (!rosterStatus) return null;
  const isPublished = rosterStatus.status === 'published';
  const Icon = isPublished ? BadgeCheck : Clock3;

  return (
    <section className={`tournament-intelligence-roster-status ${isPublished ? 'is-published' : 'is-pending'}`}>
      <Icon aria-hidden="true" />
      <div>
        <span>OFFICIAL TOURNAMENT ROSTER</span>
        <h4>{isPublished ? `${rosterStatus.publishedPlayers} players published` : 'Not published yet'}</h4>
        <p>{rosterStatus.note}</p>
        {rosterStatus.lastChecked && <small>Last checked {rosterStatus.lastChecked}</small>}
      </div>
      {rosterStatus.officialTeamUrl && (
        <a href={rosterStatus.officialTeamUrl} target="_blank" rel="noreferrer">
          Open official team page <ExternalLink aria-hidden="true" />
        </a>
      )}
    </section>
  );
}

function RosterMatch({ rosterMatch }) {
  if (!rosterMatch) return null;
  const metrics = [
    ['Roster overlap', `${rosterMatch.overlap}/${rosterMatch.total}`],
    ['Current record', rosterMatch.record],
    ['Standing', rosterMatch.standing],
    ['Goal difference', rosterMatch.goalDifference],
  ].filter(([, value]) => value);

  return (
    <section className="tournament-intelligence-roster-match">
      <header>
        <BadgeCheck aria-hidden="true" />
        <div><span>ROSTER FINGERPRINT</span><h4>{rosterMatch.label || 'Multi-player match found'}</h4></div>
        <strong>{rosterMatch.overlap}/{rosterMatch.total}<small>players aligned</small></strong>
      </header>
      <p>{rosterMatch.note}</p>
      <div className="tournament-intelligence-roster-metrics">
        {metrics.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>
      <footer>
        <span><Trophy aria-hidden="true" /><strong>{rosterMatch.matchedTeam}</strong><small>{[rosterMatch.league, rosterMatch.division, rosterMatch.season].filter(Boolean).join(' · ')}</small></span>
        {rosterMatch.sourceUrl && <a href={rosterMatch.sourceUrl} target="_blank" rel="noreferrer">Open league stats <ExternalLink aria-hidden="true" /></a>}
      </footer>
    </section>
  );
}

function RegionalSearch({ regionalSearch }) {
  if (!regionalSearch) return null;
  const candidates = Array.isArray(regionalSearch.candidates) ? regionalSearch.candidates : [];

  return (
    <section className="tournament-intelligence-regional-search">
      <header><Database aria-hidden="true" /><div><span>REGIONAL MATCHING POOL</span><h4>{regionalSearch.league}</h4></div></header>
      <p>{regionalSearch.note}</p>
      {candidates.length > 0 && <div>{candidates.map((candidate) => <span key={candidate}>{candidate}</span>)}</div>}
      {regionalSearch.sourceUrl && <a href={regionalSearch.sourceUrl} target="_blank" rel="noreferrer">Open regional player records <ExternalLink aria-hidden="true" /></a>}
    </section>
  );
}

function PlayerRoster({ players, hasRosterMatch }) {
  if (!players.length) {
    return <p>No tournament names are available to cross-match yet. The official roster page will remain the source of truth.</p>;
  }

  if (!hasRosterMatch) {
    return <div>{players.map((player) => <span key={`${player.name}-${player.number || ''}`}><strong>{player.name}</strong><small>{[player.number && `#${player.number}`, player.position, player.note].filter(Boolean).join(' · ')}</small></span>)}</div>;
  }

  return (
    <div className="tournament-intelligence-player-table" role="table" aria-label="Tournament roster matched to regional league statistics">
      <div role="row" className="tournament-intelligence-player-row is-header">
        <span role="columnheader">#</span>
        <span role="columnheader">Tournament roster</span>
        <span role="columnheader">Regional league entry</span>
        <span role="columnheader">GP</span>
        <span role="columnheader">G</span>
        <span role="columnheader">A</span>
        <span role="columnheader">PTS</span>
        <span role="columnheader">PIM</span>
      </div>
      {players.map((player) => (
        <div role="row" className="tournament-intelligence-player-row" key={`${player.eventName}-${player.number || ''}`}>
          <strong role="cell">{player.number || '–'}</strong>
          <span role="cell"><strong>{player.eventName}</strong><small>{[player.position, player.match === 'normalized' ? 'Name variant matched' : 'Exact name match'].filter(Boolean).join(' · ')}</small></span>
          <span role="cell"><strong>{player.leagueName || player.eventName}</strong><small>{player.team || ''}</small></span>
          <span role="cell">{player.gp ?? '–'}</span>
          <span role="cell">{player.goals ?? '–'}</span>
          <span role="cell">{player.assists ?? '–'}</span>
          <strong role="cell">{player.points ?? '–'}</strong>
          <span role="cell">{player.pim ?? '–'}</span>
        </div>
      ))}
    </div>
  );
}

function TeamIntelligence({ record }) {
  const identityStatus = record.identity?.status || 'unresolved';
  const facts = Array.isArray(record.facts) ? record.facts : [];
  const history = Array.isArray(record.history) ? record.history : [];
  const players = Array.isArray(record.players) ? record.players : [];
  const questions = Array.isArray(record.questions) ? record.questions : [];
  const sources = Array.isArray(record.sources) ? record.sources : [];
  const rosterStatus = record.rosterStatus || null;
  const rosterMatch = record.rosterMatch || null;
  const regionalSearch = record.regionalSearch || null;

  return (
    <article className="tournament-intelligence-detail" data-identity-status={identityStatus}>
      <header className="tournament-intelligence-detail-hero">
        <div>
          <span>{record.headline || record.poolName}</span>
          <h3>{record.teamName}</h3>
          <p>{record.summary}</p>
        </div>
        <aside>
          <Radar aria-hidden="true" />
          <span>{record.identity?.label || titleCaseStatus(identityStatus)}</span>
          <small>{record.identity?.note}</small>
        </aside>
      </header>

      <div className="tournament-intelligence-facts">
        {facts.map((fact) => <div key={`${fact.label}-${fact.value}`}><span>{fact.label}</span><strong>{fact.value}</strong></div>)}
      </div>

      <div className="tournament-intelligence-evidence">
        <RosterStatus rosterStatus={rosterStatus} />
        <RosterMatch rosterMatch={rosterMatch} />
      </div>

      <div className="tournament-intelligence-grid">
        <div className="tournament-intelligence-main">
          <MeetingCard meeting={record.meeting} />
          <RegionalSearch regionalSearch={regionalSearch} />
          <section className="tournament-intelligence-history">
            <header><Search aria-hidden="true" /><div><span>PUBLIC RECORD</span><h4>What we can connect safely</h4></div></header>
            {history.length ? <div>{history.map((item, index) => (
              <article key={`${item.season}-${item.team}-${index}`}>
                <div><span>{item.season}</span><strong>{item.team}</strong><small>{item.relationship}</small></div>
                <div><strong>{item.record}</strong><span>{item.result}</span></div>
                {item.note && <p>{item.note}</p>}
              </article>
            ))}</div> : <p className="tournament-intelligence-empty"><FileQuestion aria-hidden="true" />No attributable public results were found under this exact team name.</p>}
          </section>

          <section className="tournament-intelligence-players">
            <header><Users aria-hidden="true" /><div><span>PERSONNEL</span><h4>Known player information</h4></div></header>
            <PlayerRoster players={players} hasRosterMatch={Boolean(rosterMatch)} />
          </section>
        </div>

        <aside className="tournament-intelligence-side">
          <section className="tournament-intelligence-questions">
            <header><FileQuestion aria-hidden="true" /><div><span>EVENT CHECKLIST</span><h4>Resolve before or at check-in</h4></div></header>
            <ol>{questions.map((question) => <li key={question}>{question}</li>)}</ol>
          </section>
          <SourceList sources={sources} />
        </aside>
      </div>
    </article>
  );
}

export default function TournamentOpponentIntelligence({ tournamentId }) {
  const [state, setState] = useState({ loading: true, configured: true, records: [], error: '' });
  const [selectedTeamId, setSelectedTeamId] = useState('');

  useEffect(() => {
    let active = true;

    loadTournamentOpponentIntelligence(tournamentId)
      .then((result) => {
        if (!active) return;
        setState({ loading: false, error: '', ...result });
        setSelectedTeamId(result.records[0]?.teamId || '');
      })
      .catch((error) => {
        if (!active) return;
        setState({ loading: false, configured: true, records: [], error: error.message || 'Research request failed.' });
      });

    return () => { active = false; };
  }, [tournamentId]);

  const selectedRecord = useMemo(() => (
    state.records.find((record) => record.teamId === selectedTeamId) || state.records[0]
  ), [selectedTeamId, state.records]);

  if (state.loading) {
    return <section className="tournament-intelligence-loading" aria-live="polite"><Radar aria-hidden="true" /><span>Loading private team research…</span></section>;
  }
  if (!state.records.length) return <IntelligenceSetupState configured={state.configured} error={state.error} />;

  return (
    <section className="tournament-intelligence" data-admin-only="true">
      <header className="tournament-intelligence-header">
        <div><span><LockKeyhole aria-hidden="true" /> ADMIN ONLY</span><h3>Team intelligence</h3><p>Source-backed context for the field, with the next two opponents first. Identity gaps stay visible until a roster confirms them.</p></div>
        <strong>{state.records.length}<small>opponents researched</small></strong>
      </header>
      <TeamSelector records={state.records} selectedTeamId={selectedRecord?.teamId} onSelect={setSelectedTeamId} />
      {selectedRecord && <TeamIntelligence record={selectedRecord} />}
    </section>
  );
}
