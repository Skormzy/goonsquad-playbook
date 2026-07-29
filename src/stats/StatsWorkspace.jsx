import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardPlus,
  Copy,
  ExternalLink,
  History,
  Layers3,
  RefreshCw,
  Settings2,
  ShieldCheck,
  ChevronsUpDown,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';
import { useAccount } from '../account/AccountContext';
import { useTheme } from '../context/ThemeContext';
import {
  addRosterPlayer,
  loadStatisticsDataset,
  recordGameResult,
  saveGoalieGameLine,
  savePlayerGameLine,
} from './statsCloud';
import {
  ALL_SEASON_TEAMS_ID,
  formatGameDate,
  formatPercentage,
  formatScheduleName,
  statsSnapshot,
} from './statsModel';
import {
  DEFAULT_LEADERBOARD_SORT,
  nextLeaderboardSort,
  sortLeaderboard,
} from './leaderboardSort';
import {
  nextUpcomingGame,
  STATS_REFRESH_INTERVAL_MS,
} from './scheduleFreshness';

const TABS = Object.freeze([
  { id: 'overview', label: 'Overview' },
  { id: 'games', label: 'Games' },
  { id: 'players', label: 'Players' },
]);

function initialQueryValue(key) {
  if (typeof window === 'undefined') return '';
  try { return new URL(window.location.href).searchParams.get(key) || ''; } catch { return ''; }
}

