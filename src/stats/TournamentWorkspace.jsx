import { createElement, useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ExternalLink,
  Film,
  GitBranch,
  Medal,
  MapPin,
  Play,
  Settings2,
  ShieldCheck,
  Table2,
  Trophy,
  Users,
} from 'lucide-react';
import {
  sortedTournamentStandings,
  tournamentBracketRounds,
  tournamentById,
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

function formatTournamentDate(value, options = {}) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('en-CA', {
    month: options.short ? 'short' : 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function tournamentDateRange(tournament, short = false) {
  if (!tournament?.startDate) return 'Dates pending';
  if (!tournament.endDate || tournament.startDate === tournament.endDate) {
    return formatTournamentDate(tournament.startDate, { short });
  }
  const start = new Date(`${tournament.startDate}T12:00:00`);
  const end = new Date(`${tournament.endDate}T12:00:00`);
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  if (sameMonth) {
    const month = new Intl.DateTimeFormat('en-CA', { month: short ? 'short' : 'long' }).format(start);
    return `${month} ${start.getDate()}-${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${formatTournamentDate(tournament.startDate, { short })} - ${formatTournamentDate(tournament.endDate, { short })}`;
}

function formatTournamentTime(value) {
  if (!value) return '';
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const suffix = hours >= 12 ? 'p.m.' : 'a.m.';
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function scoreLabel(game) {
  if (Number.isFinite(game.scoreFor) && Number.isFinite(game.scoreAgainst)) {
    return `${game.scoreFor}-${game.scoreAgainst}`;
  }
  if (game.status === 'played' || game.status === 'final') return 'Result pending';
  if (game.status === 'documented') return 'Score pending';
  return 'Scheduled';
}

function resultTone(game) {
  if (!Number.isFinite(game.scoreFor) || !Number.isFinite(game.scoreAgainst)) return 'pending';
  if (game.scoreFor > game.scoreAgainst) return 'win';
  if (game.scoreFor < game.scoreAgainst) return 'loss';
  return 'tie';
}

function resultLetter(game) {
  const tone = resultTone(game);
  if (tone === 'win') return 'W';
  if (tone === 'loss') return 'L';
  if (tone === 'tie') return 'T';
  return '—';
}

function formatPercentage(value) {
  if (!Number.isFinite(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

function formatDifference(value) {
  if (!Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value}`;
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

function ArchiveNotice({ title, children, sourceUrl, source }) {
  return (
    <section className="tournament-archive-notice">
      <ShieldCheck aria-hidden="true" />
      <div>
        <span>{source?.provider ? `${source.provider} RECEIPT` : 'VERIFIED ARCHIVE'}</span>
        <h3>{title}</h3>
        <p>{children}</p>
        {source?.capturedAt && <small>Checked {formatTournamentDate(source.capturedAt)} · Season {source.seasonId}</small>}
      </div>
      {sourceUrl && (
        <a href={sourceUrl} target="_blank" rel="noreferrer">
          Event source
          <ExternalLink aria-hidden="true" />
        </a>
      )}
    </section>
  );
}

function TournamentMetrics({ tournament, summary }) {
  const metrics = [
    {
      label: 'Finish',
      value: tournament.finish || `${summary.documentedGames} games`,
      detail: tournament.finish ? tournament.division : `${summary.opponents} opponents`,
    },
    {
      label: 'Tournament record',
      value: summary.record,
      detail: summary.scoredGames ? `${summary.goalsFor} GF · ${summary.goalsAgainst} GA` : 'scores needed',
    },
    {
      label: tournament.pool?.name || 'Game footage',
      value: tournament.pool?.record || summary.videoAngles,
      detail: tournament.pool?.finish ? `Finished ${tournament.pool.finish === 1 ? '1st' : `#${tournament.pool.finish}`}` : 'camera angles',
    },
    {
      label: 'Goal differential',
      value: summary.scoredGames ? formatDifference(summary.goalDifferential) : tournament.format || 'Pending',
      detail: summary.scoredGames ? `${summary.goalsFor}-${summary.goalsAgainst} scoring` : tournament.division || 'division pending',
    },
  ];
  return (
    <section className="tournament-metric-strip" aria-label="Tournament snapshot">
      {metrics.map((metric) => (
        <div key={metric.label}>
          <span>{metric.label}</span>
          <strong>{metric.value}</strong>
          <small>{metric.detail}</small>
        </div>
      ))}
    </section>
  );
}

function TournamentField({ tournament }) {
  const teams = tournament.teams?.length
    ? tournament.teams
    : [
      { id: 'goonsquad', name: tournament.teamName || 'Goonsquad', isGoonSquad: true },
      ...tournament.games.map((game) => ({ id: game.opponent, name: game.opponent })),
    ];
  const uniqueTeams = [...new Map(teams.filter((team) => team.name).map((team) => [team.name, team])).values()];
  if (uniqueTeams.length < 2) return null;
  return (
    <section className="tournament-field" aria-label="Tournament teams">
      <header><Users aria-hidden="true" /><div><span>GOONSQUAD OPPONENTS</span><h3>{uniqueTeams.length - 1} teams on the path</h3></div></header>
      <div>{uniqueTeams.map((team) => <span className={team.isGoonSquad ? 'is-goonsquad' : ''} key={team.id || team.name}><strong>{team.name}</strong>{team.pool && <small>{team.pool}</small>}{team.seed && <small>Seed {team.seed}</small>}</span>)}</div>
    </section>
  );
}

function GameVideo({ media, compact = false }) {
  return (
    <a
      className={`tournament-video ${compact ? 'is-compact' : ''}`}
      href={media.url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Watch ${media.title}`}
    >
      <span className="tournament-video-frame">
        {media.thumbnail && <img src={media.thumbnail} alt="" loading="lazy" />}
        <i><Play aria-hidden="true" /></i>
      </span>
      <span className="tournament-video-copy">
        <small>{media.angle} view</small>
        <strong>Watch game</strong>
      </span>
      <ExternalLink aria-hidden="true" />
    </a>
  );
}

function TournamentGameCard({ game, featured = false }) {
  const primaryMedia = game.media?.[0];
  return (
    <article className={`tournament-game-card ${featured ? 'is-featured' : ''}`}>
      <header>
        <span>{game.stageLabel || game.stage}</span>
        <em className={`is-${resultTone(game)}`}>{resultLetter(game)}</em>
      </header>
      <div className="tournament-game-matchup">
        <div>
          <small>GAME {String(game.gameNumber).padStart(2, '0')}{game.officialGameNumber ? ` · OFFICIAL ${game.officialGameNumber}` : ''}</small>
          <strong>vs {game.opponent}</strong>
          <p>{[game.date && formatTournamentDate(game.date, { short: true }), formatTournamentTime(game.time)].filter(Boolean).join(' · ')}</p>
        </div>
        <div className={`tournament-card-score is-${resultTone(game)}`}>
          <b>{Number.isFinite(game.scoreFor) ? game.scoreFor : '–'}</b>
          <i>:</i>
          <b>{Number.isFinite(game.scoreAgainst) ? game.scoreAgainst : '–'}</b>
        </div>
      </div>
      <footer>
        <span>{game.location || 'Venue pending'}</span>
        {game.media?.length ? <span>{game.media.length} views</span> : <span>Video pending</span>}
      </footer>
      {primaryMedia && <GameVideo media={primaryMedia} compact />}
    </article>
  );
}

function TournamentLeaders({ tournament }) {
  const leaders = tournament.leaders || [];
  const skaters = (tournament.playerStats || []).slice(0, 5);
  const goalies = tournament.goalieStats || [];
  if (!leaders.length && !skaters.length && !goalies.length) return null;

  return (
    <section className="tournament-leaders">
      <header>
        <div><span>TOURNAMENT LEADERS</span><h3>Who drove the run</h3></div>
        <small>Official GameSheet totals</small>
      </header>
      {leaders.length > 0 && <div className="tournament-leader-cards">
        {leaders.map((leader) => (
          <article key={`${leader.type}-${leader.player}`}>
            <div><Award aria-hidden="true" /><small>{leader.label}</small></div>
            <strong>{leader.value}</strong>
            <h4><b>#{leader.number}</b> {leader.player}</h4>
            <p>{leader.detail}</p>
          </article>
        ))}
      </div>}
      <div className="tournament-leader-detail">
        {skaters.length > 0 && <div className="tournament-scorer-board">
          <header><BarChart3 aria-hidden="true" /><div><span>TOP FIVE</span><strong>Scoring</strong></div></header>
          {skaters.map((player) => (
            <div key={player.name}>
              <b>#{player.number}</b>
              <span>{player.name}<small>{player.gamesPlayed} GP</small></span>
              <em>{player.goals}<small>G</small></em>
              <em>{player.assists}<small>A</small></em>
              <strong>{player.points}<small>PTS</small></strong>
            </div>
          ))}
        </div>}
        {goalies.length > 0 && <div className="tournament-goalie-board">
          <header><Medal aria-hidden="true" /><div><span>GOALTENDING</span><strong>Last line</strong></div></header>
          {goalies.map((goalie) => (
            <article key={goalie.name}>
              <div><b>#{goalie.number}</b><span>{goalie.name}</span></div>
              <strong>{goalie.wins}-{goalie.losses}<small>RECORD</small></strong>
              <strong>{goalie.goalsAgainstAverage.toFixed(2)}<small>GAA</small></strong>
              <strong>{goalie.shutouts}<small>SO</small></strong>
            </article>
          ))}
        </div>}
      </div>
    </section>
  );
}

function TournamentOverview({ tournament, summary, onOpenGames }) {
  return (
    <div className="tournament-overview">
      <TournamentMetrics tournament={tournament} summary={summary} />
      <section className="tournament-journey">
        <header>
          <div>
            <span>TOURNAMENT RUN</span>
            <h3>Game by game</h3>
          </div>
          {onOpenGames && <button type="button" onClick={onOpenGames}>
            Full game archive
            <ChevronRight aria-hidden="true" />
          </button>}
        </header>
        <div className="tournament-game-grid">
          {tournament.games.map((game) => <TournamentGameCard key={game.id} game={game} />)}
        </div>
      </section>
      <TournamentLeaders tournament={tournament} />
      <TournamentField tournament={tournament} />
      {tournament.display.showVerification && <ArchiveNotice title="Official source receipt" sourceUrl={tournament.sourceUrl} source={tournament.source}>
        {tournament.verificationNote || tournament.summary}
      </ArchiveNotice>}
    </div>
  );
}

function TournamentStandings({ tournament }) {
  const standings = useMemo(
    () => sortedTournamentStandings(tournament.standings),
    [tournament.standings],
  );
  if (!standings.length) {
    return (
      <div className="tournament-data-pending">
        <Table2 aria-hidden="true" />
        <span>POOL TABLE</span>
        <h3>Official standings needed</h3>
        <p>The tournament and its three pool opponents are verified, but the official table was not recoverable from the public archive. No ranks or scores have been guessed.</p>
        <div>
          {tournament.games.map((game) => (
            <span key={game.id}><CircleDot aria-hidden="true" /> {game.opponent}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="tournament-standings">
      <header>
        <div><span>OFFICIAL STANDINGS</span><h3>{tournament.pool?.name || tournament.name}</h3></div>
        {tournament.source?.standingsUrl && <a href={tournament.source.standingsUrl} target="_blank" rel="noreferrer">GameSheet <ExternalLink aria-hidden="true" /></a>}
      </header>
      <div className="tournament-standings-table" role="table" aria-label={`${tournament.name} standings`}>
        <div role="row" className="is-header">
          <span role="columnheader">RK</span>
          <span role="columnheader">Team</span>
          <span role="columnheader">GP</span>
          <span role="columnheader">W</span>
          <span role="columnheader">L</span>
          <span role="columnheader">GF</span>
          <span role="columnheader">GA</span>
          <span role="columnheader">Diff</span>
          <span role="columnheader">PP</span>
          <span role="columnheader">PK</span>
          <span role="columnheader">Pts</span>
        </div>
        {standings.map((row) => {
          const difference = (row.goalsFor ?? 0) - (row.goalsAgainst ?? 0);
          return (
            <div key={row.team} role="row" className={row.isGoonSquad ? 'is-goonsquad' : ''}>
              <strong role="cell" data-label="Rank">{row.rank}</strong>
              <span role="cell"><b>{row.team}</b>{row.isGoonSquad && <small>OUR TEAM</small>}</span>
              <span role="cell" data-label="GP">{row.gamesPlayed ?? 0}</span>
              <span role="cell" data-label="W">{row.wins ?? 0}</span>
              <span role="cell" data-label="L">{row.losses ?? 0}</span>
              <span role="cell" data-label="GF">{row.goalsFor ?? 0}</span>
              <span role="cell" data-label="GA">{row.goalsAgainst ?? 0}</span>
              <span role="cell" data-label="Diff">{formatDifference(difference)}</span>
              <span role="cell" data-label="PP">{formatPercentage(row.powerPlayPercentage)}</span>
              <span role="cell" data-label="PK">{formatPercentage(row.penaltyKillPercentage)}</span>
              <strong role="cell" data-label="Pts">{row.points ?? 0}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BracketTeam({ team, score, winner }) {
  return (
    <div className={winner ? 'is-winner' : ''}>
      <span>{team?.seed ? <small>{team.seed}</small> : null}{team?.name || 'TBD'}</span>
      <strong>{Number.isFinite(score) ? score : '-'}</strong>
    </div>
  );
}

function BracketMatch({ match }) {
  return (
    <article className={`tournament-bracket-match ${match.status === 'final' ? 'is-final' : ''}`}>
      <header><span>{match.label || 'Match'}</span>{match.status === 'final' && <em>FINAL</em>}</header>
      <BracketTeam team={match.homeTeam} score={match.homeScore} winner={match.winner === 'home'} />
      <BracketTeam team={match.awayTeam} score={match.awayScore} winner={match.winner === 'away'} />
    </article>
  );
}

function TournamentBracket({ tournament }) {
  const bracket = useMemo(() => {
    if (tournament.display.bracketMode !== 'team-path') return tournament.bracket;
    const teamName = String(tournament.teamName || 'Goonsquad').toLowerCase();
    return tournament.bracket.filter((match) => [match.homeTeam?.name, match.awayTeam?.name]
      .some((name) => String(name || '').toLowerCase().includes(teamName)));
  }, [tournament.bracket, tournament.display.bracketMode, tournament.teamName]);
  const rounds = useMemo(
    () => tournamentBracketRounds(bracket),
    [bracket],
  );

  if (!rounds.length) {
    return (
      <section className="tournament-bracket-shell is-awaiting">
        <header>
          <div>
            <span>TOURNAMENT PATH</span>
            <h3>Pool play to elimination</h3>
          </div>
          <small>Swipe rounds on mobile</small>
        </header>
        <div className="tournament-bracket-board">
          <div className="tournament-bracket-round">
            <header><span>01</span><strong>Round robin</strong><small>{tournament.games.length} games</small></header>
            {tournament.games.map((game) => (
              <article key={game.id} className="tournament-bracket-match is-known">
                <header><span>Game {game.gameNumber}</span><em>PLAYED</em></header>
                <BracketTeam team={{ name: tournament.teamName }} score={game.scoreFor} />
                <BracketTeam team={{ name: game.opponent }} score={game.scoreAgainst} />
              </article>
            ))}
          </div>
          <div className="tournament-bracket-round is-pending">
            <header><span>02</span><strong>Elimination</strong><small>not published</small></header>
            <div className="tournament-bracket-empty">
              <GitBranch aria-hidden="true" />
              <strong>{tournament.display.bracketMode === 'team-path' ? 'Goonsquad path not entered' : 'Bracket not entered'}</strong>
              <span>An admin can publish the elimination path when it adds useful context to this tournament.</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="tournament-bracket-shell">
      <header>
        <div><span>GOONSQUAD PATH</span><h3>{tournament.finish ? `Road to the ${tournament.finish.toLowerCase()}` : 'Elimination bracket'}</h3></div>
        <small>Swipe the run on mobile</small>
      </header>
      <div className="tournament-bracket-board">
        {rounds.map((round, index) => (
          <div key={round.id} className="tournament-bracket-round">
            <header><span>{String(index + 1).padStart(2, '0')}</span><strong>{round.name}</strong><small>{round.matches.length} matches</small></header>
            {round.matches.map((match) => <BracketMatch key={match.id} match={match} />)}
          </div>
        ))}
      </div>
      {tournament.bracket.some((match) => String(match.label || '').includes('inferred')) && (
        <p className="tournament-path-note"><ShieldCheck aria-hidden="true" /> Scores and official game numbers come from GameSheet. Quarterfinal and semifinal labels follow the recorded elimination sequence.</p>
      )}
    </section>
  );
}

function TournamentGames({ tournament }) {
  return (
    <section className="tournament-games">
      <header>
        <div>
          <span>OFFICIAL GAMEBOOK</span>
          <h3>Every game in the run</h3>
        </div>
        <small>{tournament.games.length} game sheets · {tournament.games.reduce((total, game) => total + (game.media?.length || 0), 0)} video angles</small>
      </header>
      <div>
        {tournament.games.map((game) => (
          <article key={game.id} className="tournament-game-row">
            <div className="tournament-game-number">
              <small>GAME</small>
              <strong>{String(game.gameNumber).padStart(2, '0')}</strong>
              {game.officialGameNumber && <em>#{game.officialGameNumber}</em>}
            </div>
            <div className="tournament-game-copy">
              <span>{game.stageLabel || game.stage}</span>
              <h4>Goonsquad <b>vs</b> {game.opponent}</h4>
              <p>{[
                game.date ? formatTournamentDate(game.date) : tournamentDateRange(tournament),
                formatTournamentTime(game.time),
                game.site,
                game.location || tournament.location,
              ].filter(Boolean).join(' · ')}</p>
              <div className="tournament-game-facts">
                {Array.isArray(game.periodScoreFor) && <span><small>PERIODS</small>{game.periodScoreFor.map((score, index) => <b key={`${game.id}-period-${index}`}>{score}-{game.periodScoreAgainst?.[index] ?? '–'}</b>)}</span>}
                {Number.isFinite(game.shotsFor) && <span><small>SHOTS</small><b>{game.shotsFor}-{game.shotsAgainst}</b></span>}
                {game.shotsStatus && <span><small>SHOTS</small><b>{game.shotsStatus === 'not-recorded' ? 'Not recorded' : 'Incomplete'}</b></span>}
              </div>
            </div>
            <strong className={`tournament-game-score is-${resultTone(game)}`}>{scoreLabel(game)}</strong>
            <div className="tournament-game-media">
              {game.media?.length
                ? game.media.map((media) => <GameVideo key={media.videoId || media.url} media={media} />)
                : <span>Game footage pending</span>}
              {game.sourceUrl && <a className="tournament-official-game" href={game.sourceUrl} target="_blank" rel="noreferrer"><CheckCircle2 aria-hidden="true" /> Official game sheet <ExternalLink aria-hidden="true" /></a>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function TournamentWorkspace({
  tournaments,
  selectedTournamentId,
  onSelectTournament,
  canManage = false,
  controlRoom = { configured: true, loading: false, error: '' },
  userId = '',
  onArchiveRefresh,
}) {
  const tournament = tournamentById(tournaments, selectedTournamentId);
  const [activeTab, setActiveTab] = useState('overview');
  const [adminOpen, setAdminOpen] = useState(false);
  const visibleTabs = useMemo(() => {
    const tabs = TOURNAMENT_TABS.filter((tab) => tournament?.display?.[tab.showKey]);
    return tabs.length ? tabs : [TOURNAMENT_TABS[0]];
  }, [tournament]);
  const resolvedActiveTab = visibleTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : visibleTabs[0].id;

  const handleSelectTournament = (tournamentId) => {
    setActiveTab('overview');
    setAdminOpen(false);
    onSelectTournament(tournamentId);
  };

  const refreshAndSelect = async (tournamentId) => {
    await onArchiveRefresh?.();
    onSelectTournament(tournamentId);
  };

  const handleDeleted = async (tournamentId, resetToSeed) => {
    const next = await onArchiveRefresh?.();
    const nextId = resetToSeed
      ? tournamentId
      : next?.tournaments?.find((item) => item.id !== tournamentId)?.id || '';
    setAdminOpen(false);
    if (nextId) onSelectTournament(nextId);
  };

  const summary = useMemo(() => tournamentSummary(tournament), [tournament]);
  if (!tournament) {
    return (
      <section className="tournament-empty">
        <Trophy aria-hidden="true" />
        <h2>Tournament archive ready</h2>
        <p>Add the first tournament dossier to populate standings, games, and the bracket.</p>
      </section>
    );
  }

  return (
    <div className={`tournament-workspace${adminOpen ? ' is-admin-open' : ''}`} data-layout={tournament.display.layout} data-accent={tournament.display.accent}>
      <TournamentSelector
        tournaments={tournaments}
        selectedTournamentId={tournament.id}
        onSelectTournament={handleSelectTournament}
      />

      {adminOpen ? (
        <TournamentAdminPanel
          tournament={tournament}
          configured={controlRoom.configured}
          userId={userId}
          onClose={() => setAdminOpen(false)}
          onSaved={refreshAndSelect}
          onDeleted={handleDeleted}
        />
      ) : <>

      <section className="tournament-hero">
        <div className="tournament-hero-copy">
          <span>TOURNAMENT DOSSIER / {tournament.dataStatus === 'partial' ? 'ARCHIVE IN PROGRESS' : 'VERIFIED'}</span>
          <h2>{tournament.name}</h2>
          <p>{tournament.series}</p>
          {tournament.summary && <strong className="tournament-hero-summary">{tournament.summary}</strong>}
          <div>
            <span><CalendarDays aria-hidden="true" /> {tournamentDateRange(tournament)}</span>
            <span><MapPin aria-hidden="true" /> {tournament.location}</span>
          </div>
        </div>
        <div className="tournament-hero-mark">
          <Trophy aria-hidden="true" />
          {tournament.finish ? <>
            <span className="is-finish">{tournament.finish}</span>
            <small>{summary.record} · {summary.goalsFor}-{summary.goalsAgainst}</small>
          </> : <>
            <span>{summary.documentedGames}</span>
            <small>documented games</small>
          </>}
        </div>
        {canManage && <button type="button" className="tournament-manage-button" onClick={() => setAdminOpen(true)}><Settings2 aria-hidden="true" /><span>Manage tournament<small>{tournament._record?.isPublished === false ? 'Admin draft' : 'Results, teams & layout'}</small></span></button>}
      </section>

      {canManage && controlRoom.error && <p className="tournament-control-error" role="alert">{controlRoom.error}</p>}

      <nav className="tournament-tabs" role="tablist" aria-label="Tournament dossier">
        {visibleTabs.map(({ id, labelKey, icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={resolvedActiveTab === id}
            onClick={() => setActiveTab(id)}
          >
            {createElement(icon, { 'aria-hidden': true })}
            {tournament.display[labelKey]}
          </button>
        ))}
      </nav>

      <section className="tournament-panel" role="tabpanel">
        {resolvedActiveTab === 'overview' && (
          <TournamentOverview
            tournament={tournament}
            summary={summary}
            onOpenGames={tournament.display.showGames ? () => setActiveTab('games') : null}
          />
        )}
        {resolvedActiveTab === 'standings' && <TournamentStandings tournament={tournament} />}
        {resolvedActiveTab === 'bracket' && <TournamentBracket tournament={tournament} />}
        {resolvedActiveTab === 'games' && <TournamentGames tournament={tournament} />}
      </section>
      </>}
    </div>
  );
}
