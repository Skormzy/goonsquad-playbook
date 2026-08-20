import { createElement, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  GitBranch,
  LayoutDashboard,
  LoaderCircle,
  Plus,
  Save,
  Settings2,
  Table2,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { deleteTournamentOverride, saveTournament } from './tournamentCloud';
import {
  DEFAULT_TOURNAMENT_DISPLAY,
  normalizeTournament,
  tournamentForPersistence,
} from './tournamentModel';

const ADMIN_SECTIONS = Object.freeze([
  { id: 'details', label: 'Details', icon: Trophy },
  { id: 'display', label: 'Display', icon: LayoutDashboard },
  { id: 'teams', label: 'Teams', icon: Users },
  { id: 'event-games', label: 'Event games', icon: Settings2 },
  { id: 'games', label: 'Goonsquad', icon: Trophy },
  { id: 'standings', label: 'Standings', icon: Table2 },
  { id: 'bracket', label: 'Bracket', icon: GitBranch },
]);

const FORMAT_PRESETS = Object.freeze({
  'pools-bracket': {
    label: 'Pools + bracket',
    format: 'Pool play + elimination',
    display: { showStandings: true, showBracket: true, bracketMode: 'full' },
  },
  'round-robin': {
    label: 'Round robin',
    format: 'Round robin',
    display: { showStandings: true, showBracket: false, bracketMode: 'hidden' },
  },
  'single-elimination': {
    label: 'Single elimination',
    format: 'Single elimination',
    display: { showStandings: false, showBracket: true, bracketMode: 'full' },
  },
  showcase: {
    label: 'Showcase / friendly',
    format: 'Showcase games',
    display: { showStandings: false, showBracket: false, bracketMode: 'hidden' },
  },
});

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 100);
}

function uniqueId(prefix) {
  return `${prefix}-${Date.now().toString(36)}`;
}

function blankTournament() {
  const year = new Date().getFullYear();
  return normalizeTournament({
    id: `${year}-new-tournament`,
    name: `${year} Tournament`,
    shortName: `Tournament ${year}`,
    series: '',
    organizer: '',
    location: '',
    startDate: '',
    endDate: '',
    status: 'upcoming',
    dataStatus: 'draft',
    division: '',
    formatPreset: 'pools-bracket',
    format: FORMAT_PRESETS['pools-bracket'].format,
    teamName: 'Goonsquad',
    summary: '',
    verificationNote: '',
    sourceUrl: '',
    teams: [{ id: 'goonsquad', name: 'Goonsquad', pool: '', seed: '', isGoonSquad: true }],
    pools: [],
    eventGames: [],
    standings: [],
    games: [],
    bracket: [],
    display: DEFAULT_TOURNAMENT_DISPLAY,
  });
}

function cloneTournament(tournament) {
  return normalizeTournament(JSON.parse(JSON.stringify(tournamentForPersistence(tournament))));
}

function Field({ label, children, wide = false }) {
  return <label className={wide ? 'is-wide' : ''}><span>{label}</span>{children}</label>;
}

function Toggle({ checked, label, detail, onChange }) {
  return (
    <label className="tournament-admin-toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span aria-hidden="true"><i /></span>
      <strong>{label}<small>{detail}</small></strong>
    </label>
  );
}

function ArrayHeader({ eyebrow, title, detail, onAdd, addLabel }) {
  return (
    <header className="tournament-admin-array-header">
      <div><span>{eyebrow}</span><h3>{title}</h3><p>{detail}</p></div>
      <button type="button" onClick={onAdd}><Plus aria-hidden="true" /> {addLabel}</button>
    </header>
  );
}

function RemoveButton({ label, onClick }) {
  return (
    <button type="button" className="tournament-admin-remove" onClick={onClick} aria-label={label} title={label}>
      <Trash2 aria-hidden="true" />
    </button>
  );
}

