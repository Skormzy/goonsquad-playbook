import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  MapPin,
  Search,
  Swords,
  Target,
  TrendingUp,
} from 'lucide-react';
import { formatGameDate, formatPercentage, formatScheduleName } from './statsModel';
import { gameOutcome, opponentSlug } from './opponentModel';
import { isAwaitingResult } from './scheduleFreshness';

function recordLabel(summary) {
  return `${summary.wins}–${summary.losses}–${summary.ties}`;
}

function siteLabel(game) {
  if (game?.venue === 'home') return 'Home';
  if (game?.venue === 'away') return 'Away';
  return 'Neutral';
}

function gameTimeLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time TBD';
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function gameResultLabel(game) {
  const outcome = gameOutcome(game);
  if (outcome === 'scheduled') return 'Scheduled';
  return outcome === 'win' ? 'W' : outcome === 'loss' ? 'L' : 'T';
}

function comparisonInsights(matchup, currentSeasonId, fixture) {
  const currentSeason = matchup.seasons.find((season) => season.seasonId === currentSeasonId);
  const recent = matchup.finalGames.slice(0, 5);
  const relevantSite = fixture?.venue;
  const siteGames = relevantSite
    ? matchup.finalGames.filter((game) => game.venue === relevantSite)
    : matchup.finalGames;
  const siteSummary = siteGames.reduce((summary, game) => {
    const outcome = gameOutcome(game);
    summary.games += 1;
    if (outcome === 'win') summary.wins += 1;
    else if (outcome === 'loss') summary.losses += 1;
    else summary.ties += 1;
    return summary;
  }, { games: 0, wins: 0, losses: 0, ties: 0 });
  const recentGoalsFor = recent.reduce((sum, game) => sum + Number(game.goalsFor || 0), 0);
  const recentGoalsAgainst = recent.reduce((sum, game) => sum + Number(game.goalsAgainst || 0), 0);

  return [
    {
      label: 'This season',
      value: currentSeason?.summary.gamesPlayed
        ? `${recordLabel(currentSeason.summary)} in ${currentSeason.summary.gamesPlayed} meeting${currentSeason.summary.gamesPlayed === 1 ? '' : 's'}`
        : 'No completed meeting yet',
    },
    {
      label: 'Last five',
      value: recent.length
        ? `${(recentGoalsFor / recent.length).toFixed(1)} goals for · ${(recentGoalsAgainst / recent.length).toFixed(1)} against per game`
        : 'No completed meetings in the archive',
    },
    {
      label: fixture ? `${siteLabel(fixture)} history` : 'All sites',
      value: siteSummary.games
        ? `${siteSummary.wins}–${siteSummary.losses}–${siteSummary.ties} across ${siteSummary.games} game${siteSummary.games === 1 ? '' : 's'}`
        : 'No completed games at this site',
    },
  ];
}

export function OpponentDirectory({
  matchups,
  currentGames,
  scopeLabel,
  onOpenOpponent,
}) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const currentSlugs = useMemo(
    () => new Set(currentGames.map((game) => opponentSlug(game.opponent))),
    [currentGames],
  );
  const ordered = useMemo(() => [...matchups].sort((a, b) => {
    const currentDifference = Number(currentSlugs.has(b.slug)) - Number(currentSlugs.has(a.slug));
    if (currentDifference) return currentDifference;
    if (a.nextGame && b.nextGame) return new Date(a.nextGame.scheduledAt) - new Date(b.nextGame.scheduledAt);
    if (a.nextGame) return -1;
    if (b.nextGame) return 1;
    return a.name.localeCompare(b.name);
  }), [currentSlugs, matchups]);
  const filtered = ordered.filter((matchup) => matchup.name.toLocaleLowerCase('en-CA').includes(query.trim().toLocaleLowerCase('en-CA')));
  const visible = query || expanded ? filtered : filtered.slice(0, 8);

  return (
    <section className="stats-band is-full stats-opponent-directory">
      <header>
        <Swords aria-hidden="true" />
        <div>
          <span>OPPONENTS</span>
          <h2>Matchup centre</h2>
          <p>{scopeLabel}</p>
        </div>
        <label className="stats-opponent-search">
          <Search aria-hidden="true" />
          <span className="sr-only">Find an opponent</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find opponent" />
        </label>
      </header>
      <div className="stats-opponent-list">
        {visible.map((matchup) => {
          const next = matchup.nextGame;
          const awaiting = matchup.awaitingResults[0];
          const last = matchup.lastGame;
          const outcome = gameOutcome(last);
          return (
            <button type="button" key={matchup.slug} onClick={() => onOpenOpponent(matchup.slug, next?.id)}>
              <span className="stats-opponent-mark" data-upcoming={Boolean(next)}>{next ? <CalendarClock aria-hidden="true" /> : <Swords aria-hidden="true" />}</span>
              <span className="stats-opponent-copy">
                <strong>{matchup.name}</strong>
                <small>{matchup.summary.gamesPlayed
                  ? `${recordLabel(matchup.summary)} · ${matchup.summary.gamesPlayed} meeting${matchup.summary.gamesPlayed === 1 ? '' : 's'}${matchup.awaitingResults.length ? ` · ${matchup.awaitingResults.length} pending` : ''}`
                  : awaiting
                    ? `${matchup.awaitingResults.length} result${matchup.awaitingResults.length === 1 ? '' : 's'} pending`
                    : 'First meeting scheduled'}</small>
              </span>
              <span className="stats-opponent-status">
                <strong>{next ? formatGameDate(next.scheduledAt) : awaiting ? formatGameDate(awaiting.scheduledAt) : last ? `${outcome === 'win' ? 'W' : outcome === 'loss' ? 'L' : 'T'} ${last.goalsFor}–${last.goalsAgainst}` : 'Archive'}</strong>
                <small>{next ? 'Next game' : awaiting ? 'Results pending' : 'Latest result'}</small>
              </span>
              <ChevronRight aria-hidden="true" />
            </button>
          );
        })}
      </div>
      {!filtered.length && <p className="stats-opponent-no-results">No opponent matches “{query}”.</p>}
      {!query && filtered.length > 8 && <footer className="stats-opponent-directory-footer">
        <button type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded}>
          {expanded ? 'Show current matchups' : `Browse all ${filtered.length} opponents`}
          <ChevronDown aria-hidden="true" data-expanded={expanded} />
        </button>
      </footer>}
    </section>
  );
}