function Metric({ label, value, detail }) {
  return (
    <div className="stats-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function EmptyStats({ section }) {
  return (
    <div className="stats-empty-state">
      <BarChart3 aria-hidden="true" />
      <strong>No verified {section} yet</strong>
      <p>Results appear here only after an authorized team manager records them.</p>
    </div>
  );
}

const LEADERBOARD_COLUMNS = Object.freeze([
  { key: 'goals', label: 'Goals' },
  { key: 'assists', label: 'Assists' },
  { key: 'points', label: 'Points' },
]);

function LeadersTable({ players }) {
  const [sort, setSort] = useState(DEFAULT_LEADERBOARD_SORT);
  const leaders = useMemo(() => sortLeaderboard(players, sort).slice(0, 5), [players, sort]);

  return (
    <div className="stats-leaders-scroll">
      <table className="stats-leaders-table" aria-label="Scoring leaders">
        <colgroup>
          <col className="stats-leaders-rank-column" />
          <col className="stats-leaders-player-column" />
          {LEADERBOARD_COLUMNS.map(({ key }) => <col className="stats-leaders-stat-column" key={key} />)}
        </colgroup>
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Rank</span></th>
            <th scope="col">Player</th>
            {LEADERBOARD_COLUMNS.map(({ key, label }) => {
              const active = sort.key === key;
              const nextDirection = active && sort.direction === 'desc' ? 'ascending' : 'descending';
              const SortIcon = !active ? ChevronsUpDown : sort.direction === 'desc' ? ArrowDown : ArrowUp;
              return (
                <th
                  aria-sort={active ? (sort.direction === 'desc' ? 'descending' : 'ascending') : 'none'}
                  data-active={active}
                  key={key}
                  scope="col"
                >
                  <button
                    type="button"
                    aria-label={`${label}${active ? `, sorted ${sort.direction === 'desc' ? 'descending' : 'ascending'}` : ''}. Sort ${nextDirection}.`}
                    aria-pressed={active}
                    onClick={() => setSort((current) => nextLeaderboardSort(current, key))}
                    title={`Sort by ${label.toLowerCase()}`}
                  >
                    <span>{label}</span>
                    <SortIcon aria-hidden="true" />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {leaders.map((line, index) => (
            <tr key={line.playerId}>
              <td className="stats-leaders-rank">{index + 1}</td>
              <td className="stats-leaders-player"><strong>{line.displayName}</strong></td>
              <td className="stats-leaders-number" data-active={sort.key === 'goals'}>{line.goals}</td>
              <td className="stats-leaders-number" data-active={sort.key === 'assists'}>{line.assists}</td>
              <td className="stats-leaders-number" data-active={sort.key === 'points'}>{line.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function resultForGame(game) {
  if (!game || game.status !== 'final') return null;
  if (game.goalsFor > game.goalsAgainst) return 'Win';
  if (game.goalsFor < game.goalsAgainst) return 'Loss';
  return 'Tie';
}

function gameSiteLabel(game) {
  if (game?.venue === 'home') return 'Home';
  if (game?.venue === 'away') return 'Away';
  return 'Neutral';
}

function MatchdayCard({ game, kind, schedules, onOpenGame }) {
  const next = kind === 'next';
  const Icon = next ? CalendarClock : History;
  const schedule = game ? schedules.find((item) => item.id === game.seasonTeamId) : null;
  const result = resultForGame(game);

  return (
    <article className="stats-matchday-card" data-kind={kind} data-result={result?.toLowerCase()}>
      <header>
        <Icon aria-hidden="true" />
        <div>
          <span>{next ? 'NEXT GAME' : 'LATEST RESULT'}</span>
          <small>{game ? formatGameDate(game.scheduledAt) : 'No verified fixture'}</small>
        </div>
      </header>
      {game ? (
        <button type="button" onClick={() => onOpenGame(game.id)} aria-label={`Open ${next ? 'upcoming game' : 'latest result'} against ${game.opponent}`}>
          <div className="stats-matchday-main">
            <div>
              <strong>{next ? `vs ${game.opponent}` : game.opponent}</strong>
              <span>{formatScheduleName(schedule)} · {gameSiteLabel(game)}</span>
            </div>
            <b>{next ? 'VS' : `${game.goalsFor}–${game.goalsAgainst}`}</b>
          </div>
          <footer>
            <span>{next ? 'Open fixture' : `${result}${game.overtime ? ' · OT' : ''}`}</span>
            <ChevronRight aria-hidden="true" />
          </footer>
        </button>
      ) : (
        <div className="stats-matchday-empty">
          <strong>{next ? 'No upcoming game published' : 'No final result published'}</strong>
          <span>The official archive will update when league data is available.</span>
        </div>
      )}
    </article>
  );
}

function GamesTable({ games, showStage = false, showSchedule = false, schedules = [], onOpenGame }) {
  if (!games.length) return <EmptyStats section="game results" />;
  return (
    <div className="stats-table-scroll">
      <table className="stats-table">
        <thead><tr><th>Date</th><th>Opponent</th>{showSchedule && <th>League</th>}{showStage && <th>Stage</th>}<th>Site</th><th>Result</th><th>Score</th>{onOpenGame && <th className="stats-game-detail-column">Details</th>}</tr></thead>
        <tbody>
          {games.map((game) => {
            const final = game.status === 'final';
            const result = !final ? 'Scheduled' : game.goalsFor > game.goalsAgainst ? 'W' : game.goalsFor < game.goalsAgainst ? 'L' : 'T';
            const schedule = schedules.find((item) => item.id === game.seasonTeamId);
            return (
              <tr key={game.id}>
                <td>{formatGameDate(game.scheduledAt)}</td>
                <td>{onOpenGame ? <button type="button" className="stats-game-opponent" onClick={() => onOpenGame(game.id)}><strong>{game.opponent}</strong></button> : <strong>{game.opponent}</strong>}</td>
                {showSchedule && <td><span className="stats-stage-label">{formatScheduleName(schedule)}</span></td>}
                {showStage && <td><span className="stats-stage-label">{game.stage === 'playoffs' ? 'Playoffs' : 'Regular'}</span></td>}
                <td>{game.venue === 'home' ? 'Home' : game.venue === 'away' ? 'Away' : 'Neutral'}</td>
                <td><span className={`stats-result is-${result.toLowerCase()}`}>{result}{game.overtime && final ? ' OT' : ''}</span></td>
                <td>{final ? `${game.goalsFor}–${game.goalsAgainst}` : '—'}</td>
                {onOpenGame && <td className="stats-game-detail-column"><button type="button" className="stats-game-detail-button" aria-label={`View game details against ${game.opponent}`} onClick={() => onOpenGame(game.id)}><span>Details</span><ChevronRight aria-hidden="true" /></button></td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatClock(value) {
  if (!Number.isFinite(value)) return '';
  const minutes = Math.floor(value / 60);
  const seconds = String(value % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function availableTeamMetrics(team) {
  if (!team) return [];
  const metrics = [
    { label: 'Shots for', value: team.shotsFor, detail: 'official game sheet' },
    { label: 'Shots against', value: team.shotsAgainst, detail: 'official game sheet' },
    {
      label: 'Shot share',
      value: team.shotsFor + team.shotsAgainst > 0 ? formatPercentage(team.shotsFor / (team.shotsFor + team.shotsAgainst)) : null,
      detail: 'team shots',
    },
  ];
  if (Number.isFinite(team.powerPlayGoals) && Number.isFinite(team.powerPlayOpportunities)) {
    metrics.push({ label: 'Power play', value: `${team.powerPlayGoals}/${team.powerPlayOpportunities}`, detail: 'goals · chances' });
  }
  if (Number.isFinite(team.faceoffWins) && Number.isFinite(team.faceoffAttempts)) {
    metrics.push({ label: 'Faceoffs', value: `${team.faceoffWins}/${team.faceoffAttempts}`, detail: 'wins · draws' });
  }
  for (const [key, label] of [['blocks', 'Blocks'], ['takeaways', 'Takeaways'], ['turnovers', 'Turnovers']]) {
    if (Number.isFinite(team[key])) metrics.push({ label, value: team[key], detail: 'team total' });
  }
  return metrics.filter((metric) => metric.value !== null && metric.value !== undefined);
}

function goalieResult(line) {
  if (line.wins) return 'W';
  if (line.losses) return 'L';
  if (line.ties) return 'T';
  return '—';
}

function GameDetails({ game, details, onBack, onCopyLink, copied }) {
  if (!game || !details) return null;
  const events = [...details.events].sort((a, b) => a.period - b.period || (a.clockSeconds ?? 0) - (b.clockSeconds ?? 0));
  const final = game.status === 'final';
  const hasPublishedDetails = Boolean(details.team || details.players.length || details.goalies.length || details.events.length);
  const teamMetrics = availableTeamMetrics(details.team);
  const venue = game.venue === 'home' ? 'Home game' : game.venue === 'away' ? 'Away game' : 'Neutral site';
  const result = !final ? 'Scheduled' : game.goalsFor > game.goalsAgainst ? 'Win' : game.goalsFor < game.goalsAgainst ? 'Loss' : 'Tie';
  return (
    <section className="stats-game-page" aria-label={`Game page against ${game.opponent}`}>
      <div className="stats-game-page-toolbar">
        <button type="button" onClick={onBack}><ArrowLeft aria-hidden="true" /> All games</button>
        <div>
          <button type="button" onClick={onCopyLink}><Copy aria-hidden="true" /> {copied ? 'Link copied' : 'Copy link'}</button>
          {game.sourceUrl && <a href={game.sourceUrl} target="_blank" rel="noreferrer">Official game sheet <ExternalLink aria-hidden="true" /></a>}
        </div>
      </div>

      <article className="stats-game-detail">
        <header className="stats-game-hero">
          <div>
            <span>{details.schedule ? `${formatScheduleName(details.schedule).toUpperCase()} · ` : ''}{game.stage === 'playoffs' ? 'PLAYOFFS' : 'REGULAR SEASON'}</span>
            <h2>Goon Squad <b>vs</b> {game.opponent}</h2>
            <p>{formatGameDate(game.scheduledAt)} · {venue}{game.location ? ` · ${game.location}` : ''}</p>
          </div>
          <div className={`stats-game-score is-${result.toLowerCase()}`}>
            <span>{result}{game.overtime && final ? ' · OT' : ''}</span>
            <strong>{final ? `${game.goalsFor}–${game.goalsAgainst}` : 'VS'}</strong>
            <small>{final ? 'Final' : 'Upcoming'}</small>
          </div>
        </header>

        {teamMetrics.length > 0 && <div className="stats-game-detail-metrics">
          {teamMetrics.map((metric) => <Metric key={metric.label} {...metric} />)}
        </div>}

        {!hasPublishedDetails ? <div className="stats-game-unpublished"><BarChart3 aria-hidden="true" /><strong>{final ? 'No detailed game sheet was published' : 'Detailed statistics will appear after the game'}</strong><p>The official fixture is available now. Box-score data will remain blank until York Central or an authorized manager publishes it.</p></div> : <div className="stats-game-detail-grid">
          <section>
            <header><span>GAME EVENTS</span><strong>Scoring and penalties</strong></header>
            {events.length ? <ol className="stats-event-list">{events.map((event) => <li key={event.id}>
              <span>P{event.period}<b>{formatClock(event.clockSeconds)}</b></span>
              <div><small>{event.teamSide === 'us' ? 'GOON SQUAD' : 'OPPONENT'} · {event.eventType.toUpperCase()}</small><strong>{event.eventType === 'goal' ? event.detail.scorer : event.detail.player}</strong><p>{event.eventType === 'goal' ? [event.detail.strength, event.detail.assists?.length ? `from ${event.detail.assists.join(', ')}` : 'unassisted'].filter(Boolean).join(' · ') : `${event.detail.minutes} min · ${event.detail.penalty}`}</p></div>
            </li>)}</ol> : <p className="stats-game-detail-empty">No scoring or penalty events were published for this game.</p>}
          </section>
          <section>
            <header><span>PLAYER BOX SCORE</span><strong>Goon Squad game sheet</strong></header>
            {details.players.length ? <div className="stats-table-scroll"><table className="stats-table is-game-players"><thead><tr><th>Player</th><th>G</th><th>A</th><th>PTS</th><th>PIM</th><th>PPG</th><th>SHG</th><th>ENG</th></tr></thead><tbody>{details.players.map((line) => <tr key={line.id}><td><strong>{line.displayName}</strong></td><td>{line.goals}</td><td>{line.assists}</td><td><b>{line.points}</b></td><td>{line.penaltyMinutes}</td><td>{line.powerPlayGoals}</td><td>{line.shortHandedGoals}</td><td>{line.emptyNetGoals}</td></tr>)}</tbody></table></div> : <p className="stats-game-detail-empty">No field-player lines were published for this game.</p>}
            {details.goalies.length > 0 && <div className="stats-detail-goalies"><header><span>GOALTENDING</span><strong>Complete game line</strong></header><div className="stats-table-scroll"><table className="stats-table"><thead><tr><th>Goalie</th><th>Result</th><th>SA</th><th>SV</th><th>GA</th><th>SV%</th><th>MIN</th><th>SO</th></tr></thead><tbody>{details.goalies.map((line) => <tr key={line.id}><td><strong>{line.displayName}</strong></td><td>{goalieResult(line)}</td><td>{line.shotsAgainst}</td><td>{line.saves}</td><td>{line.goalsAgainst}</td><td>{formatPercentage(line.savePercentage)}</td><td>{line.minutesPlayed}</td><td>{line.shutouts}</td></tr>)}</tbody></table></div></div>}
          </section>
        </div>}
      </article>
    </section>
  );
}

function PlayerTables({ fieldPlayers, goalies }) {
  if (!fieldPlayers.length && !goalies.length) return <EmptyStats section="player statistics" />;
  const leagueTotals = fieldPlayers.some((line) => line.source === 'league');
  return (
    <div className="stats-player-tables">
      {fieldPlayers.length > 0 && (
        <section>
          <header><span>FIELD PLAYERS</span><strong>Season totals</strong></header>
          <div className="stats-table-scroll">
            <table className="stats-table is-players">
              <thead><tr><th>Player</th><th>GP</th><th>G</th><th>A</th><th>PTS</th><th>PTS/GP</th>{leagueTotals ? <><th>PIM</th><th>PPG</th><th>SHG</th></> : <><th>SH</th><th>SH%</th><th>PIM</th><th>+/−</th></>}</tr></thead>
              <tbody>{fieldPlayers.map((line) => (
                <tr key={line.playerId}><td><strong>{line.displayName}</strong></td><td>{line.gamesPlayed}</td><td>{line.goals}</td><td>{line.assists}</td><td><b>{line.points}</b></td><td>{line.pointsPerGame.toFixed(2)}</td>{leagueTotals ? <><td>{line.penaltyMinutes}</td><td>{line.powerPlayGoals}</td><td>{line.shortHandedGoals}</td></> : <><td>{line.shots}</td><td>{formatPercentage(line.shootingPercentage)}</td><td>{line.penaltyMinutes}</td><td>{line.plusMinus > 0 ? `+${line.plusMinus}` : line.plusMinus}</td></>}</tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}
      {goalies.length > 0 && (
        <section>
          <header><span>GOALTENDERS</span><strong>Season totals</strong></header>
          <div className="stats-table-scroll">
            <table className="stats-table is-players">
              <thead><tr><th>Player</th><th>GP</th><th>W</th><th>L</th><th>T</th><th>SA</th><th>GA</th><th>SV%</th><th>GAA</th><th>SO</th></tr></thead>
              <tbody>{goalies.map((line) => (
                <tr key={line.playerId}><td><strong>{line.displayName}</strong></td><td>{line.gamesPlayed}</td><td>{line.wins}</td><td>{line.losses}</td><td>{line.ties}</td><td>{line.shotsAgainst}</td><td>{line.goalsAgainst}</td><td>{formatPercentage(line.savePercentage)}</td><td>{line.goalsAgainstAverage.toFixed(2)}</td><td>{line.shutouts}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function ScheduleCoverage({ schedules, onSelect }) {
  return (
    <section className="stats-band is-full">
      <header><Layers3 aria-hidden="true" /><div><span>LEAGUE COVERAGE</span><h2>Every Goonsquad schedule</h2></div></header>
      <div className="stats-schedule-list">
        {schedules.map(({ team, label, summary, games, scheduleComplete }) => {
          const record = `${summary.wins}–${summary.losses}–${summary.ties}`;
          return (
            <div className="stats-schedule-row" key={team.id}>
              <button type="button" onClick={() => onSelect(team.id)}>
                <span className="stats-schedule-status" data-complete={scheduleComplete}>{scheduleComplete ? 'Verified' : 'Review'}</span>
                <span className="stats-schedule-copy"><strong>{label}</strong><small>{team.division || 'Official league schedule'}</small></span>
                <span className="stats-schedule-record"><strong>{summary.gamesPlayed ? record : '—'}</strong><small>{games.length} scheduled · {summary.gamesPlayed} final</small></span>
                <ChevronRight aria-hidden="true" />
              </button>
              {team.sourceUrl && <a href={team.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Open official source for ${label}`}><ExternalLink aria-hidden="true" /></a>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function NumberField({ label, value, onChange, min = 0 }) {
  return <label><span>{label}</span><input type="number" min={min} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function StatsManager({ dataset, onClose, onUpdated, snapshot }) {
  const [mode, setMode] = useState('game');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [roster, setRoster] = useState({ displayName: '', jerseyNumber: '', position: 'C' });
  const [game, setGame] = useState({ scheduledAt: '', opponent: '', venue: 'home', goalsFor: 0, goalsAgainst: 0, overtime: false, notes: '' });
  const [line, setLine] = useState({ type: 'field', gameId: '', playerId: '', goals: 0, assists: 0, shots: 0, penaltyMinutes: 0, plusMinus: 0, blocks: 0, takeaways: 0, turnovers: 0, result: 'win', goalsAgainst: 0, shotsAgainst: 0, saves: 0, shutout: false, minutesPlayed: 30 });
  const rosterPlayers = snapshot.memberships
    .filter((membership) => membership.persisted !== false)
    .map((membership) => dataset.players.find((player) => player.id === membership.playerId))
    .filter((player) => player?.persisted !== false);
  const finalGames = snapshot.games.filter((item) => item.status === 'final' && item.persisted !== false);

  const run = async (operation, message) => {
    setBusy(true);
    setStatus('');
    try {
      await operation();
      setStatus(message);
      await onUpdated();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Statistics update failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stats-manager-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="stats-manager" role="dialog" aria-modal="true" aria-labelledby="stats-manager-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="stats-manager-header">
          <div><span>AUTHORIZED ENTRY</span><h2 id="stats-manager-title">Manage {snapshot.team?.name}</h2></div>
          <button type="button" onClick={onClose} aria-label="Close statistics manager" title="Close"><X aria-hidden="true" /></button>
        </header>
        <div className="stats-manager-tabs" role="tablist" aria-label="Statistics entry type">
          <button type="button" role="tab" aria-selected={mode === 'game'} onClick={() => setMode('game')}>Game</button>
          <button type="button" role="tab" aria-selected={mode === 'roster'} onClick={() => setMode('roster')}>Roster</button>
          <button type="button" role="tab" aria-selected={mode === 'line'} onClick={() => setMode('line')}>Player line</button>
        </div>

        {mode === 'game' && <form className="stats-manager-form" onSubmit={(event) => {
          event.preventDefault();
          run(() => recordGameResult({ ...game, seasonTeamId: snapshot.team.id }), 'Verified game saved.');
        }}>
          <label><span>Date and time</span><input type="datetime-local" required value={game.scheduledAt} onChange={(event) => setGame({ ...game, scheduledAt: event.target.value })} /></label>
          <label><span>Opponent</span><input required value={game.opponent} maxLength="100" onChange={(event) => setGame({ ...game, opponent: event.target.value })} /></label>
          <label><span>Site</span><select value={game.venue} onChange={(event) => setGame({ ...game, venue: event.target.value })}><option value="home">Home</option><option value="away">Away</option><option value="neutral">Neutral</option></select></label>
          <div className="stats-manager-grid"><NumberField label="Goon Squad" value={game.goalsFor} onChange={(value) => setGame({ ...game, goalsFor: value })} /><NumberField label="Opponent" value={game.goalsAgainst} onChange={(value) => setGame({ ...game, goalsAgainst: value })} /></div>
          <label className="stats-checkbox"><input type="checkbox" checked={game.overtime} onChange={(event) => setGame({ ...game, overtime: event.target.checked })} /><span>Overtime result</span></label>
          <label><span>Game note</span><textarea value={game.notes} maxLength="500" onChange={(event) => setGame({ ...game, notes: event.target.value })} /></label>
          <button type="submit" disabled={busy || !game.scheduledAt || !game.opponent.trim()}><ClipboardPlus aria-hidden="true" /> Save final result</button>
        </form>}

        {mode === 'roster' && <form className="stats-manager-form" onSubmit={(event) => {
          event.preventDefault();
          run(() => addRosterPlayer({ ...roster, seasonTeamId: snapshot.team.id }), 'Roster player added.');
        }}>
          <label><span>Player name</span><input required value={roster.displayName} maxLength="80" onChange={(event) => setRoster({ ...roster, displayName: event.target.value })} /></label>
          <div className="stats-manager-grid">
            <label><span>Number</span><input value={roster.jerseyNumber} maxLength="3" onChange={(event) => setRoster({ ...roster, jerseyNumber: event.target.value })} /></label>
            <label><span>Primary position</span><select value={roster.position} onChange={(event) => setRoster({ ...roster, position: event.target.value })}><option value="G">Goalie</option><option value="D">Defense</option><option value="C">Center</option><option value="W">Winger</option></select></label>
          </div>
          <button type="submit" disabled={busy || !roster.displayName.trim()}><UserPlus aria-hidden="true" /> Add to roster</button>
        </form>}

        {mode === 'line' && <form className="stats-manager-form" onSubmit={(event) => {
          event.preventDefault();
          const operation = line.type === 'goalie' ? saveGoalieGameLine : savePlayerGameLine;
          run(() => operation(line), 'Player line saved.');
        }}>
          <label><span>Game</span><select required value={line.gameId} onChange={(event) => setLine({ ...line, gameId: event.target.value })}><option value="">Select game</option>{finalGames.map((item) => <option key={item.id} value={item.id}>{formatGameDate(item.scheduledAt)} · {item.opponent}</option>)}</select></label>
          <label><span>Player</span><select required value={line.playerId} onChange={(event) => setLine({ ...line, playerId: event.target.value })}><option value="">Select player</option>{rosterPlayers.map((player) => <option key={player.id} value={player.id}>{player.displayName}</option>)}</select></label>
          <label><span>Stat line</span><select value={line.type} onChange={(event) => setLine({ ...line, type: event.target.value })}><option value="field">Field player</option><option value="goalie">Goalie</option></select></label>
          {line.type === 'field' ? <div className="stats-manager-number-grid">
            {['goals', 'assists', 'shots', 'penaltyMinutes', 'plusMinus', 'blocks', 'takeaways', 'turnovers'].map((key) => <NumberField key={key} label={({ goals: 'Goals', assists: 'Assists', shots: 'Shots', penaltyMinutes: 'PIM', plusMinus: '+/−', blocks: 'Blocks', takeaways: 'Takeaways', turnovers: 'Turnovers' })[key]} min={key === 'plusMinus' ? -20 : 0} value={line[key]} onChange={(value) => setLine({ ...line, [key]: value })} />)}
          </div> : <>
            <label><span>Result</span><select value={line.result} onChange={(event) => setLine({ ...line, result: event.target.value })}><option value="win">Win</option><option value="loss">Loss</option><option value="tie">Tie</option></select></label>
            <div className="stats-manager-number-grid">{['goalsAgainst', 'shotsAgainst', 'saves', 'minutesPlayed'].map((key) => <NumberField key={key} label={({ goalsAgainst: 'Goals against', shotsAgainst: 'Shots against', saves: 'Saves', minutesPlayed: 'Minutes' })[key]} value={line[key]} onChange={(value) => setLine({ ...line, [key]: value })} />)}</div>
            <label className="stats-checkbox"><input type="checkbox" checked={line.shutout} onChange={(event) => setLine({ ...line, shutout: event.target.checked })} /><span>Shutout</span></label>
          </>}
          <button type="submit" disabled={busy || !line.gameId || !line.playerId}><Check aria-hidden="true" /> Save player line</button>
        </form>}
        {status && <p className="stats-manager-status" role="status">{status}</p>}
      </section>
    </div>
  );
}

export default function StatsWorkspace() {
  const { theme, themes } = useTheme();
  const account = useAccount();
  const [dataset, setDataset] = useState(null);
  const [seasonId, setSeasonId] = useState(() => initialQueryValue('season'));
  const [teamId, setTeamId] = useState(() => initialQueryValue('team'));
  const [stage, setStage] = useState(() => initialQueryValue('stage') || 'regular');
  const [tab, setTab] = useState(() => initialQueryValue('game') ? 'games' : 'overview');
  const [selectedGameId, setSelectedGameId] = useState(() => initialQueryValue('game'));
  const [linkCopied, setLinkCopied] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const t = themes[theme];

  const refresh = useCallback(async () => {
    const next = await loadStatisticsDataset();
    setDataset(next);
    setSeasonId((current) => next.seasons.some((season) => season.id === current) ? current : next.seasons.find((season) => season.current)?.id ?? next.seasons[0]?.id ?? '');
    return next;
  }, []);

  useEffect(() => {
    let active = true;
    let loading = false;
    let lastLoadedAt = 0;
    const load = async (force = false) => {
      if (loading || (!force && Date.now() - lastLoadedAt < 60_000)) return;
      loading = true;
      try {
        const next = await loadStatisticsDataset();
        if (!active) return;
        lastLoadedAt = Date.now();
        setDataset(next);
        setSeasonId((current) => next.seasons.some((season) => season.id === current) ? current : next.seasons.find((season) => season.current)?.id ?? next.seasons[0]?.id ?? '');
      } finally {
        loading = false;
      }
    };
    const loadWhenVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    const scheduledLoad = () => {
      if (document.visibilityState === 'visible') load(true);
    };

    load(true);
    const intervalId = window.setInterval(scheduledLoad, STATS_REFRESH_INTERVAL_MS);
    window.addEventListener('focus', loadWhenVisible);
    document.addEventListener('visibilitychange', loadWhenVisible);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', loadWhenVisible);
      document.removeEventListener('visibilitychange', loadWhenVisible);
    };
  }, []);

  useEffect(() => {
    const syncGameFromHistory = () => {
      setSelectedGameId(initialQueryValue('game'));
      setLinkCopied(false);
    };
    window.addEventListener('popstate', syncGameFromHistory);
    return () => window.removeEventListener('popstate', syncGameFromHistory);
  }, []);

  const snapshot = useMemo(() => {
    if (!dataset) return null;
    const requested = statsSnapshot(dataset, seasonId, teamId, stage);
    return requested.availableStages.includes(stage) ? requested : statsSnapshot(dataset, seasonId, teamId, 'regular');
  }, [dataset, seasonId, teamId, stage]);

  const selectedGameContext = useMemo(() => {
    if (!dataset || !selectedGameId) return null;
    const game = dataset.games.find((item) => item.id === selectedGameId);
    const schedule = game ? dataset.teams.find((item) => item.id === game.seasonTeamId) : null;
    if (!game || !schedule) return null;
    const gameSnapshot = statsSnapshot(dataset, schedule.seasonId, schedule.id, game.stage || 'regular');
    return {
      game,
      details: gameSnapshot.gameDetails[game.id],
      schedule,
    };
  }, [dataset, selectedGameId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !seasonId) return;
    const url = new URL(window.location.href);
    url.searchParams.set('season', seasonId);
    if (snapshot?.team?.id) url.searchParams.set('team', snapshot.team.id);
    else url.searchParams.delete('team');
    if (snapshot?.stage === 'regular') url.searchParams.delete('stage');
    else url.searchParams.set('stage', snapshot?.stage || 'regular');
    if (selectedGameContext?.game.id) url.searchParams.set('game', selectedGameContext.game.id);
    else url.searchParams.delete('game');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [seasonId, selectedGameContext?.game.id, snapshot?.team?.id, snapshot?.stage]);

  if (!dataset || !snapshot) return <div className="stats-loading"><RefreshCw aria-hidden="true" /> Loading team statistics…</div>;

  const canManage = account.configured && ['admin', 'stat_manager'].includes(account.profile?.role) && !snapshot.isSeasonAggregate;
  const { summary } = snapshot;
  const record = `${summary.wins}–${summary.losses}–${summary.ties}`;
  const officialSourceUrl = snapshot.isSeasonAggregate ? dataset.sourceUrl : snapshot.team?.sourceUrl;
  const scheduleCount = snapshot.seasonTeams.length;
  const completedGames = snapshot.games.filter((game) => game.status === 'final');
  const latestGame = completedGames[0] ?? null;
  const nextGame = nextUpcomingGame(snapshot.games);
  const openGame = (gameId) => {
    const url = new URL(window.location.href);
    url.searchParams.set('game', gameId);
    window.history.pushState({ ...window.history.state, statsGamePage: true }, '', `${url.pathname}${url.search}${url.hash}`);
    setSelectedGameId(gameId);
    setLinkCopied(false);
    setTab('games');
  };
  const closeGame = () => {
    if (window.history.state?.statsGamePage) {
      window.history.back();
    } else {
      const url = new URL(window.location.href);
      url.searchParams.delete('game');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      setSelectedGameId('');
    }
    setLinkCopied(false);
    setTab('games');
  };
  const copyGameLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
    } catch {
      setLinkCopied(false);
    }
  };

  return (
    <main className="stats-workspace" style={{
      '--stats-bg': t.bg,
      '--stats-surface': t.sf,
      '--stats-panel': t.cb,
      '--stats-border': t.bd,
      '--stats-text': t.tx,
      '--stats-muted': t.tm,
      '--stats-dim': t.td,
      '--stats-accent': t.ac,
      '--stats-accent-bg': t.ab,
      '--stats-brand': t.br,
    }}>
      {!selectedGameContext && <header className="stats-workspace-header stats-home-hero">
        <div className="stats-title">
          <span>TEAM HOME</span>
          <h1>{snapshot.season?.name || 'Goonsquad'}</h1>
          <p>{snapshot.isSeasonAggregate ? `${scheduleCount} league schedules, one verified team view.` : `${formatScheduleName(snapshot.team)} performance, fixtures, and player totals.`}</p>
        </div>
        <div className="stats-season-controls">
          <label><span>Season</span><select value={snapshot.season?.id ?? ''} onChange={(event) => { setSeasonId(event.target.value); setTeamId(''); setStage('regular'); setSelectedGameId(''); }} disabled={!dataset.seasons.length}>{dataset.seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
          {canManage && <button type="button" className="stats-manage-button" onClick={() => setManagerOpen(true)}><Settings2 aria-hidden="true" /> Manage data</button>}
        </div>
      </header>}

      {selectedGameContext ? <section className="stats-content is-game-page">
        <GameDetails game={selectedGameContext.game} details={selectedGameContext.details} onBack={closeGame} onCopyLink={copyGameLink} copied={linkCopied} />
      </section> : <><div className="stats-team-switcher" role="group" aria-label="League schedule">
        {snapshot.seasonTeams.length > 1 && <button type="button" aria-pressed={snapshot.isSeasonAggregate} onClick={() => { setTeamId(ALL_SEASON_TEAMS_ID); setStage('regular'); setSelectedGameId(''); }}>All teams</button>}
        {snapshot.seasonTeams.map((team) => <button key={team.id} type="button" aria-pressed={snapshot.team?.id === team.id} onClick={() => { setTeamId(team.id); setStage('regular'); setSelectedGameId(''); }}>{formatScheduleName(team)}</button>)}
      </div>

      {snapshot.availableStages.length > 1 && <div className="stats-stage-switcher" role="group" aria-label="Season stage">
        {snapshot.availableStages.map((item) => <button key={item} type="button" aria-pressed={snapshot.stage === item} onClick={() => { setStage(item); setSelectedGameId(''); }}>{item === 'regular' ? 'Regular season' : item === 'playoffs' ? 'Playoffs' : 'All games'}</button>)}
      </div>}

      <section className="stats-matchday-grid" aria-label="Matchday summary">
        <MatchdayCard game={nextGame} kind="next" schedules={snapshot.seasonTeams} onOpenGame={openGame} />
        <MatchdayCard game={latestGame} kind="latest" schedules={snapshot.seasonTeams} onOpenGame={openGame} />
      </section>

      <section className="stats-metric-strip" aria-label="Season summary">
        <Metric label="Record" value={summary.gamesPlayed ? record : '—'} detail={snapshot.isSeasonAggregate ? `${summary.gamesPlayed} games · ${scheduleCount} leagues` : `${summary.gamesPlayed} games`} />
        <Metric label="Goals" value={summary.gamesPlayed ? `${summary.goalsFor}–${summary.goalsAgainst}` : '—'} detail="for · against" />
        <Metric label="Difference" value={summary.gamesPlayed ? `${summary.goalDifference > 0 ? '+' : ''}${summary.goalDifference}` : '—'} detail="goal margin" />
        <Metric label="Win rate" value={summary.gamesPlayed ? formatPercentage(summary.winPercentage) : '—'} detail="final games" />
      </section>

      <nav className="stats-tabs" role="tablist" aria-label="Statistics view">
        {TABS.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}
      </nav>

      <section className="stats-content" role="tabpanel">
        {tab === 'overview' && <div className="stats-overview-grid">
          {snapshot.isSeasonAggregate && <ScheduleCoverage schedules={snapshot.seasonSchedules} onSelect={(id) => { setTeamId(id); setSelectedGameId(''); }} />}
          <section className="stats-band">
            <header><CalendarDays aria-hidden="true" /><div><span>RESULTS</span><h2>Recent results</h2></div></header>
            <GamesTable games={completedGames.slice(0, 5)} showSchedule={snapshot.isSeasonAggregate} schedules={snapshot.seasonTeams} showStage={snapshot.stage === 'all'} onOpenGame={openGame} />
          </section>
          <section className="stats-band">
            <header><UsersRound aria-hidden="true" /><div><span>LEADERS</span><h2>{snapshot.isSeasonAggregate ? 'All-team leaders' : 'Team leaders'}</h2></div></header>
            {snapshot.fieldPlayers.length ? <LeadersTable players={snapshot.fieldPlayers} /> : <EmptyStats section="player statistics" />}
          </section>
        </div>}
        {tab === 'games' && <div className="stats-game-view"><section className="stats-band is-full"><header><CalendarDays aria-hidden="true" /><div><span>{snapshot.isSeasonAggregate ? 'ALL LEAGUES' : formatScheduleName(snapshot.team).toUpperCase()}</span><h2>Schedule and results</h2></div></header><GamesTable games={snapshot.games} showSchedule={snapshot.isSeasonAggregate} schedules={snapshot.seasonTeams} showStage={snapshot.stage === 'all'} onOpenGame={openGame} /></section></div>}
        {tab === 'players' && <PlayerTables fieldPlayers={snapshot.fieldPlayers} goalies={snapshot.goalies} />}
      </section>
      </>}

      <footer className="stats-data-note"><ShieldCheck aria-hidden="true" /><span>{dataset.seasons.length} seasons · {dataset.teams.length} league schedules · {dataset.games.length} games. Verified {dataset.capturedAt ? formatGameDate(dataset.capturedAt) : 'league archive'}.</span>{officialSourceUrl && <a href={officialSourceUrl} target="_blank" rel="noreferrer">Official source <ExternalLink aria-hidden="true" /></a>}</footer>
      {managerOpen && <StatsManager dataset={dataset} snapshot={snapshot} onClose={() => setManagerOpen(false)} onUpdated={refresh} />}
    </main>
  );
}
