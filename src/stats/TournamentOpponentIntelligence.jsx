import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  ExternalLink,
  FileQuestion,
  LockKeyhole,
  MapPin,
  Radar,
  Search,
  ShieldCheck,
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

function TeamIntelligence({ record }) {
  const identityStatus = record.identity?.status || 'unresolved';
  const facts = Array.isArray(record.facts) ? record.facts : [];
  const history = Array.isArray(record.history) ? record.history : [];
  const players = Array.isArray(record.players) ? record.players : [];
  const questions = Array.isArray(record.questions) ? record.questions : [];
  const sources = Array.isArray(record.sources) ? record.sources : [];

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

      <div className="tournament-intelligence-grid">
        <div className="tournament-intelligence-main">
          <MeetingCard meeting={record.meeting} />
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
            {players.length ? <div>{players.map((player) => <span key={`${player.name}-${player.number || ''}`}><strong>{player.name}</strong><small>{[player.number && `#${player.number}`, player.position, player.note].filter(Boolean).join(' · ')}</small></span>)}</div> : <p>No current player can be attributed to this tournament roster from a reliable public source.</p>}
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
