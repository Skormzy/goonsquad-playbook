import { createElement, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronRight,
  CircleDot,
  ExternalLink,
  Film,
  GitBranch,
  MapPin,
  Play,
  ShieldCheck,
  Table2,
  Trophy,
} from 'lucide-react';
import {
  sortedTournamentStandings,
  tournamentBracketRounds,
  tournamentById,
  tournamentSummary,
} from './tournamentModel';
import './tournamentWorkspace.css';

const TOURNAMENT_TABS = Object.freeze([
  { id: 'overview', label: 'Overview', icon: Trophy },
  { id: 'standings', label: 'Standings', icon: Table2 },
  { id: 'bracket', label: 'Bracket', icon: GitBranch },
  { id: 'games', label: 'Games', icon: Film },
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
        </button>
      ))}
    </div>
  );
}

function ArchiveNotice({ title, children, sourceUrl }) {
  return (
    <section className="tournament-archive-notice">
      <ShieldCheck aria-hidden="true" />
      <div>
        <span>VERIFIED ARCHIVE</span>
        <h3>{title}</h3>
        <p>{children}</p>
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
    { label: 'Games documented', value: summary.documentedGames, detail: `${summary.opponents} opponents` },
    { label: 'Tournament record', value: summary.record, detail: summary.scoredGames ? `${summary.scoredGames} scored games` : 'scores needed' },
    { label: 'Game footage', value: summary.videoAngles, detail: 'camera angles' },
    { label: 'Format', value: tournament.format || 'Pending', detail: tournament.division || 'division pending' },
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
        <span>GAME {String(game.gameNumber).padStart(2, '0')}</span>
        <em className={`is-${resultTone(game)}`}>{scoreLabel(game)}</em>
      </header>
      <div className="tournament-game-matchup">
        <div>
          <small>GOON SQUAD</small>
          <strong>vs {game.opponent}</strong>
        </div>
        <Trophy aria-hidden="true" />
      </div>
      <footer>
        <span>{game.stageLabel || game.stage}</span>
        {game.media?.length ? <span>{game.media.length} views</span> : <span>Video pending</span>}
      </footer>
      {primaryMedia && <GameVideo media={primaryMedia} compact />}
    </article>
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
          <button type="button" onClick={onOpenGames}>
            Full game archive
            <ChevronRight aria-hidden="true" />
          </button>
        </header>
        <div className="tournament-game-grid">
          {tournament.games.map((game) => <TournamentGameCard key={game.id} game={game} />)}
        </div>
      </section>
      <ArchiveNotice title="What is verified today" sourceUrl={tournament.sourceUrl}>
        {tournament.verificationNote || tournament.summary}
      </ArchiveNotice>
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
        <span>POOL STANDINGS</span>
        <h3>{tournament.name}</h3>
      </header>
      <div className="tournament-standings-table" role="table" aria-label={`${tournament.name} standings`}>
        <div role="row" className="is-header">
          <span role="columnheader">Rank</span>
          <span role="columnheader">Team</span>
          <span role="columnheader">GP</span>
          <span role="columnheader">W</span>
          <span role="columnheader">L</span>
          <span role="columnheader">T</span>
          <span role="columnheader">Diff</span>
          <span role="columnheader">Pts</span>
        </div>
        {standings.map((row) => {
          const difference = (row.goalsFor ?? 0) - (row.goalsAgainst ?? 0);
          return (
            <div key={row.team} role="row" className={row.isGoonSquad ? 'is-goonsquad' : ''}>
              <strong role="cell">{row.rank}</strong>
              <span role="cell"><b>{row.team}</b>{row.isGoonSquad && <small>OUR TEAM</small>}</span>
              <span role="cell">{row.gamesPlayed ?? 0}</span>
              <span role="cell">{row.wins ?? 0}</span>
              <span role="cell">{row.losses ?? 0}</span>
              <span role="cell">{row.ties ?? 0}</span>
              <span role="cell">{difference > 0 ? '+' : ''}{difference}</span>
              <strong role="cell">{row.points ?? 0}</strong>
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
  const rounds = useMemo(
    () => tournamentBracketRounds(tournament.bracket),
    [tournament.bracket],
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
            <header><span>02</span><strong>Elimination</strong><small>archive needed</small></header>
            <div className="tournament-bracket-empty">
              <GitBranch aria-hidden="true" />
              <strong>Official bracket pending</strong>
              <span>Quarterfinal, semifinal, and final placement will appear here once the event sheet is recovered.</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="tournament-bracket-shell">
      <header>
        <div><span>TOURNAMENT PATH</span><h3>Elimination bracket</h3></div>
        <small>Swipe rounds on mobile</small>
      </header>
      <div className="tournament-bracket-board">
        {rounds.map((round, index) => (
          <div key={round.id} className="tournament-bracket-round">
            <header><span>{String(index + 1).padStart(2, '0')}</span><strong>{round.name}</strong><small>{round.matches.length} matches</small></header>
            {round.matches.map((match) => <BracketMatch key={match.id} match={match} />)}
          </div>
        ))}
      </div>
    </section>
  );
}

function TournamentGames({ tournament }) {
  return (
    <section className="tournament-games">
      <header>
        <div>
          <span>GAME ARCHIVE</span>
          <h3>Every documented matchup</h3>
        </div>
        <small>{tournament.games.reduce((total, game) => total + (game.media?.length || 0), 0)} video angles</small>
      </header>
      <div>
        {tournament.games.map((game) => (
          <article key={game.id} className="tournament-game-row">
            <div className="tournament-game-number">
              <small>GAME</small>
              <strong>{String(game.gameNumber).padStart(2, '0')}</strong>
            </div>
            <div className="tournament-game-copy">
              <span>{game.stageLabel || game.stage}</span>
              <h4>Goon Squad <b>vs</b> {game.opponent}</h4>
              <p>{[
                game.date ? formatTournamentDate(game.date) : tournamentDateRange(tournament),
                formatTournamentTime(game.time),
                game.site,
                game.location || tournament.location,
              ].filter(Boolean).join(' · ')}</p>
            </div>
            <strong className={`tournament-game-score is-${resultTone(game)}`}>{scoreLabel(game)}</strong>
            <div className="tournament-game-media">
              {game.media?.length
                ? game.media.map((media) => <GameVideo key={media.videoId || media.url} media={media} />)
                : <span>Game footage pending</span>}
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
}) {
  const tournament = tournamentById(tournaments, selectedTournamentId);
  const [activeTab, setActiveTab] = useState('overview');
  const handleSelectTournament = (tournamentId) => {
    setActiveTab('overview');
    onSelectTournament(tournamentId);
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
    <div className="tournament-workspace">
      <TournamentSelector
        tournaments={tournaments}
        selectedTournamentId={tournament.id}
        onSelectTournament={handleSelectTournament}
      />

      <section className="tournament-hero">
        <div className="tournament-hero-copy">
          <span>TOURNAMENT DOSSIER / {tournament.dataStatus === 'partial' ? 'ARCHIVE IN PROGRESS' : 'VERIFIED'}</span>
          <h2>{tournament.name}</h2>
          <p>{tournament.series}</p>
          <div>
            <span><CalendarDays aria-hidden="true" /> {tournamentDateRange(tournament)}</span>
            <span><MapPin aria-hidden="true" /> {tournament.location}</span>
          </div>
        </div>
        <div className="tournament-hero-mark">
          <Trophy aria-hidden="true" />
          <span>{summary.documentedGames}</span>
          <small>documented games</small>
        </div>
      </section>

      <nav className="tournament-tabs" role="tablist" aria-label="Tournament dossier">
        {TOURNAMENT_TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
          >
            {createElement(icon, { 'aria-hidden': true })}
            {label}
          </button>
        ))}
      </nav>

      <section className="tournament-panel" role="tabpanel">
        {activeTab === 'overview' && (
          <TournamentOverview
            tournament={tournament}
            summary={summary}
            onOpenGames={() => setActiveTab('games')}
          />
        )}
        {activeTab === 'standings' && <TournamentStandings tournament={tournament} />}
        {activeTab === 'bracket' && <TournamentBracket tournament={tournament} />}
        {activeTab === 'games' && <TournamentGames tournament={tournament} />}
      </section>
    </div>
  );
}