function DetailsEditor({ draft, update }) {
  return (
    <section className="tournament-admin-section">
      <header><span>EVENT IDENTITY</span><h3>What happened and where</h3><p>These details drive the public tournament header and archive labels.</p></header>
      <div className="tournament-admin-field-grid">
        <Field label="Tournament name" wide><input value={draft.name} maxLength="120" onChange={(event) => update('name', event.target.value)} required /></Field>
        <Field label="Short selector name"><input value={draft.shortName} maxLength="48" onChange={(event) => update('shortName', event.target.value)} /></Field>
        <Field label="Archive ID"><input value={draft.id} maxLength="120" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={(event) => update('id', slugify(event.target.value))} required /></Field>
        <Field label="Series / championship"><input value={draft.series || ''} maxLength="120" onChange={(event) => update('series', event.target.value)} /></Field>
        <Field label="Organizer"><input value={draft.organizer || ''} maxLength="100" onChange={(event) => update('organizer', event.target.value)} /></Field>
        <Field label="Location"><input value={draft.location || ''} maxLength="120" onChange={(event) => update('location', event.target.value)} /></Field>
        <Field label="Start date"><input type="date" value={draft.startDate || ''} onChange={(event) => update('startDate', event.target.value)} /></Field>
        <Field label="End date"><input type="date" value={draft.endDate || ''} onChange={(event) => update('endDate', event.target.value)} /></Field>
        <Field label="Event status"><select value={draft.status || 'upcoming'} onChange={(event) => update('status', event.target.value)}><option value="upcoming">Upcoming</option><option value="live">Live</option><option value="complete">Complete</option></select></Field>
        <Field label="Data status"><select value={draft.dataStatus || 'draft'} onChange={(event) => update('dataStatus', event.target.value)}><option value="draft">Draft</option><option value="partial">In progress</option><option value="verified">Ready</option></select></Field>
        <Field label="Division"><input value={draft.division || ''} maxLength="80" onChange={(event) => update('division', event.target.value)} /></Field>
        <Field label="Team name"><input value={draft.teamName || 'Goonsquad'} maxLength="80" onChange={(event) => update('teamName', event.target.value)} /></Field>
        <Field label="Event page URL" wide><input type="url" value={draft.sourceUrl || ''} onChange={(event) => update('sourceUrl', event.target.value)} placeholder="https://" /></Field>
        <Field label="Public summary" wide><textarea rows="3" maxLength="500" value={draft.summary || ''} onChange={(event) => update('summary', event.target.value)} /></Field>
        <Field label="Tournament note" wide><textarea rows="3" maxLength="700" value={draft.verificationNote || ''} onChange={(event) => update('verificationNote', event.target.value)} /></Field>
      </div>
    </section>
  );
}

function DisplayEditor({ draft, update, updateDisplay }) {
  const applyPreset = (presetId) => {
    const preset = FORMAT_PRESETS[presetId];
    update('formatPreset', presetId);
    update('format', preset.format);
    Object.entries(preset.display).forEach(([key, value]) => updateDisplay(key, value));
  };
  return (
    <section className="tournament-admin-section">
      <header><span>PUBLIC EXPERIENCE</span><h3>Fit the event, not a rigid template</h3><p>Choose a starting format, then show only the sections that tell this tournament&apos;s story.</p></header>
      <div className="tournament-admin-field-grid">
        <Field label="Tournament format"><select value={draft.formatPreset || 'pools-bracket'} onChange={(event) => applyPreset(event.target.value)}>{Object.entries(FORMAT_PRESETS).map(([id, preset]) => <option value={id} key={id}>{preset.label}</option>)}</select></Field>
        <Field label="Public format label"><input value={draft.format || ''} maxLength="80" onChange={(event) => update('format', event.target.value)} /></Field>
        <Field label="Layout density"><select value={draft.display.layout} onChange={(event) => updateDisplay('layout', event.target.value)}><option value="championship">Championship feature</option><option value="scoreboard">Scoreboard compact</option><option value="compact">Archive compact</option></select></Field>
        <Field label="Accent"><select value={draft.display.accent} onChange={(event) => updateDisplay('accent', event.target.value)}><option value="red">Goonsquad red</option><option value="cyan">Electric cyan</option><option value="gold">Championship gold</option></select></Field>
        <Field label="Bracket view"><select value={draft.display.bracketMode} onChange={(event) => { updateDisplay('bracketMode', event.target.value); updateDisplay('showBracket', event.target.value !== 'hidden'); }}><option value="full">Full tournament bracket</option><option value="team-path">Goonsquad path only</option><option value="hidden">Do not show a bracket</option></select></Field>
      </div>
      <div className="tournament-admin-toggle-grid">
        <Toggle checked={draft.display.showOverview} label="Overview" detail="Summary, metrics, field, and game journey" onChange={(value) => updateDisplay('showOverview', value)} />
        <Toggle checked={draft.display.showStandings} label="Standings" detail="Pool or tournament table" onChange={(value) => updateDisplay('showStandings', value)} />
        <Toggle checked={draft.display.showStats} label="Stats" detail="Tournament-only player and goalie totals" onChange={(value) => updateDisplay('showStats', value)} />
        <Toggle checked={draft.display.showBracket} label="Bracket" detail="Elimination rounds and results" onChange={(value) => { updateDisplay('showBracket', value); if (!value) updateDisplay('bracketMode', 'hidden'); else if (draft.display.bracketMode === 'hidden') updateDisplay('bracketMode', 'full'); }} />
        <Toggle checked={draft.display.showGames} label="Games" detail="Goonsquad schedule and results" onChange={(value) => updateDisplay('showGames', value)} />
      </div>
      <div className="tournament-admin-field-grid is-labels">
        <Field label="Overview tab"><input value={draft.display.overviewLabel} maxLength="24" onChange={(event) => updateDisplay('overviewLabel', event.target.value)} /></Field>
        <Field label="Standings tab"><input value={draft.display.standingsLabel} maxLength="24" onChange={(event) => updateDisplay('standingsLabel', event.target.value)} /></Field>
        <Field label="Stats tab"><input value={draft.display.statsLabel} maxLength="24" onChange={(event) => updateDisplay('statsLabel', event.target.value)} /></Field>
        <Field label="Bracket tab"><input value={draft.display.bracketLabel} maxLength="24" onChange={(event) => updateDisplay('bracketLabel', event.target.value)} /></Field>
        <Field label="Games tab"><input value={draft.display.gamesLabel} maxLength="24" onChange={(event) => updateDisplay('gamesLabel', event.target.value)} /></Field>
      </div>
    </section>
  );
}

