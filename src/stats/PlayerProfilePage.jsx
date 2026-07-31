import { lazy, Suspense } from 'react';
import {
  ArrowLeft,
  CalendarClock,
  ChevronRight,
  Copy,
  ExternalLink,
  History,
  Medal,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UserRound,
} from 'lucide-react';
import {
  formatGameDate,
  formatLeagueName,
  formatLeagueScheduleName,
  formatPercentage,
} from './statsModel';
import PlayerSpotlightErrorBoundary from './PlayerSpotlightErrorBoundary';
import OfficialSocialLinks from '../brand/OfficialSocialLinks';
import './playerProfilePage.css';

const PlayerSpotlight3D = lazy(() => import('./PlayerSpotlight3D'));

function positionLabel(position) {
  if (position === 'G') return 'Goaltender';
  if (position === 'D' || position === 'LD' || position === 'RD') return 'Defence';
  if (position === 'C') return 'Center';
  if (position === 'W' || position === 'LW' || position === 'RW') return 'Winger';
  return 'Position not published';
}

function PlayerMetric({ label, value, detail }) {
  return (
    <div className="public-player-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function fieldSeasonLine(row) {
  return [
    { label: 'GP', value: row.field.gamesPlayed },
    { label: 'G', value: row.field.goals },
    { label: 'A', value: row.field.assists },
    { label: 'PTS', value: row.field.points },
  ];
}

function goalieSeasonLine(row) {
  return [
    { label: 'GP', value: row.goalie.gamesPlayed },
    { label: 'W', value: row.goalie.wins },
    { label: 'SV%', value: formatPercentage(row.goalie.savePercentage) },
    { label: 'SO', value: row.goalie.shutouts },
  ];
}

function gameValue(row) {
  if (row.goalie) {
    return {
      primary: formatPercentage(row.goalie.savePercentage),
      secondary: 'SV%',
    };
  }
  return {
    primary: row.points,
    secondary: 'PTS',
  };
}

function PlayerSpotlightLoading({ displayName }) {
  return (
    <div className="player-profile-3d-state" role="status">
      <RefreshCw aria-hidden="true" />
      <strong>Loading {displayName}&apos;s player view</strong>
    </div>
  );
}

function PlayerSpotlightUnavailable({ displayName, onRetry }) {
  return (
    <div className="player-profile-3d-state is-unavailable" role="status">
      <UserRound aria-hidden="true" />
      <strong>3D player view unavailable</strong>
      <span>{displayName}&apos;s profile and verified statistics are still available.</span>
      <button type="button" onClick={onRetry}>
        <RefreshCw aria-hidden="true" />
        Try 3D again
      </button>
    </div>
  );
}

export default function PlayerProfilePage({
  profile,
  dark,
  copied,
  onBack,
  onCopyLink,
  onOpenGame,
}) {
  if (!profile) return null;
  const goalie = profile.position === 'G'
    || profile.careerGoalie.gamesPlayed > profile.careerField.gamesPlayed;
  const player = profile.primaryPlayer;
  const currentSchedule = profile.currentTeams.map(formatLeagueScheduleName).join(' / ');
  const leagueLabel = profile.leagueNames?.join(' + ') || 'Goonsquad league archive';
  const bestSeason = profile.bestFieldSeason;
  const latestGames = profile.recentGames.slice(0, 10);
  const recentField = latestGames.filter((row) => row.field).slice(0, 5);
  const recentPoints = recentField.reduce((total, row) => total + row.points, 0);
  const recentGoals = recentField.reduce(
    (total, row) => total + Number(row.field?.goals || 0),
    0,
  );

  return (
    <section
      className="public-player-page"
      aria-label={`Player profile for ${player.displayName}`}
      data-goalie={goalie}
    >
      <div className="stats-game-page-toolbar public-player-toolbar">
        <button type="button" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          All players
        </button>
        <div>
          <button type="button" onClick={onCopyLink}>
            <Copy aria-hidden="true" />
            {copied ? 'Link copied' : 'Copy profile link'}
          </button>
          {player.sourceUrl && (
            <a href={player.sourceUrl} target="_blank" rel="noreferrer">
              Official profile
              <ExternalLink aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      <header className="public-player-hero">
        <div className="public-player-render">
          <PlayerSpotlightErrorBoundary
            resetKey={player.id}
            fallback={({ retry }) => (
              <PlayerSpotlightUnavailable
                displayName={player.displayName}
                onRetry={retry}
              />
            )}
          >
            <Suspense fallback={<PlayerSpotlightLoading displayName={player.displayName} />}>
              <PlayerSpotlight3D
                displayName={player.displayName}
                jerseyNumber={profile.jerseyNumber}
                goalie={goalie}
                dark={dark}
              />
            </Suspense>
          </PlayerSpotlightErrorBoundary>
        </div>
        <div className="public-player-identity">
          {player.avatarUrl && (
            <div className="public-player-photo">
              <img src={player.avatarUrl} alt={`${player.displayName} player profile`} />
              <span>PLAYER PHOTO</span>
            </div>
          )}
          <span className="public-player-kicker">
            <Sparkles aria-hidden="true" />
            GOONSQUAD PLAYER
          </span>
          <h1>{player.displayName}</h1>
          <p>
            {[
              profile.jerseyNumber ? `#${profile.jerseyNumber}` : null,
              positionLabel(profile.position),
              currentSchedule || null,
            ].filter(Boolean).join(' · ')}
          </p>
          <div className="public-player-badges">
            <span><ShieldCheck aria-hidden="true" /> Official team archive</span>
            <span><Trophy aria-hidden="true" /> {leagueLabel}</span>
            <span><History aria-hidden="true" /> {profile.seasonsPlayed} season{profile.seasonsPlayed === 1 ? '' : 's'}</span>
          </div>
          <OfficialSocialLinks compact className="public-player-social-links" />
          {profile.nextGame && (
            <button
              type="button"
              className="public-player-next-game"
              onClick={() => onOpenGame(profile.nextGame.id)}
            >
              <CalendarClock aria-hidden="true" />
              <span>
                <small>NEXT GAME</small>
                <strong>vs {profile.nextGame.opponent}</strong>
                <b>{formatGameDate(profile.nextGame.scheduledAt)}</b>
              </span>
              <ChevronRight aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <section className="public-player-metrics" aria-label="Career statistics">
        {goalie ? (
          <>
            <PlayerMetric label="Games" value={profile.careerGoalie.gamesPlayed || '—'} detail={`${profile.seasonsPlayed} seasons`} />
            <PlayerMetric label="Record" value={profile.careerGoalie.gamesPlayed ? `${profile.careerGoalie.wins}–${profile.careerGoalie.losses}–${profile.careerGoalie.ties}` : '—'} detail="wins · losses · ties" />
            <PlayerMetric label="Save rate" value={profile.careerGoalie.gamesPlayed ? formatPercentage(profile.careerGoalie.savePercentage) : '—'} detail={`${profile.careerGoalie.saves} saves`} />
            <PlayerMetric label="Shutouts" value={profile.careerGoalie.gamesPlayed ? profile.careerGoalie.shutouts : '—'} detail={profile.careerGoalie.gamesPlayed ? `${profile.careerGoalie.goalsAgainstAverage.toFixed(2)} GAA` : 'No goalie line published'} />
          </>
        ) : (
          <>
            <PlayerMetric label="Games" value={profile.careerField.gamesPlayed || '—'} detail={`${profile.seasonsPlayed} seasons`} />
            <PlayerMetric label="Goals" value={profile.careerField.gamesPlayed ? profile.careerField.goals : '—'} detail={`${profile.careerField.powerPlayGoals} power play`} />
            <PlayerMetric label="Assists" value={profile.careerField.gamesPlayed ? profile.careerField.assists : '—'} detail="career total" />
            <PlayerMetric label="Points" value={profile.careerField.gamesPlayed ? profile.careerField.points : '—'} detail={profile.careerField.gamesPlayed ? `${profile.careerField.pointsPerGame.toFixed(2)} per game` : 'No player line published'} />
          </>
        )}
      </section>

      <div className="public-player-dashboard">
        <section className="public-player-band public-player-history">
          <header>
            <Trophy aria-hidden="true" />
            <div>
              <span>SEASON HISTORY</span>
              <h2>Every Goonsquad season</h2>
            </div>
          </header>
          <div className="public-player-season-list">
            {profile.seasonHistory.map((row) => {
              const rowGoalie = row.goalie.gamesPlayed > row.field.gamesPlayed;
              const metrics = rowGoalie ? goalieSeasonLine(row) : fieldSeasonLine(row);
              return (
                <article key={row.season.id} data-current={row.season.current}>
                  <div>
                    <strong>{row.season.name}</strong>
                    <small>{row.schedules.join(' / ') || 'Goonsquad'}</small>
                  </div>
                  <div className="public-player-season-metrics">
                    {metrics.map((metric) => (
                      <span key={metric.label}>
                        <b>{metric.value}</b>
                        <small>{metric.label}</small>
                      </span>
                    ))}
                  </div>
                  {row.season.current && <em>CURRENT</em>}
                </article>
              );
            })}
            {!profile.seasonHistory.length && (
              <div className="public-player-empty">
                No season totals were published for this roster record.
              </div>
            )}
          </div>
        </section>

        <section className="public-player-band public-player-pulse">
          <header>
            <Target aria-hidden="true" />
            <div>
              <span>PLAYER PULSE</span>
              <h2>{goalie ? 'Career snapshot' : 'Recent production'}</h2>
            </div>
          </header>
          {goalie ? (
            <div className="public-player-highlight">
              <strong>{profile.careerGoalie.saves}</strong>
              <span>career saves</span>
              <p>{profile.careerGoalie.gamesPlayed ? `${profile.careerGoalie.minutesPlayed} verified minutes across ${profile.careerGoalie.gamesPlayed} games.` : 'Detailed goaltending lines will appear when the league publishes them.'}</p>
            </div>
          ) : (
            <div className="public-player-highlight">
              <strong>{recentField.length ? recentPoints : '—'}</strong>
              <span>points in last {recentField.length || 0}</span>
              <p>{recentField.length ? `${recentGoals} goals in the most recent detailed appearances.` : 'Detailed game appearances will appear when the league publishes them.'}</p>
            </div>
          )}
          {bestSeason && !goalie && (
            <div className="public-player-best">
              <Medal aria-hidden="true" />
              <span>
                <small>BEST SCORING SEASON</small>
                <strong>{bestSeason.season.name}</strong>
                <small>{formatLeagueName(bestSeason.season)}</small>
                <b>{bestSeason.field.points} PTS · {bestSeason.field.goals} G</b>
              </span>
            </div>
          )}
        </section>

        <section className="public-player-band public-player-games">
          <header>
            <History aria-hidden="true" />
            <div>
              <span>GAME LOG</span>
              <h2>Recent appearances</h2>
            </div>
          </header>
          <div className="public-player-game-list">
            {latestGames.map((row) => {
              const value = gameValue(row);
              return (
                <button type="button" key={row.game.id} onClick={() => onOpenGame(row.game.id)}>
                  <span className={`profile-game-result is-${row.result.toLowerCase()}`}>{row.result}</span>
                  <span>
                    <strong>{row.game.opponent}</strong>
                    <small>{formatGameDate(row.game.scheduledAt)} · {row.team ? formatLeagueScheduleName(row.team) : 'League game'}</small>
                  </span>
                  <span>
                    <b>{value.primary}</b>
                    <small>{value.secondary}</small>
                  </span>
                  <ChevronRight aria-hidden="true" />
                </button>
              );
            })}
            {!latestGames.length && (
              <div className="public-player-empty">
                No detailed game appearances were published for this player.
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
