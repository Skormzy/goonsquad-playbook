import { createElement, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BarChart3,
  CalendarDays,
  ChevronRight,
  ExternalLink,
  Film,
  GitBranch,
  MapPin,
  Medal,
  Play,
  Settings2,
  ShieldCheck,
  Table2,
  Trophy,
  Users,
} from 'lucide-react';
import {
  tournamentBracketRounds,
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
  const rounds = tournamentBracketRounds(tournament.bracket);
  return (
    <section className="tournament-bracket-shell">
      <header><div><span>FULL ELIMINATION BRACKET</span><h3>{tournament.finish ? `Tournament finish: ${tournament.finish}` : 'Road to the championship'}</h3></div><small>Swipe rounds on mobile</small></header>
      <div className="tournament-bracket-board">{rounds.map((round, index) => <div key={round.id} className="tournament-bracket-round"><header><span>{String(index + 1).padStart(2, '0')}</span><strong>{round.name}</strong><small>{round.matches.length} matches</small></header>{round.matches.map((match) => <button type="button" key={match.id} className={`tournament-bracket-match ${match.status === 'final' ? 'is-final' : ''}`} onClick={() => match.eventGameId && onSelectGame(match.eventGameId)} disabled={!match.eventGameId}><header><span>{match.label || 'Match'}</span>{match.status === 'final' && <em>FINAL</em>}</header><BracketTeam team={match.awayTeam} score={match.awayScore} winner={match.winner === 'away'} /><BracketTeam team={match.homeTeam} score={match.homeScore} winner={match.winner === 'home'} /></button>)}</div>)}</div>
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
  return (
    <section className="tournament-game-page">
      <header className="tournament-game-page-nav"><button type="button" onClick={onBack}><ArrowLeft aria-hidden="true" /> Back to tournament</button><span>{tournament.shortName || tournament.name}</span>{game.sourceUrl ? <a href={game.sourceUrl} target="_blank" rel="noreferrer">Official source <ExternalLink aria-hidden="true" /></a> : <i>Archive record</i>}</header>
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
      {teamGame && <section className="tournament-game-page-details"><header><div><span>GOONSQUAD GAME FILE</span><h3>Team details and film</h3></div><strong className={`is-${teamGameResult(teamGame)}`}>{teamGame.scoreFor}-{teamGame.scoreAgainst}</strong></header><div className="tournament-game-facts">{Array.isArray(teamGame.periodScoreFor) && <span><small>PERIODS</small>{teamGame.periodScoreFor.map((score, index) => <b key={index}>{score}-{teamGame.periodScoreAgainst?.[index] ?? '—'}</b>)}</span>}{Number.isFinite(teamGame.shotsFor) && <span><small>SHOTS</small><b>{teamGame.shotsFor}-{teamGame.shotsAgainst}</b></span>}{teamGame.shotsStatus && <span><small>SHOTS</small><b>{teamGame.shotsStatus === 'not-recorded' ? 'Not recorded' : 'Incomplete'}</b></span>}</div>{teamGame.media?.length > 0 && <div className="tournament-game-page-media">{teamGame.media.map((media) => <GameVideo key={media.videoId || media.url} media={media} />)}</div>}</section>}
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