function TeamsEditor({ rows, setRows }) {
  const updateRow = (index, patch) => setRows(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  return (
    <section className="tournament-admin-section">
      <ArrayHeader eyebrow="TOURNAMENT FIELD" title="Teams and pools" detail="Keep every entrant here even when no standings table is available." addLabel="Add team" onAdd={() => setRows([...rows, { id: uniqueId('team'), name: '', pool: '', seed: '', isGoonSquad: false }])} />
      <div className="tournament-admin-rows">
        {rows.map((row, index) => <div className="tournament-admin-row is-team" key={row.id || index}>
          <Field label="Team"><input value={row.name || ''} onChange={(event) => updateRow(index, { name: event.target.value, id: row.id || slugify(event.target.value) })} /></Field>
          <Field label="Pool"><input value={row.pool || ''} onChange={(event) => updateRow(index, { pool: event.target.value })} placeholder="Pool A" /></Field>
          <Field label="Seed"><input value={row.seed || ''} onChange={(event) => updateRow(index, { seed: event.target.value })} /></Field>
          <label className="tournament-admin-check"><input type="checkbox" checked={Boolean(row.isGoonSquad)} onChange={(event) => updateRow(index, { isGoonSquad: event.target.checked })} /><span>Goonsquad</span></label>
          <RemoveButton label={`Remove ${row.name || 'team'}`} onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))} />
        </div>)}
        {!rows.length && <p className="tournament-admin-empty-row">No teams added yet.</p>}
      </div>
    </section>
  );
}

