import {
  lazy,
  Suspense,
  useState,
} from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CalendarClock,
  ChevronRight,
  Copy,
  ExternalLink,
  History,
  Layers3,
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
import {
  COMPETITION_SCOPE_META,
  COMPETITION_SCOPE_ORDER,
} from './competitionScopeModel';
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

function CompetitionIcon({ scopeId }) {
  if (scopeId === 'regular') return <CalendarDays aria-hidden="true" />;
  if (scopeId === 'playoffs') return <ShieldCheck aria-hidden="true" />;
  if (scopeId === 'tournaments') return <Trophy aria-hidden="true" />;
  return <Layers3 aria-hidden="true" />;
}

function historyContext(row) {
  const parts = [];
  if (row.competition === 'tournaments') {
    parts.push('Tournament');
  } else {
    const league = formatLeagueName(row.season);
    if (league && league !== 'League archive') parts.push(league);
  }
  if (row.schedules?.length) parts.push(row.schedules.join(' / '));
  if (row.competition === 'playoffs') parts.push('Playoffs');
  if (row.competition === 'regular') parts.push('Regular season');
  return parts.join(' · ') || 'Goonsquad';
}

function eventCountLabel(scopeId, count) {
  const singular = scopeId === 'tournaments'
    ? 'tournament'
    : scopeId === 'playoffs'
      ? 'postseason'
      : scopeId === 'all'
        ? 'entry'
        : 'season';
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
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
      <span>{displayName}&apos;s profile and statistics are still available.</span>
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
  const [requestedScopeId, setRequestedScopeId] = useState('regular');
  const availableScopes = profile?.availableCompetitionScopes || [];
  const scopeId = availableScopes.includes(requestedScopeId)
    ? requestedScopeId
    : availableScopes[0] || 'regular';

  if (!profile) return null;
  const activeScope = profile.competitionStats?.[scopeId] || {
    id: scopeId,
    ...COMPETITION_SCOPE_META[scopeId],
    eventCount: profile.seasonsPlayed,
    careerField: profile.careerField,
    careerGoalie: profile.careerGoalie,
    seasonHistory: profile.seasonHistory,
    recentGames: profile.recentGames,
    bestFieldSeason: profile.bestFieldSeason,
  };
  const careerField = activeScope.careerField;
  const careerGoalie = activeScope.careerGoalie;
  const seasonHistory = activeScope.seasonHistory || [];
  const eventCount = activeScope.eventCount || seasonHistory.length;
  const goalie = profile.position === 'G'
    || careerGoalie.gamesPlayed > careerField.gamesPlayed;
  const player = profile.primaryPlayer;
  const officialProfiles = profile.officialProfiles?.length
    ? profile.officialProfiles
    : player.sourceUrl
      ? [{ playerId: player.id, label: 'League', url: player.sourceUrl }]
      : [];
  const currentSchedule = profile.currentTeams.map(formatLeagueScheduleName).join(' / ');
  const leagueNames = profile.leagueNames?.length
    ? profile.leagueNames
    : [];
  const bestSeason = activeScope.bestFieldSeason;
  const latestGames = (activeScope.recentGames || []).slice(0, 10);
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
          {officialProfiles.map((officialProfile) => (
            <a
              key={officialProfile.playerId}
              href={officialProfile.url}
              target="_blank"
              rel="noreferrer"
            >
              {officialProfile.label} profile
              <ExternalLink aria-hidden="true" />
            </a>
          ))}
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
            {leagueNames.map((leagueName) => (
              <span key={leagueName}><Trophy aria-hidden="true" /> {leagueName}</span>
            ))}
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

      <section className="public-player-competition" aria-label="Choose competition statistics">
        <div className="public-player-competition-tabs" role="tablist" aria-label="Competition type">
          {COMPETITION_SCOPE_ORDER.map((id) => {
            const item = profile.competitionStats?.[id];
            const available = Boolean(item?.available);
            return (
              <button
                type="button"
                role="tab"
                key={id}
                aria-selected={scopeId === id}
                disabled={!available}
                onClick={() => setRequestedScopeId(id)}
              >
                <CompetitionIcon scopeId={id} />
                <span>
                  <strong>{COMPETITION_SCOPE_META[id].label}</strong>
                  <small>{available ? eventCountLabel(id, item.eventCount) : 'No stats yet'}</small>
                </span>
              </button>
            );
          })}
        </div>
        <div className="public-player-competition-readout">
          <span>{activeScope.eyebrow}</span>
          <strong>{activeScope.label}</strong>
          <p>{activeScope.description}</p>
        </div>
      </section>

      <section className="public-player-metrics" aria-label="Career statistics">
        {goalie ? (
          <>
            <PlayerMetric label="Games" value={careerGoalie.gamesPlayed || '—'} detail={eventCountLabel(scopeId, eventCount)} />
            <PlayerMetric label="Record" value={careerGoalie.gamesPlayed ? `${careerGoalie.wins}–${careerGoalie.losses}–${careerGoalie.ties}` : '—'} detail="wins · losses · ties" />
            <PlayerMetric label="Save rate" value={careerGoalie.gamesPlayed ? formatPercentage(careerGoalie.savePercentage) : '—'} detail={Number.isFinite(careerGoalie.saves) ? `${careerGoalie.saves} saves` : 'Published rate'} />
            <PlayerMetric label="Shutouts" value={careerGoalie.gamesPlayed ? careerGoalie.shutouts : '—'} detail={careerGoalie.gamesPlayed && Number.isFinite(careerGoalie.goalsAgainstAverage) ? `${careerGoalie.goalsAgainstAverage.toFixed(2)} GAA` : 'No goalie line published'} />
          </>
        ) : (
          <>
            <PlayerMetric label="Games" value={careerField.gamesPlayed || '—'} detail={eventCountLabel(scopeId, eventCount)} />
            <PlayerMetric label="Goals" value={careerField.gamesPlayed ? careerField.goals : '—'} detail={`${careerField.powerPlayGoals} power play`} />
            <PlayerMetric label="Assists" value={careerField.gamesPlayed ? careerField.assists : '—'} detail="career total" />
            <PlayerMetric label="Points" value={careerField.gamesPlayed ? careerField.points : '—'} detail={careerField.gamesPlayed ? `${careerField.pointsPerGame.toFixed(2)} per game` : 'No player line published'} />
          </>
        )}
      </section>

      <div className="public-player-dashboard">
        <section className="public-player-band public-player-history">
          <header>
            <Trophy aria-hidden="true" />
            <div>
              <span>SEASON HISTORY</span>
              <h2>{activeScope.label} history</h2>
            </div>
          </header>
          <div className="public-player-season-list">
            {seasonHistory.map((row) => {
              const rowGoalie = row.goalie.gamesPlayed > row.field.gamesPlayed;
              const metrics = rowGoalie ? goalieSeasonLine(row) : fieldSeasonLine(row);
              return (
                <article key={row.id || row.season.id} data-current={row.season.current}>
                  <div>
                    <strong>{row.season.name}</strong>
                    <small>{historyContext(row)}</small>
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
            {!seasonHistory.length && (
              <div className="public-player-empty">
                No {activeScope.label.toLowerCase()} totals were published for this player.
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
              <strong>{Number.isFinite(careerGoalie.saves) ? careerGoalie.saves : '—'}</strong>
              <span>{activeScope.label.toLowerCase()} saves</span>
              <p>{careerGoalie.gamesPlayed ? `${careerGoalie.minutesPlayed} minutes across ${careerGoalie.gamesPlayed} games.` : 'Detailed goaltending lines will appear when the competition publishes them.'}</p>
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
                <small>{historyContext(bestSeason)}</small>
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
              <h2>{scopeId === 'tournaments' ? 'Tournament appearances' : 'Recent appearances'}</h2>
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
                    <small>{formatGameDate(row.game.scheduledAt)} · {[row.season ? formatLeagueName(row.season) : null, row.team ? formatLeagueScheduleName(row.team) : null, row.game.stage === 'playoffs' ? 'Playoffs' : 'Regular season'].filter(Boolean).join(' · ')}</small>
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
                {scopeId === 'tournaments'
                  ? 'Tournament totals are available above. Game-level player lines were not published for this event.'
                  : `No detailed ${activeScope.label.toLowerCase()} appearances were published for this player.`}
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
