import { createElement, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Clock3,
  ExternalLink,
  Film,
  GitBranch,
  MapPin,
  Medal,
  Play,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Table2,
  Trophy,
  Users,
} from 'lucide-react';
import {
  tournamentBracketTree,
  tournamentById,
  tournamentEventGames,
  tournamentGameById,
  tournamentPoolStandings,
  tournamentPools,
  tournamentSummary,
} from './tournamentModel';
import TournamentAdminPanel from './TournamentAdminPanel';
import './tournamentWorkspace.css';

const TOURNAMENT_TABS = Object.freeze([
  { id: 'overview', labelKey: 'overviewLabel', showKey: 'showOverview', icon: Trophy },
  { id: 'standings', labelKey: 'standingsLabel', showKey: 'showStandings', icon: Table2 },
  { id: 'bracket', labelKey: 'bracketLabel', showKey: 'showBracket', icon: GitBranch },
  { id: 'games', labelKey: 'gamesLabel', showKey: 'showGames', icon: Film },
]);

function normalized(value) {
  return String(value || '').trim().toLowerCase();
}

function formatTournamentDate(value, short = false) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('en-CA', {
    month: short ? 'short' : 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function tournamentDateRange(tournament, short = false) {
  if (!tournament?.startDate) return 'Dates pending';
  if (!tournament.endDate || tournament.startDate === tournament.endDate) {
    return formatTournamentDate(tournament.startDate, short);
  }
  const start = new Date(`${tournament.startDate}T12:00:00`);
  const end = new Date(`${tournament.endDate}T12:00:00`);
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    const month = new Intl.DateTimeFormat('en-CA', { month: short ? 'short' : 'long' }).format(start);
    return `${month} ${start.getDate()}-${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${formatTournamentDate(tournament.startDate, short)} - ${formatTournamentDate(tournament.endDate, short)}`;
}

function formatTournamentTime(value) {
  if (!value) return '';
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'p.m.' : 'a.m.'}`;
}

function scoreAvailable(game) {
  return Number.isFinite(game?.awayScore) && Number.isFinite(game?.homeScore);
}

function displayTeamName(value) {
  return String(value || '').replace(/goon\s*squad/giu, 'Goonsquad');
}

function periodLabel(value) {
  const period = String(value || '');
  if (period === '1') return '1st';
  if (period === '2') return '2nd';
  if (period === '3') return '3rd';
  if (period.startsWith('ot')) return 'OT';
  return period ? `P${period}` : '—';
}

function clockValue(value) {
  const [minutes = 0, seconds = 0] = String(value || '').split(':').map(Number);
  return (Number.isFinite(minutes) ? minutes : 0) * 60 + (Number.isFinite(seconds) ? seconds : 0);
}

function chronologicalEvents(events = []) {
  return [...events].sort((a, b) => (
    Number(a.period || 0) - Number(b.period || 0)
    || clockValue(b.clockTime) - clockValue(a.clockTime)
  ));
}

function teamGameResult(game) {
  if (!Number.isFinite(game?.scoreFor) || !Number.isFinite(game?.scoreAgainst)) return 'pending';
  if (game.scoreFor > game.scoreAgainst) return 'win';
  if (game.scoreFor < game.scoreAgainst) return 'loss';
  return 'tie';
}

function gameIncludesTeam(game, teamName = 'Goonsquad') {
  const key = normalized(teamName);
  return normalized(game?.awayTeam) === key || normalized(game?.homeTeam) === key;
}

function teamGameEventId(tournament, teamGame) {
  return tournamentEventGames(tournament).find((game) => (
    game.teamGameId === teamGame.id
    || game.officialGameNumber === teamGame.officialGameNumber
  ))?.id || teamGame.id;
}

function TournamentSelector({ tournaments, selectedTournamentId, onSelectTournament }) {
  return (
    <div className="stats-tournament-selector" role="group" aria-label="Tournament">
      {tournaments.map((tournament) => (
        <button
          key={tournament.id}
          type="button"
          aria-pressed={selectedTournamentId === tournament.id}
          onClick={() => onSelectTournament(tournament.id)}
        >
          <Trophy aria-hidden="true" />
          <span>
            <strong>{tournament.shortName || tournament.name}</strong>
            <small>{tournamentDateRange(tournament, true)}</small>
          </span>
          {tournament._record?.isPublished === false && <em>DRAFT</em>}
        </button>
      ))}
    </div>
  );
}

function GameVideo({ media, compact = false }) {
  return (
    <a className={`tournament-video ${compact ? 'is-compact' : ''}`} href={media.url} target="_blank" rel="noreferrer">
      <span className="tournament-video-frame">
        {media.thumbnail && <img src={media.thumbnail} alt="" loading="lazy" />}
        <i><Play aria-hidden="true" /></i>
      </span>
      <span className="tournament-video-copy"><small>{media.angle} view</small><strong>Watch game</strong></span>
      <ExternalLink aria-hidden="true" />
    </a>
  );
}

function TeamRunCard({ tournament, game, onSelectGame }) {
  const tone = teamGameResult(game);
  return (
    <article className="tournament-game-card">
      <button type="button" className="tournament-score-link" onClick={() => onSelectGame(teamGameEventId(tournament, game))}>
        <header><span>{game.stageLabel || game.stage}</span><em className={`is-${tone}`}>{tone === 'win' ? 'W' : tone === 'loss' ? 'L' : tone === 'tie' ? 'T' : '—'}</em></header>
        <div className="tournament-game-matchup">
          <div>
            <small>GAME {String(game.gameNumber).padStart(2, '0')}{game.officialGameNumber ? ` · OFFICIAL ${game.officialGameNumber}` : ''}</small>
            <strong>vs {game.opponent}</strong>
            <p>{[formatTournamentDate(game.date, true), formatTournamentTime(game.time)].filter(Boolean).join(' · ')}</p>
          </div>
          <div className={`tournament-card-score is-${tone}`}><b>{game.scoreFor ?? '–'}</b><i>:</i><b>{game.scoreAgainst ?? '–'}</b></div>
        </div>
        <footer><span>{game.location || 'Venue pending'}</span><span>Open game <ChevronRight aria-hidden="true" /></span></footer>
      </button>
      {game.media?.[0] && <GameVideo media={game.media[0]} compact />}
    </article>
  );
}

function TournamentMetrics({ tournament, summary }) {
  const metrics = [
    [tournament.finish ? 'Finish' : 'Goonsquad files', tournament.finish || `${summary.documentedGames} documented`, tournament.division],
    ['Goonsquad record', summary.record, `${summary.goalsFor} GF · ${summary.goalsAgainst} GA`],
    [tournament.pool?.name || 'Field', tournament.pool?.record || `${tournament.teams.length} teams`, tournament.pool?.finish ? `Finished #${tournament.pool.finish}` : 'official participants'],
    ['Goal difference', summary.scoredGames ? `${summary.goalDifferential > 0 ? '+' : ''}${summary.goalDifferential}` : 'Pending', tournament.format],
  ];
  return <section className="tournament-metric-strip" aria-label="Tournament snapshot">{metrics.map(([label, value, detail]) => <div key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>)}</section>;
}