function GamesEditor({ rows, setRows, tournamentLocation }) {
  const updateRow = (index, patch) => setRows(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  return (
    <section className="tournament-admin-section">
      <ArrayHeader eyebrow="GOONSQUAD SCHEDULE" title="Team game file" detail="Keep Goonsquad-only details here. The all-event ledger is authoritative for teams, stages, and final scores." addLabel="Add team game" onAdd={() => setRows([...rows, { id: uniqueId('game'), gameNumber: rows.length + 1, stage: 'round-robin', stageLabel: 'Round robin', opponent: '', status: 'scheduled', scoreFor: null, scoreAgainst: null, date: '', time: '', site: '', location: tournamentLocation || '' }])} />
      <div className="tournament-admin-rows">
        {rows.map((row, index) => <div className="tournament-admin-row is-game" key={row.id || index}>
          <Field label="#"><input type="number" min="1" value={row.gameNumber || index + 1} onChange={(event) => updateRow(index, { gameNumber: Number(event.target.value) })} /></Field>
          <Field label="Opponent"><input value={row.opponent || ''} onChange={(event) => updateRow(index, { opponent: event.target.value })} /></Field>
          <Field label="Stage label"><input value={row.stageLabel || ''} onChange={(event) => updateRow(index, { stageLabel: event.target.value, stage: slugify(event.target.value) || row.stage })} /></Field>
          <Field label="Status"><select value={row.status || 'scheduled'} onChange={(event) => updateRow(index, { status: event.target.value })}><option value="scheduled">Scheduled</option><option value="documented">Documented</option><option value="played">Played - result pending</option><option value="final">Final</option></select></Field>
          <Field label="Date"><input type="date" value={row.date || ''} onChange={(event) => updateRow(index, { date: event.target.value })} /></Field>
          <Field label="Time"><input type="time" value={row.time || ''} onChange={(event) => updateRow(index, { time: event.target.value })} /></Field>
          <Field label="Site"><select value={row.site || ''} onChange={(event) => updateRow(index, { site: event.target.value })}><option value="">Not set</option><option value="Home">Home</option><option value="Away">Away</option><option value="Neutral">Neutral</option></select></Field>
          <Field label="Location"><input value={row.location || ''} onChange={(event) => updateRow(index, { location: event.target.value })} /></Field>
          <Field label="GF"><input type="number" min="0" value={row.scoreFor ?? ''} onChange={(event) => updateRow(index, { scoreFor: event.target.value === '' ? null : Number(event.target.value) })} /></Field>
          <Field label="GA"><input type="number" min="0" value={row.scoreAgainst ?? ''} onChange={(event) => updateRow(index, { scoreAgainst: event.target.value === '' ? null : Number(event.target.value) })} /></Field>
          <RemoveButton label={`Remove game ${row.gameNumber || index + 1}`} onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))} />
        </div>)}
        {!rows.length && <p className="tournament-admin-empty-row">No games added yet.</p>}
      </div>
    </section>
  );
}

function EventGamesEditor({ rows, setRows, tournamentLocation }) {
  const updateRow = (index, patch) => setRows(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const score = (value) => value === '' ? null : Number(value);
  return (
    <section className="tournament-admin-section">
      <ArrayHeader eyebrow="MASTER EVENT LEDGER" title="Every tournament game" detail="This is the source of truth for round-robin tables, score links, game pages, and bracket results." addLabel="Add event game" onAdd={() => setRows([...rows, { id: uniqueId('event-game'), officialGameNumber: null, stage: 'round-robin', stageLabel: 'Round robin', awayTeam: '', awayPool: '', awayScore: null, homeTeam: '', homePool: '', homeScore: null, date: '', time: '', location: tournamentLocation || '', status: 'scheduled', sourceUrl: '' }])} />
      <div className="tournament-admin-rows">
        {rows.map((row, index) => <div className="tournament-admin-row is-event-game" key={row.id || index}>
          <Field label="Game #"><input type="number" min="1" value={row.officialGameNumber ?? ''} onChange={(event) => updateRow(index, { officialGameNumber: event.target.value === '' ? null : Number(event.target.value) })} /></Field>
          <Field label="Stage"><select value={row.stage || 'round-robin'} onChange={(event) => updateRow(index, { stage: event.target.value, stageLabel: ({ 'round-robin': 'Round robin', quarterfinal: 'Quarterfinal', semifinal: 'Semifinal', final: 'Championship' })[event.target.value] })}><option value="round-robin">Round robin</option><option value="quarterfinal">Quarterfinal</option><option value="semifinal">Semifinal</option><option value="final">Championship</option></select></Field>
          <Field label="Stage label"><input value={row.stageLabel || ''} onChange={(event) => updateRow(index, { stageLabel: event.target.value })} /></Field>
          <Field label="Away team"><input value={row.awayTeam || ''} onChange={(event) => updateRow(index, { awayTeam: event.target.value })} /></Field>
          <Field label="Away pool"><input value={row.awayPool || ''} onChange={(event) => updateRow(index, { awayPool: event.target.value })} /></Field>
          <Field label="Away score"><input type="number" min="0" value={row.awayScore ?? ''} onChange={(event) => updateRow(index, { awayScore: score(event.target.value) })} /></Field>
          <Field label="Home team"><input value={row.homeTeam || ''} onChange={(event) => updateRow(index, { homeTeam: event.target.value })} /></Field>
          <Field label="Home pool"><input value={row.homePool || ''} onChange={(event) => updateRow(index, { homePool: event.target.value })} /></Field>
          <Field label="Home score"><input type="number" min="0" value={row.homeScore ?? ''} onChange={(event) => updateRow(index, { homeScore: score(event.target.value) })} /></Field>
          <Field label="Date"><input type="date" value={row.date || ''} onChange={(event) => updateRow(index, { date: event.target.value })} /></Field>
          <Field label="Time"><input type="time" value={row.time || ''} onChange={(event) => updateRow(index, { time: event.target.value })} /></Field>
          <Field label="Status"><select value={row.status || 'scheduled'} onChange={(event) => updateRow(index, { status: event.target.value })}><option value="scheduled">Scheduled</option><option value="documented">Documented, result unavailable</option><option value="played">Played, result pending</option><option value="final">Final</option></select></Field>
          <Field label="Location"><input value={row.location || ''} onChange={(event) => updateRow(index, { location: event.target.value })} /></Field>
          <Field label="Game page URL"><input type="url" value={row.sourceUrl || ''} onChange={(event) => updateRow(index, { sourceUrl: event.target.value })} placeholder="https://" /></Field>
          <RemoveButton label={`Remove ${row.awayTeam || 'away team'} at ${row.homeTeam || 'home team'}`} onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))} />
        </div>)}
        {!rows.length && <p className="tournament-admin-empty-row">No event games yet. Add the schedule once and the rest of the tournament module will use it.</p>}
      </div>
    </section>
  );
}