export function OpponentHeadToHead({
  matchup,
  fixture,
  dataset,
  currentSeasonId,
  onBack,
  onCopyLink,
  copied,
  onOpenGame,
}) {
  const teamById = useMemo(() => new Map(dataset.teams.map((team) => [team.id, team])), [dataset.teams]);
  const insights = comparisonInsights(matchup, currentSeasonId, fixture);
  const totalGoals = matchup.summary.goalsFor + matchup.summary.goalsAgainst;
  const goalShare = totalGoals ? matchup.summary.goalsFor / totalGoals : 0;
  const recentMeetings = matchup.recentMeetings.slice(0, 8);
  const currentSeason = matchup.seasons.find((season) => season.seasonId === currentSeasonId);
  const fixtureAwaitingResult = isAwaitingResult(fixture);
  const historySummary = matchup.summary.gamesPlayed
    ? `${matchup.summary.gamesPlayed} completed meeting${matchup.summary.gamesPlayed === 1 ? '' : 's'}${matchup.awaitingResults.length ? ` · ${matchup.awaitingResults.length} awaiting result${matchup.awaitingResults.length === 1 ? '' : 's'}` : ''} across ${matchup.seasons.length} season${matchup.seasons.length === 1 ? '' : 's'}`
    : matchup.awaitingResults.length
      ? `${matchup.awaitingResults.length} meeting${matchup.awaitingResults.length === 1 ? '' : 's'} played · results pending`
      : 'The first verified meeting is on the schedule.';

  return (
    <section className="stats-game-page stats-matchup-page" aria-label={`Head-to-head comparison against ${matchup.name}`}>
      <div className="stats-game-page-toolbar">
        <button type="button" onClick={onBack}><ArrowLeft aria-hidden="true" /> All games</button>
        <div>
          <button type="button" onClick={onCopyLink}><Copy aria-hidden="true" /> {copied ? 'Link copied' : 'Copy matchup'}</button>
          {fixture?.sourceUrl && <a href={fixture.sourceUrl} target="_blank" rel="noreferrer">Official fixture <ExternalLink aria-hidden="true" /></a>}
        </div>
      </div>

      <article className="stats-game-detail stats-matchup-shell">
        <header className="stats-game-hero stats-matchup-hero">
          <div>
            <span>HEAD TO HEAD · {matchup.scopeLabel.toUpperCase()}</span>
            <h2>Goon Squad <b>vs</b> {matchup.name}</h2>
            <p>{historySummary}</p>
          </div>
          <div className="stats-matchup-record">
            <span>GOON SQUAD RECORD</span>
            <strong>{matchup.summary.gamesPlayed ? recordLabel(matchup.summary) : 'FIRST'}</strong>
            <small>{matchup.summary.gamesPlayed ? formatPercentage(matchup.summary.winPercentage) : 'meeting'}</small>
          </div>
        </header>

        {fixture && <section className="stats-next-meeting" aria-label={fixtureAwaitingResult ? 'Played fixture awaiting results' : 'Next meeting'}>
          <div className="stats-next-meeting-date">
            <CalendarClock aria-hidden="true" />
            <span><small>{fixtureAwaitingResult ? 'PLAYED · RESULTS PENDING' : 'NEXT MEETING'}</small><strong>{formatGameDate(fixture.scheduledAt)}</strong></span>
          </div>
          <div><small>Start</small><strong>{gameTimeLabel(fixture.scheduledAt)}</strong></div>
          <div><small>League</small><strong>{formatScheduleName(teamById.get(fixture.seasonTeamId))}</strong></div>
          <div><small>Site</small><strong>{siteLabel(fixture)}</strong></div>
          {fixture.location && <div className="stats-next-meeting-location"><MapPin aria-hidden="true" /><span>{fixture.location}</span></div>}
        </section>}

        <section className="stats-matchup-metrics" aria-label="Head-to-head summary">
          <div><span>Meetings</span><strong>{matchup.summary.gamesPlayed || '—'}</strong><small>completed games</small></div>
          <div><span>Record</span><strong>{matchup.summary.gamesPlayed ? recordLabel(matchup.summary) : '—'}</strong><small>wins · losses · ties</small></div>
          <div><span>Goals</span><strong>{matchup.summary.gamesPlayed ? `${matchup.summary.goalsFor}–${matchup.summary.goalsAgainst}` : '—'}</strong><small>for · against</small></div>
          <div><span>This season</span><strong>{currentSeason?.summary.gamesPlayed ? recordLabel(currentSeason.summary) : '—'}</strong><small>{currentSeason?.summary.gamesPlayed ? `${currentSeason.summary.gamesPlayed} final` : 'no final yet'}</small></div>
        </section>

        <div className="stats-matchup-layout">
          <section className="stats-matchup-meetings">
            <header><Swords aria-hidden="true" /><div><span>MEETING HISTORY</span><strong>Recent results</strong></div></header>
            {recentMeetings.length ? <div className="stats-table-scroll"><table className="stats-table stats-matchup-table">
              <thead><tr><th>Date</th><th>League</th><th>Site</th><th>Result</th><th>Score</th><th>View</th></tr></thead>
              <tbody>{recentMeetings.map((game) => {
                const schedule = teamById.get(game.seasonTeamId);
                const final = game.status === 'final';
                const result = final ? gameResultLabel(game) : 'Played';
                return <tr key={game.id}>
                  <td>{formatGameDate(game.scheduledAt)}</td>
                  <td>
                    <span className="stats-stage-label">{formatScheduleName(schedule)}</span>
                    {game.opponent !== matchup.name && <small className="stats-opponent-official-name">Official: {game.opponent}</small>}
                  </td>
                  <td>{siteLabel(game)}</td>
                  <td><span className={`stats-result is-${final ? result.toLowerCase() : 'pending'}`}>{result}</span></td>
                  <td>{final ? <strong>{game.goalsFor}–{game.goalsAgainst}</strong> : <strong className="stats-pending-result">Results pending</strong>}</td>
                  <td><button type="button" className="stats-game-detail-button" onClick={() => onOpenGame(game.id)}>{final ? 'Results' : 'Status'}</button></td>
                </tr>;
              })}</tbody>
            </table></div> : <p className="stats-matchup-empty">No played meeting has been published yet. The scheduled fixture above is the verified starting point.</p>}
          </section>

          <aside className="stats-matchup-read">
            <header><TrendingUp aria-hidden="true" /><div><span>QUICK READ</span><strong>Verified matchup context</strong></div></header>
            <div className="stats-matchup-goal-share">
              <div><span>Goon Squad goals</span><strong>{matchup.summary.goalsFor}</strong></div>
              <div><span>Opponent goals</span><strong>{matchup.summary.goalsAgainst}</strong></div>
              <div className="stats-matchup-goal-bar" aria-label={`Goon Squad has ${formatPercentage(goalShare)} of goals in completed meetings`}>
                <span style={{ width: `${goalShare * 100}%` }} />
              </div>
            </div>
            <dl className="stats-matchup-read-list">
              {insights.map((insight) => <div key={insight.label}><dt>{insight.label}</dt><dd>{insight.value}</dd></div>)}
            </dl>
            {matchup.recentForm.length > 0 && <div className="stats-matchup-form">
              <span>RECENT FORM</span>
              <div>{matchup.recentForm.map(({ game, outcome }) => <b key={game.id} data-outcome={outcome} title={`${formatGameDate(game.scheduledAt)} · ${game.goalsFor}–${game.goalsAgainst}`}>{outcome === 'win' ? 'W' : outcome === 'loss' ? 'L' : 'T'}</b>)}</div>
            </div>}
          </aside>
        </div>

        <section className="stats-matchup-seasons">
          <header><Target aria-hidden="true" /><div><span>SEASON BY SEASON</span><strong>How the matchup has changed</strong></div></header>
          <div className="stats-table-scroll"><table className="stats-table">
            <thead><tr><th>Season</th><th>League</th><th>GP</th><th>Record</th><th>Goals</th><th>Difference</th></tr></thead>
            <tbody>{matchup.seasons.map((season) => <tr key={season.seasonId}>
              <td><strong>{season.seasonName}</strong></td>
              <td><span className="stats-stage-label">{season.scheduleNames.join(' · ') || 'League schedule'}</span></td>
              <td>{season.summary.gamesPlayed}</td>
              <td>{season.summary.gamesPlayed ? recordLabel(season.summary) : '—'}</td>
              <td>{season.summary.gamesPlayed ? `${season.summary.goalsFor}–${season.summary.goalsAgainst}` : '—'}</td>
              <td>{season.summary.gamesPlayed ? `${season.summary.goalDifference > 0 ? '+' : ''}${season.summary.goalDifference}` : '—'}</td>
            </tr>)}</tbody>
          </table></div>
        </section>
      </article>
    </section>
  );
}