function TournamentLeaders({ tournament }) {
  const leaders = tournament.leaders || [];
  const skaters = (tournament.playerStats || []).slice(0, 5);
  const goalies = tournament.goalieStats || [];
  if (!leaders.length && !skaters.length && !goalies.length) return null;
  return (
    <section className="tournament-leaders">
      <header><div><span>GOONSQUAD LEADERS</span><h3>Who drove the run</h3></div><small>Official tournament totals</small></header>
      {leaders.length > 0 && <div className="tournament-leader-cards">{leaders.map((leader) => <article key={`${leader.type}-${leader.player}`}><div><Award aria-hidden="true" /><small>{leader.label}</small></div><strong>{leader.value}</strong><h4><b>#{leader.number}</b> {leader.player}</h4><p>{leader.detail}</p></article>)}</div>}
      <div className="tournament-leader-detail">
        {skaters.length > 0 && <div className="tournament-scorer-board"><header><BarChart3 aria-hidden="true" /><div><span>TOP FIVE</span><strong>Scoring</strong></div></header>{skaters.map((player) => <div key={player.name}><b>#{player.number}</b><span>{player.name}<small>{player.gamesPlayed} GP</small></span><em>{player.goals}<small>G</small></em><em>{player.assists}<small>A</small></em><strong>{player.points}<small>PTS</small></strong></div>)}</div>}
        {goalies.length > 0 && <div className="tournament-goalie-board"><header><Medal aria-hidden="true" /><div><span>GOALTENDING</span><strong>Last line</strong></div></header>{goalies.map((goalie) => <article key={goalie.name}><div><b>#{goalie.number}</b><span>{goalie.name}</span></div><strong>{goalie.wins}-{goalie.losses}<small>RECORD</small></strong><strong>{goalie.goalsAgainstAverage.toFixed(2)}<small>GAA</small></strong><strong>{goalie.shutouts}<small>SO</small></strong></article>)}</div>}
      </div>
    </section>
  );
}

function TournamentOverview({ tournament, summary, onOpenGames, onSelectGame }) {
  return (
    <div className="tournament-overview">
      <TournamentMetrics tournament={tournament} summary={summary} />
      <section className="tournament-journey">
        <header><div><span>GOONSQUAD RUN</span><h3>Game by game</h3></div><button type="button" onClick={onOpenGames}>Full event archive <ChevronRight aria-hidden="true" /></button></header>
        <div className="tournament-game-grid">{tournament.games.map((game) => <TeamRunCard key={game.id} tournament={tournament} game={game} onSelectGame={onSelectGame} />)}</div>
      </section>
      <TournamentLeaders tournament={tournament} />
      <section className="tournament-field"><header><Users aria-hidden="true" /><div><span>FULL FIELD</span><h3>{tournament.teams.length} tournament teams</h3></div></header><div>{tournament.teams.map((team) => <span className={team.isGoonSquad ? 'is-goonsquad' : ''} key={team.id || team.name}><strong>{team.name}</strong>{team.pool && <small>{team.pool}</small>}</span>)}</div></section>
      {tournament.display.showVerification && <section className="tournament-archive-notice"><ShieldCheck aria-hidden="true" /><div><span>OFFICIAL SOURCE RECEIPT</span><h3>What is verified</h3><p>{tournament.verificationNote || tournament.summary}</p>{tournament.source?.capturedAt && <small>Checked {formatTournamentDate(tournament.source.capturedAt)} · {tournament.source.provider}</small>}</div>{tournament.sourceUrl && <a href={tournament.sourceUrl} target="_blank" rel="noreferrer">Event source <ExternalLink aria-hidden="true" /></a>}</section>}
    </div>
  );
}

function StandingsTable({ standings, label }) {
  const hasResults = standings.some((row) => row.gamesPlayed > 0);
  return (
    <section className="tournament-pool-table">
      <header><span>{label}</span><strong>{hasResults ? 'Official preliminary table' : 'Results not preserved'}</strong></header>
      <div className="tournament-standings-table" role="table" aria-label={`${label} standings`}>
        <div role="row" className="is-header"><span>RK</span><span>Team</span><span>GP</span><span>W</span><span>L</span><span>T</span><span>GF</span><span>GA</span><span>DIFF</span><span>PTS</span></div>
        {standings.map((row) => <div role="row" key={row.team} className={row.isGoonSquad ? 'is-goonsquad' : ''}><strong data-label="Rank">{hasResults ? row.rank : '—'}</strong><span><b>{row.team}</b>{row.isGoonSquad && <small>OUR TEAM</small>}</span><span data-label="GP">{row.gamesPlayed}</span><span data-label="W">{row.wins}</span><span data-label="L">{row.losses}</span><span data-label="T">{row.ties}</span><span data-label="GF">{row.goalsFor}</span><span data-label="GA">{row.goalsAgainst}</span><span data-label="Diff">{row.goalsFor - row.goalsAgainst > 0 ? '+' : ''}{row.goalsFor - row.goalsAgainst}</span><strong data-label="Pts">{row.points}</strong></div>)}
      </div>
    </section>
  );
}

function EventGameButton({ game, tournament, onSelectGame, compact = false }) {
  const ours = gameIncludesTeam(game, tournament.teamName);
  return (
    <button type="button" className={`tournament-event-game${ours ? ' is-goonsquad' : ''}${compact ? ' is-compact' : ''}`} onClick={() => onSelectGame(game.id)}>
      <span className="tournament-event-stage">{game.officialGameNumber ? `#${game.officialGameNumber}` : game.stageLabel}</span>
      <span className="tournament-event-matchup"><b>{game.awayTeam}</b><i>at</i><b>{game.homeTeam}</b><small>{[formatTournamentDate(game.date, true), formatTournamentTime(game.time), game.location].filter(Boolean).join(' · ')}</small></span>
      <strong className={scoreAvailable(game) ? '' : 'is-pending'}>{scoreAvailable(game) ? `${game.awayScore}-${game.homeScore}` : 'Result unavailable'}</strong>
      <ChevronRight aria-hidden="true" />
    </button>
  );
}

function TournamentRoundRobin({ tournament, onSelectGame }) {
  const pools = tournamentPools(tournament);
  const [selectedPoolId, setSelectedPoolId] = useState(pools[0]?.id || '');
  const selectedPool = pools.find((pool) => pool.id === selectedPoolId) || pools[0];
  const standings = tournamentPoolStandings(tournament, selectedPool?.id);
  const games = tournamentEventGames(tournament).filter((game) => game.stage === 'round-robin' && selectedPool?.teams.some((team) => normalized(team) === normalized(game.awayTeam) || normalized(team) === normalized(game.homeTeam)));
  return (
    <section className="tournament-round-robin">
      <header><div><span>PRELIMINARY ROUND</span><h3>Every pool, table, and matchup</h3></div><small>{tournamentEventGames(tournament).filter((game) => game.stage === 'round-robin').length} games</small></header>
      <div className="tournament-pool-switcher" role="tablist" aria-label="Tournament pools">{pools.map((pool) => <button type="button" role="tab" aria-selected={pool.id === selectedPool?.id} key={pool.id} onClick={() => setSelectedPoolId(pool.id)}>{pool.name}<small>{pool.teams.length} teams</small></button>)}</div>
      {selectedPool && <StandingsTable standings={standings} label={selectedPool.name} />}
      <div className="tournament-pool-games"><header><span>{selectedPool?.name || 'Pool'} schedule</span><small>Crossovers appear in both affected pools</small></header>{games.map((game) => <EventGameButton key={game.id} game={game} tournament={tournament} onSelectGame={onSelectGame} compact />)}</div>
      {!standings.some((row) => row.gamesPlayed) && <p className="tournament-path-note"><ShieldCheck aria-hidden="true" /> The official schedule survives, but preliminary scores do not. Teams, times, and venues are shown without inventing results.</p>}
    </section>
  );
}

function BracketTeam({ team, score, winner }) {
  return <div className={winner ? 'is-winner' : ''}><span>{team?.seed && <small>{team.seed}</small>}{team?.name || 'TBD'}</span><strong>{Number.isFinite(score) ? score : '—'}</strong></div>;
}

function TournamentBracket({ tournament, onSelectGame }) {
  const rounds = tournamentBracketTree(tournament.bracket);
  const cardWidth = 280;
  const cardHeight = 112;
  const columnGap = 104;
  const firstRoundGap = 28;
  const labelHeight = 62;
  const stride = cardHeight + firstRoundGap;
  const firstRoundMatches = Math.max(rounds[0]?.matches.length || 1, 1);
  const treeHeight = firstRoundMatches * stride - firstRoundGap;
  const boardWidth = rounds.length * cardWidth + Math.max(rounds.length - 1, 0) * columnGap;
  const boardHeight = labelHeight + treeHeight;
  const positions = rounds.map((round, roundIndex) => round.matches.map((match, matchIndex) => ({
    match,
    x: roundIndex * (cardWidth + columnGap),
    y: labelHeight + ((2 ** roundIndex - 1) * stride) / 2 + matchIndex * (2 ** roundIndex) * stride,
  })));
  const connectorPaths = positions.slice(0, -1).flatMap((roundPositions, roundIndex) => {
    const nextPositions = positions[roundIndex + 1] || [];
    return nextPositions.flatMap((target, targetIndex) => {
      const sources = roundPositions.slice(targetIndex * 2, targetIndex * 2 + 2);
      if (!sources.length) return [];
      const sourceX = sources[0].x + cardWidth;
      const targetX = target.x;
      const joinX = sourceX + (targetX - sourceX) / 2;
      const targetY = target.y + cardHeight / 2;
      const firstY = sources[0].y + cardHeight / 2;
      const lastY = sources[sources.length - 1].y + cardHeight / 2;
      return [
        `M ${sourceX} ${firstY} H ${joinX} V ${lastY}`,
        ...sources.slice(1).map((source) => `M ${sourceX} ${source.y + cardHeight / 2} H ${joinX}`),
        `M ${joinX} ${targetY} H ${targetX}`,
      ];
    });
  });
  return (
    <section className="tournament-bracket-shell">
      <header><div><span>FULL ELIMINATION BRACKET</span><h3>{tournament.finish ? `Tournament finish: ${tournament.finish}` : 'Road to the championship'}</h3></div><small>Swipe the bracket on mobile</small></header>
      <div className="tournament-bracket-scroll">
        <div className="tournament-bracket-board" style={{ width: boardWidth, height: boardHeight }}>
          <svg className="tournament-bracket-connectors" width={boardWidth} height={boardHeight} viewBox={`0 0 ${boardWidth} ${boardHeight}`} aria-hidden="true">{connectorPaths.map((path, index) => <path key={`${path}-${index}`} d={path} />)}</svg>
          {rounds.map((round, roundIndex) => <header className="tournament-bracket-round-label" key={round.id} style={{ left: roundIndex * (cardWidth + columnGap), width: cardWidth }}><span>{String(roundIndex + 1).padStart(2, '0')}</span><strong>{round.name}</strong><small>{round.matches.length} matches</small></header>)}
          {positions.flat().map(({ match, x, y }, matchIndex) => <button type="button" key={match.id} className={`tournament-bracket-match ${match.status === 'final' ? 'is-final' : ''}`} style={{ left: x, top: y, width: cardWidth, height: cardHeight }} data-bracket-index={matchIndex} onClick={() => match.eventGameId && onSelectGame(match.eventGameId)} disabled={!match.eventGameId}><header><span>{match.label || 'Match'}</span>{match.status === 'final' && <em>FINAL</em>}</header><BracketTeam team={match.awayTeam} score={match.awayScore} winner={match.winner === 'away'} /><BracketTeam team={match.homeTeam} score={match.homeScore} winner={match.winner === 'home'} /></button>)}
        </div>
      </div>
      <p className="tournament-path-note"><ShieldCheck aria-hidden="true" /> Every recovered elimination result is shown. Select any matchup to open its tournament game page.</p>
    </section>
  );
}

function TournamentGames({ tournament, onSelectGame }) {
  const [filter, setFilter] = useState('all');
  const eventGames = tournamentEventGames(tournament);
  const filters = [
    ['all', 'All games'],
    ['goonsquad', 'Goonsquad'],
    ['round-robin', 'Round robin'],
    ['elimination', 'Elimination'],
  ];
  const games = eventGames.filter((game) => filter === 'all'
    || (filter === 'goonsquad' && gameIncludesTeam(game, tournament.teamName))
    || (filter === 'round-robin' && game.stage === 'round-robin')
    || (filter === 'elimination' && game.stage !== 'round-robin'));
  return (
    <section className="tournament-games">
      <header><div><span>OFFICIAL EVENT GAMEBOOK</span><h3>Every documented matchup</h3></div><small>{eventGames.length} total games</small></header>
      <div className="tournament-game-filters" role="group" aria-label="Filter tournament games">{filters.map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}<small>{id === 'all' ? eventGames.length : id === 'goonsquad' ? eventGames.filter((game) => gameIncludesTeam(game, tournament.teamName)).length : id === 'round-robin' ? eventGames.filter((game) => game.stage === 'round-robin').length : eventGames.filter((game) => game.stage !== 'round-robin').length}</small></button>)}</div>
      <div className="tournament-all-games">{games.map((game) => <EventGameButton key={game.id} game={game} tournament={tournament} onSelectGame={onSelectGame} />)}</div>
    </section>
  );
}

function PlayerLabel({ player }) {
  if (!player?.name) return <strong>Uncredited</strong>;
  return <strong>{player.number ? <small>#{player.number}</small> : null}{player.name}</strong>;
}

function ScoringTimeline({ goals }) {
  const events = chronologicalEvents(goals);
  return (
    <article className="tournament-official-events">
      <header><span>SCORING</span><strong>{events.length} goals</strong></header>
      {events.length ? <div>{events.map((goal) => {
        const assists = [goal.assist1, goal.assist2].filter((assist) => assist?.name);
        const tags = [
          goal.powerPlay && 'PP',
          goal.shortHanded && 'SH',
          goal.gameWinner && 'GWG',
          goal.emptyNet && 'EN',
        ].filter(Boolean);
        return (
          <div className="tournament-official-event is-goal" key={`${goal.id}-${goal.period}-${goal.clockTime}`}>
            <time><b>{periodLabel(goal.period)}</b><span>{goal.clockTime || '—'}</span></time>
            <i aria-hidden="true" />
            <div>
              <small>{displayTeamName(goal.team)}</small>
              <PlayerLabel player={goal.scorer} />
              <p>{assists.length ? `Assists: ${assists.map((assist) => `${assist.name}${assist.number ? ` #${assist.number}` : ''}`).join(', ')}` : 'Unassisted'}</p>
            </div>
            {tags.length > 0 && <em>{tags.join(' · ')}</em>}
          </div>
        );
      })}</div> : <p className="tournament-event-empty">No goals were recorded.</p>}
    </article>
  );
}

function PenaltyTimeline({ penalties }) {
  const events = chronologicalEvents(penalties);
  return (
    <article className="tournament-official-events is-penalties">
      <header><span>PENALTIES</span><strong>{events.length} calls</strong></header>
      {events.length ? <div>{events.map((penalty) => (
        <div className="tournament-official-event is-penalty" key={penalty.id}>
          <time><b>{periodLabel(penalty.period)}</b><span>{penalty.clockTime || '—'}</span></time>
          <ShieldAlert aria-hidden="true" />
          <div>
            <small>{displayTeamName(penalty.team)}</small>
            <PlayerLabel player={penalty.player} />
            <p>{penalty.label}</p>
          </div>
          <em>{penalty.minutes || '—'} MIN</em>
        </div>
      ))}</div> : <p className="tournament-event-empty">No penalties were recorded.</p>}
    </article>
  );
}

function TeamBoxScore({ roster }) {
  const skaters = roster?.players || [];
  const goalies = roster?.goalies || [];
  return (
    <article className="tournament-team-boxscore">
      <header><span>TEAM GAME SHEET</span><h4>{displayTeamName(roster?.team)}</h4></header>
      <div className="tournament-boxscore-table" role="table" aria-label={`${displayTeamName(roster?.team)} player box score`}>
        <div className="is-header" role="row"><span>#</span><span>Player</span><span>G</span><span>A</span><span>PTS</span><span>PIM</span></div>
        {skaters.map((player) => <div role="row" key={player.id}><b>{player.number || '—'}</b><strong>{player.name}</strong><span>{player.stats.g ?? 0}</span><span>{player.stats.a ?? 0}</span><b>{player.stats.pts ?? 0}</b><span>{player.stats.pim ?? 0}</span></div>)}
      </div>
      {goalies.length > 0 && <div className="tournament-goalie-lines"><header><span>GOALIES</span><span>RESULT</span><span>GA</span><span>GAA</span><span>SO</span></header>{goalies.map((goalie) => <div key={goalie.id}><span><b>#{goalie.number}</b>{goalie.name}</span><strong>{goalie.stats.win ? 'W' : goalie.stats.loss ? 'L' : goalie.stats.started ? 'START' : 'DNP'}</strong><span>{goalie.stats.ga ?? 0}</span><span>{Number(goalie.stats.gaa || 0).toFixed(2)}</span><span>{goalie.stats.shutout ?? 0}</span></div>)}</div>}
    </article>
  );
}

function OfficialGameDetails({ details }) {
  if (!details) return null;
  const periods = [...new Set([
    ...Object.keys(details.score?.away?.periods || {}),
    ...Object.keys(details.score?.home?.periods || {}),
  ])].sort((a, b) => Number(a) - Number(b));
  return (
    <section className="tournament-official-detail">
      <header>
        <div><span>OFFICIAL GAME DETAIL</span><h3>Scoring, penalties and player lines</h3></div>
        <div><Clock3 aria-hidden="true" /><strong>{details.goals.length} goals</strong><strong>{details.penalties.length} penalties</strong></div>
      </header>
      {periods.length > 0 && <div className="tournament-period-score" style={{ '--period-count': periods.length }} aria-label="Period scoring"><div><span>Team</span>{periods.map((period) => <span key={period}>{periodLabel(period)}</span>)}<strong>Final</strong></div><div><b>{displayTeamName(details.teams.away)}</b>{periods.map((period) => <span key={period}>{details.score.away.periods?.[period] ?? 0}</span>)}<strong>{details.score.away.final}</strong></div><div><b>{displayTeamName(details.teams.home)}</b>{periods.map((period) => <span key={period}>{details.score.home.periods?.[period] ?? 0}</span>)}<strong>{details.score.home.final}</strong></div></div>}
      <div className="tournament-official-event-grid"><ScoringTimeline goals={details.goals} /><PenaltyTimeline penalties={details.penalties} /></div>
      <div className="tournament-boxscore-grid"><TeamBoxScore roster={details.roster.away} /><TeamBoxScore roster={details.roster.home} /></div>
    </section>
  );
}

function TournamentGamePage({ tournament, game, onBack }) {
  const teamGame = tournament.games.find((item) => (
    item.id === game.teamGameId
    || (
      Number.isFinite(game.officialGameNumber)
      && item.officialGameNumber === game.officialGameNumber
    )
  ));
  const hasScore = scoreAvailable(game);
  const winner = hasScore ? (game.awayScore > game.homeScore ? game.awayTeam : game.homeScore > game.awayScore ? game.homeTeam : 'Tie') : '';
  const sourceUrl = game.sourceUrl || tournament.sourceUrl;
  return (
    <section className="tournament-game-page">
      <header className="tournament-game-page-nav"><button type="button" onClick={onBack}><ArrowLeft aria-hidden="true" /> Back to tournament</button><span>{tournament.shortName || tournament.name}</span>{sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">Official source <ExternalLink aria-hidden="true" /></a> : <i>Archive record</i>}</header>
      <div className="tournament-game-page-hero">
        <div><span>{game.stageLabel || game.stage}{game.officialGameNumber ? ` · OFFICIAL GAME ${game.officialGameNumber}` : ''}</span><h2>{game.awayTeam} <i>at</i> {game.homeTeam}</h2><p>{[formatTournamentDate(game.date), formatTournamentTime(game.time), game.location].filter(Boolean).join(' · ')}</p></div>
        <div className={hasScore ? 'is-final' : 'is-pending'}><small>{hasScore ? 'FINAL' : 'ARCHIVE STATUS'}</small><strong>{hasScore ? `${game.awayScore}-${game.homeScore}` : 'RESULT NOT PUBLISHED'}</strong>{game.overtime && <em>OT</em>}</div>
      </div>
      <div className="tournament-game-page-scoreboard">
        <article className={winner === game.awayTeam ? 'is-winner' : ''}><span>AWAY</span><strong>{game.awayTeam}</strong><b>{hasScore ? game.awayScore : '—'}</b></article>
        <i>VS</i>
        <article className={winner === game.homeTeam ? 'is-winner' : ''}><span>HOME</span><strong>{game.homeTeam}</strong><b>{hasScore ? game.homeScore : '—'}</b></article>
      </div>
      {!hasScore && <section className="tournament-game-page-note"><ShieldCheck aria-hidden="true" /><div><span>HONEST ARCHIVE</span><h3>The fixture is official; the result was not preserved publicly.</h3><p>The app keeps the verified teams, stage, time, and venue without fabricating a score. An admin can add a recovered result later.</p></div></section>}
      {teamGame && (!game.details || teamGame.media?.length > 0) && <section className="tournament-game-page-details"><header><div><span>GOONSQUAD GAME FILE</span><h3>{teamGame.media?.length > 0 ? 'Game film' : 'Team details'}</h3></div><strong className={`is-${teamGameResult(teamGame)}`}>{teamGame.scoreFor}-{teamGame.scoreAgainst}</strong></header>{!game.details && <div className="tournament-game-facts">{Array.isArray(teamGame.periodScoreFor) && <span><small>PERIODS</small>{teamGame.periodScoreFor.map((score, index) => <b key={index}>{score}-{teamGame.periodScoreAgainst?.[index] ?? '—'}</b>)}</span>}{Number.isFinite(teamGame.shotsFor) && <span><small>SHOTS</small><b>{teamGame.shotsFor}-{teamGame.shotsAgainst}</b></span>}{teamGame.shotsStatus && <span><small>SHOTS</small><b>{teamGame.shotsStatus === 'not-recorded' ? 'Not recorded' : 'Incomplete'}</b></span>}</div>}{teamGame.media?.length > 0 && <div className="tournament-game-page-media">{teamGame.media.map((media) => <GameVideo key={media.videoId || media.url} media={media} />)}</div>}</section>}
      <OfficialGameDetails details={game.details} />
      <section className="tournament-game-page-context"><div><span>EVENT</span><strong>{tournament.name}</strong><small>{tournament.division}</small></div><div><span>STAGE</span><strong>{game.stageLabel || game.stage}</strong><small>{game.officialGameNumber ? `Official Game ${game.officialGameNumber}` : 'Documented fixture'}</small></div><div><span>VENUE</span><strong>{game.location || tournament.location}</strong><small>{tournamentDateRange(tournament)}</small></div></section>
    </section>
  );
}

export default function TournamentWorkspace({
  tournaments,
  selectedTournamentId,
  selectedGameId = '',
  onSelectTournament,
  onSelectGame = () => {},
  canManage = false,
  controlRoom = { configured: true, loading: false, error: '' },
  userId = '',
  onArchiveRefresh,
}) {
  const tournament = tournamentById(tournaments, selectedTournamentId);
  const selectedGame = tournament ? tournamentGameById(tournament, selectedGameId) : null;
  const [activeTab, setActiveTab] = useState('overview');
  const [adminOpen, setAdminOpen] = useState(false);
  const visibleTabs = useMemo(() => {
    const tabs = TOURNAMENT_TABS.filter((tab) => tournament?.display?.[tab.showKey]);
    return tabs.length ? tabs : [TOURNAMENT_TABS[0]];
  }, [tournament]);
  const resolvedActiveTab = visibleTabs.some((tab) => tab.id === activeTab) ? activeTab : visibleTabs[0].id;
  const summary = useMemo(() => tournamentSummary(tournament), [tournament]);

  if (!tournament) return <section className="tournament-empty"><Trophy aria-hidden="true" /><h2>Tournament archive ready</h2><p>Add the first tournament dossier to populate the event.</p></section>;
  if (selectedGame) return <TournamentGamePage tournament={tournament} game={selectedGame} onBack={() => onSelectGame('')} />;

  const refreshAndSelect = async (tournamentId) => { await onArchiveRefresh?.(); onSelectTournament(tournamentId); };
  const handleDeleted = async (tournamentId, resetToSeed) => {
    const next = await onArchiveRefresh?.();
    const nextId = resetToSeed ? tournamentId : next?.tournaments?.find((item) => item.id !== tournamentId)?.id || '';
    setAdminOpen(false);
    if (nextId) onSelectTournament(nextId);
  };

  return (
    <div className={`tournament-workspace${adminOpen ? ' is-admin-open' : ''}`} data-layout={tournament.display.layout} data-accent={tournament.display.accent}>
      <TournamentSelector tournaments={tournaments} selectedTournamentId={tournament.id} onSelectTournament={(id) => { setActiveTab('overview'); setAdminOpen(false); onSelectGame(''); onSelectTournament(id); }} />
      {adminOpen ? <TournamentAdminPanel tournament={tournament} configured={controlRoom.configured} userId={userId} onClose={() => setAdminOpen(false)} onSaved={refreshAndSelect} onDeleted={handleDeleted} /> : <>
        <section className="tournament-hero"><div className="tournament-hero-copy"><span>TOURNAMENT DOSSIER / {tournament.dataStatus === 'partial' ? 'VERIFIED PARTIAL ARCHIVE' : 'OFFICIAL EVENT'}</span><h2>{tournament.name}</h2><p>{tournament.series}</p>{tournament.summary && <strong className="tournament-hero-summary">{tournament.summary}</strong>}<div><span><CalendarDays aria-hidden="true" /> {tournamentDateRange(tournament)}</span><span><MapPin aria-hidden="true" /> {tournament.location}</span></div></div><div className="tournament-hero-mark"><Trophy aria-hidden="true" />{tournament.finish ? <><span className="is-finish">{tournament.finish}</span><small>{summary.record} · {summary.goalsFor}-{summary.goalsAgainst}</small></> : <><span>{tournamentEventGames(tournament).length}</span><small>documented games</small></>}</div>{canManage && <button type="button" className="tournament-manage-button" onClick={() => setAdminOpen(true)}><Settings2 aria-hidden="true" /><span>Manage tournament<small>Teams, games, results and layout</small></span></button>}</section>
        {canManage && controlRoom.error && <p className="tournament-control-error" role="alert">{controlRoom.error}</p>}
        <nav className="tournament-tabs" role="tablist" aria-label="Tournament dossier">{visibleTabs.map(({ id, labelKey, icon }) => <button key={id} type="button" role="tab" aria-selected={resolvedActiveTab === id} onClick={() => setActiveTab(id)}>{createElement(icon, { 'aria-hidden': true })}{tournament.display[labelKey]}</button>)}</nav>
        <section className="tournament-panel" role="tabpanel">
          {resolvedActiveTab === 'overview' && <TournamentOverview tournament={tournament} summary={summary} onOpenGames={() => setActiveTab('games')} onSelectGame={onSelectGame} />}
          {resolvedActiveTab === 'standings' && <TournamentRoundRobin tournament={tournament} onSelectGame={onSelectGame} />}
          {resolvedActiveTab === 'bracket' && <TournamentBracket tournament={tournament} onSelectGame={onSelectGame} />}
          {resolvedActiveTab === 'games' && <TournamentGames tournament={tournament} onSelectGame={onSelectGame} />}
        </section>
      </>}
    </div>
  );
}