function StandingsEditor({ rows, setRows }) {
  const updateRow = (index, patch) => setRows(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  const number = (event) => event.target.value === '' ? 0 : Number(event.target.value);
  return (
    <section className="tournament-admin-section">
      <ArrayHeader eyebrow="TABLE" title="Tournament standings" detail="Ranks can be entered manually; public sorting still respects points and goal difference." addLabel="Add row" onAdd={() => setRows([...rows, { team: '', rank: rows.length + 1, gamesPlayed: 0, wins: 0, losses: 0, ties: 0, goalsFor: 0, goalsAgainst: 0, points: 0, isGoonSquad: false }])} />
      <div className="tournament-admin-rows">
        {rows.map((row, index) => <div className="tournament-admin-row is-standing" key={`${row.team}-${index}`}>
          <Field label="Rank"><input type="number" min="1" value={row.rank ?? index + 1} onChange={(event) => updateRow(index, { rank: number(event) })} /></Field>
          <Field label="Team"><input value={row.team || ''} onChange={(event) => updateRow(index, { team: event.target.value })} /></Field>
          {['gamesPlayed', 'wins', 'losses', 'ties', 'goalsFor', 'goalsAgainst', 'points'].map((key) => <Field label={({ gamesPlayed: 'GP', wins: 'W', losses: 'L', ties: 'T', goalsFor: 'GF', goalsAgainst: 'GA', points: 'PTS' })[key]} key={key}><input type="number" min="0" value={row[key] ?? 0} onChange={(event) => updateRow(index, { [key]: number(event) })} /></Field>)}
          <label className="tournament-admin-check"><input type="checkbox" checked={Boolean(row.isGoonSquad)} onChange={(event) => updateRow(index, { isGoonSquad: event.target.checked })} /><span>Goonsquad</span></label>
          <RemoveButton label={`Remove ${row.team || 'standing'}`} onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))} />
        </div>)}
        {!rows.length && <p className="tournament-admin-empty-row">No standings entered. Hide the standings tab until the table is available.</p>}
      </div>
    </section>
  );
}

function BracketEditor({ rows, setRows }) {
  const updateRow = (index, patch) => setRows(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  return (
    <section className="tournament-admin-section">
      <ArrayHeader eyebrow="ELIMINATION" title="Bracket matches" detail="Use any round names and match count. Hide the bracket entirely when it is not useful." addLabel="Add match" onAdd={() => setRows([...rows, { id: uniqueId('match'), roundId: 'quarterfinal', roundName: 'Quarterfinal', roundOrder: 1, order: rows.length + 1, label: 'Match', status: 'scheduled', homeTeam: { name: 'TBD' }, awayTeam: { name: 'TBD' }, homeScore: null, awayScore: null, winner: null }])} />
      <div className="tournament-admin-rows">
        {rows.map((row, index) => <div className="tournament-admin-row is-bracket" key={row.id || index}>
          <Field label="Round"><input value={row.roundName || ''} onChange={(event) => updateRow(index, { roundName: event.target.value, roundId: slugify(event.target.value) || row.roundId })} /></Field>
          <Field label="Round order"><input type="number" min="1" value={row.roundOrder ?? 1} onChange={(event) => updateRow(index, { roundOrder: Number(event.target.value) })} /></Field>
          <Field label="Match order"><input type="number" min="1" value={row.order ?? index + 1} onChange={(event) => updateRow(index, { order: Number(event.target.value) })} /></Field>
          <Field label="Match label"><input value={row.label || ''} onChange={(event) => updateRow(index, { label: event.target.value })} /></Field>
          <Field label="Event game ID"><input value={row.eventGameId || ''} onChange={(event) => updateRow(index, { eventGameId: event.target.value })} placeholder="Links this score to its game page" /></Field>
          <Field label="Home team"><input value={row.homeTeam?.name || ''} onChange={(event) => updateRow(index, { homeTeam: { ...row.homeTeam, name: event.target.value } })} /></Field>
          <Field label="Away team"><input value={row.awayTeam?.name || ''} onChange={(event) => updateRow(index, { awayTeam: { ...row.awayTeam, name: event.target.value } })} /></Field>
          <Field label="Home score"><input type="number" min="0" value={row.homeScore ?? ''} onChange={(event) => updateRow(index, { homeScore: event.target.value === '' ? null : Number(event.target.value) })} /></Field>
          <Field label="Away score"><input type="number" min="0" value={row.awayScore ?? ''} onChange={(event) => updateRow(index, { awayScore: event.target.value === '' ? null : Number(event.target.value) })} /></Field>
          <Field label="Status"><select value={row.status || 'scheduled'} onChange={(event) => updateRow(index, { status: event.target.value })}><option value="scheduled">Scheduled</option><option value="final">Final</option></select></Field>
          <Field label="Winner"><select value={row.winner || ''} onChange={(event) => updateRow(index, { winner: event.target.value || null })}><option value="">Not decided</option><option value="home">Home</option><option value="away">Away</option></select></Field>
          <RemoveButton label={`Remove ${row.label || 'match'}`} onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))} />
        </div>)}
        {!rows.length && <p className="tournament-admin-empty-row">No elimination matches entered. The public bracket can stay hidden.</p>}
      </div>
    </section>
  );
}

export default function TournamentAdminPanel({
  tournament,
  configured,
  userId,
  onClose,
  onSaved,
  onDeleted,
}) {
  const [draft, setDraft] = useState(() => tournament ? cloneTournament(tournament) : blankTournament());
  const [activeSection, setActiveSection] = useState('details');
  const [published, setPublished] = useState(tournament?._record?.isPublished ?? true);
  const [busy, setBusy] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tournament) return;
    setDraft(cloneTournament(tournament));
    setPublished(tournament._record?.isPublished ?? true);
    setStatus('');
    setError('');
  }, [tournament]);

  const originalId = tournament?.id || '';
  const isSeed = Boolean(tournament?._record?.isSeed);
  const hasOverride = Boolean(tournament?._record?.hasOverride);
  const isNew = !originalId || draft.id !== originalId;
  const validation = useMemo(() => {
    if (!draft.name.trim()) return 'Tournament name is required.';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(draft.id)) return 'Archive ID must use lowercase words separated by hyphens.';
    if (![draft.display.showOverview, draft.display.showStandings, draft.display.showStats, draft.display.showBracket, draft.display.showGames].some(Boolean)) return 'Keep at least one public tournament section visible.';
    return '';
  }, [draft]);

  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const updateDisplay = (key, value) => setDraft((current) => ({
    ...current,
    display: { ...current.display, [key]: value },
  }));
  const setRows = (key) => (rows) => update(key, rows);

  const prepareForSave = () => {
    const pools = new Map();
    draft.teams.forEach((team) => {
      const poolName = String(team.pool || '').trim();
      if (!poolName) return;
      const poolId = slugify(poolName);
      if (!pools.has(poolId)) pools.set(poolId, { id: poolId, name: poolName, teams: [] });
      pools.get(poolId).teams.push(team.name);
    });
    const teamName = String(draft.teamName || 'Goonsquad').trim();
    const isTeam = (value) => String(value || '').trim().toLowerCase() === teamName.toLowerCase();
    const eventsById = new Map(draft.eventGames.map((game) => [game.id, game]));
    const eventForTeamGame = (game) => draft.eventGames.find((eventGame) => (
      eventGame.teamGameId === game.id
      || (
        Number.isFinite(eventGame.officialGameNumber)
        && eventGame.officialGameNumber === game.officialGameNumber
      )
      || (
        eventGame.date === game.date
        && [eventGame.awayTeam, eventGame.homeTeam].some(isTeam)
        && [eventGame.awayTeam, eventGame.homeTeam].includes(game.opponent)
      )
    ));
    const teamGameFromEvent = (eventGame, existingGame = {}) => {
      const teamIsAway = isTeam(eventGame.awayTeam);
      return {
        ...existingGame,
        id: existingGame.id || eventGame.teamGameId || `team-${eventGame.id}`,
        eventGameId: eventGame.id,
        gameNumber: existingGame.gameNumber || draft.games.length + 1,
        officialGameNumber: eventGame.officialGameNumber ?? existingGame.officialGameNumber,
        stage: eventGame.stage,
        stageLabel: eventGame.stageLabel,
        opponent: teamIsAway ? eventGame.homeTeam : eventGame.awayTeam,
        site: teamIsAway ? 'Away' : 'Home',
        scoreFor: teamIsAway ? eventGame.awayScore : eventGame.homeScore,
        scoreAgainst: teamIsAway ? eventGame.homeScore : eventGame.awayScore,
        date: eventGame.date,
        time: eventGame.time,
        location: eventGame.location,
        status: eventGame.status,
        sourceUrl: eventGame.sourceUrl || existingGame.sourceUrl || '',
      };
    };
    const matchedEventIds = new Set();
    const games = draft.games.map((game) => {
      const eventGame = eventForTeamGame(game);
      if (!eventGame) return game;
      matchedEventIds.add(eventGame.id);
      return teamGameFromEvent(eventGame, game);
    });
    draft.eventGames
      .filter((eventGame) => (
        !matchedEventIds.has(eventGame.id)
        && [eventGame.awayTeam, eventGame.homeTeam].some(isTeam)
      ))
      .forEach((eventGame) => games.push(teamGameFromEvent(eventGame)));
    const bracket = draft.bracket.map((match) => {
      const eventGame = eventsById.get(match.eventGameId);
      if (!eventGame) return match;
      return {
        ...match,
        status: eventGame.status,
        homeTeam: { ...match.homeTeam, name: eventGame.homeTeam },
        awayTeam: { ...match.awayTeam, name: eventGame.awayTeam },
        homeScore: eventGame.homeScore,
        awayScore: eventGame.awayScore,
        winner: Number.isFinite(eventGame.homeScore) && Number.isFinite(eventGame.awayScore)
          ? eventGame.homeScore > eventGame.awayScore ? 'home' : eventGame.awayScore > eventGame.homeScore ? 'away' : null
          : null,
      };
    });
    return {
      ...draft,
      pools: [...pools.values()],
      games: games.sort((a, b) => (
        String(a.date || '').localeCompare(String(b.date || ''))
        || String(a.time || '').localeCompare(String(b.time || ''))
        || (a.officialGameNumber ?? 0) - (b.officialGameNumber ?? 0)
      )),
      bracket,
    };
  };

  const run = async (key, operation) => {
    setBusy(key);
    setStatus('');
    setError('');
    try {
      await operation();
    } catch (requestError) {
      setError(requestError?.message || 'Tournament changes could not be saved.');
    } finally {
      setBusy('');
    }
  };

  const save = () => run('save', async () => {
    if (validation) throw new Error(validation);
    if (originalId && draft.id !== originalId && hasOverride) {
      throw new Error('Duplicate the tournament before changing an existing archive ID.');
    }
    const preparedDraft = prepareForSave();
    await saveTournament(preparedDraft, { isPublished: published, userId });
    setDraft(preparedDraft);
    setStatus(published ? 'Tournament saved and published.' : 'Tournament saved as an admin-only draft.');
    await onSaved(preparedDraft.id);
  });

  const remove = () => run('delete', async () => {
    if (!originalId || !hasOverride) return;
    await deleteTournamentOverride(originalId);
    await onDeleted(originalId, isSeed);
  });

  const startNew = () => {
    setDraft(blankTournament());
    setPublished(false);
    setActiveSection('details');
    setStatus('New tournament started. It stays private until you publish it.');
    setError('');
  };

  const duplicate = () => {
    const next = cloneTournament(draft);
    next.id = `${slugify(next.id || next.name)}-copy`;
    next.name = `${next.name} Copy`;
    next.shortName = `${next.shortName || next.name} Copy`;
    setDraft(next);
    setPublished(false);
    setActiveSection('details');
    setStatus('Copy created as a draft. Rename it, then save.');
    setError('');
  };

  if (!configured) {
    return (
      <section className="tournament-admin-setup">
        <Settings2 aria-hidden="true" />
        <span>ONE-TIME SETUP</span>
        <h2>Tournament control room is ready to activate</h2>
        <p>Run <code>supabase/migrations/202607310004_tournament_control_room.sql</code> once in the Supabase SQL editor. The public archive stays online while this admin database is being activated.</p>
        <button type="button" onClick={onClose}><ArrowLeft aria-hidden="true" /> Back to tournament</button>
      </section>
    );
  }

  return (
    <section className="tournament-admin" aria-labelledby="tournament-admin-title">
      <header className="tournament-admin-header">
        <button type="button" onClick={onClose}><ArrowLeft aria-hidden="true" /> Tournament</button>
        <div><span>ADMIN CONTROL ROOM</span><h2 id="tournament-admin-title">{isNew ? 'Build tournament' : draft.name}</h2><p>Structure, results, and presentation in one place.</p></div>
        <div>
          <button type="button" onClick={startNew}><Plus aria-hidden="true" /> New</button>
          <button type="button" onClick={duplicate}><Copy aria-hidden="true" /> Duplicate</button>
        </div>
      </header>

      <div className="tournament-admin-publish">
        <span className={published ? 'is-live' : 'is-draft'}>{published ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}{published ? 'Published' : 'Admin-only draft'}</span>
        <Toggle checked={published} label="Visible to everyone" detail="Turn off to hide the entire tournament without deleting it" onChange={setPublished} />
      </div>

      {error && <p className="tournament-admin-notice is-error" role="alert">{error}</p>}
      {status && <p className="tournament-admin-notice is-success" role="status"><Check aria-hidden="true" /> {status}</p>}

      <nav className="tournament-admin-nav" aria-label="Tournament editor sections">
        {ADMIN_SECTIONS.map(({ id, label, icon }) => <button key={id} type="button" aria-current={activeSection === id ? 'page' : undefined} onClick={() => setActiveSection(id)}>{createElement(icon, { 'aria-hidden': true })}{label}<small>{({ teams: draft.teams.length, 'event-games': draft.eventGames.length, games: draft.games.length, standings: draft.standings.length, bracket: draft.bracket.length })[id] ?? ''}</small></button>)}
      </nav>

      <form onSubmit={(event) => { event.preventDefault(); save(); }}>
        {activeSection === 'details' && <DetailsEditor draft={draft} update={update} />}
        {activeSection === 'display' && <DisplayEditor draft={draft} update={update} updateDisplay={updateDisplay} />}
        {activeSection === 'teams' && <TeamsEditor rows={draft.teams} setRows={setRows('teams')} />}
        {activeSection === 'event-games' && <EventGamesEditor rows={draft.eventGames} setRows={setRows('eventGames')} tournamentLocation={draft.location} />}
        {activeSection === 'games' && <GamesEditor rows={draft.games} setRows={setRows('games')} tournamentLocation={draft.location} />}
        {activeSection === 'standings' && <StandingsEditor rows={draft.standings} setRows={setRows('standings')} />}
        {activeSection === 'bracket' && <BracketEditor rows={draft.bracket} setRows={setRows('bracket')} />}

        <footer className="tournament-admin-actions">
          <div><strong>{published ? 'Public update' : 'Private draft'}</strong><small>{validation || 'Ready to save'}</small></div>
          {hasOverride && <button type="button" className="is-danger" disabled={Boolean(busy)} onClick={remove}>{busy === 'delete' ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}{isSeed ? 'Reset archive' : 'Delete tournament'}</button>}
          <button type="submit" className="is-primary" disabled={Boolean(busy) || Boolean(validation)}>{busy === 'save' ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <Save aria-hidden="true" />}{published ? 'Save & publish' : 'Save draft'}</button>
        </footer>
      </form>
    </section>
  );
}
