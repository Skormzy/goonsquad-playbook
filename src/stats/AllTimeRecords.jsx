import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronRight,
  Layers3,
  Medal,
  Shield,
  ShieldCheck,
  Trophy,
} from 'lucide-react';
import {
  ALL_TIME_GOALIE_COLUMNS,
  ALL_TIME_SKATER_COLUMNS,
  sortAllTimeRecords,
} from './allTimeRecordsModel';
import {
  COMPETITION_SCOPE_META,
  COMPETITION_SCOPE_ORDER,
} from './competitionScopeModel';
import { formatPercentage } from './statsModel';
import './allTimeRecords.css';

function positionLabel(position) {
  if (position === 'G') return 'Goalie';
  if (['D', 'LD', 'RD'].includes(position)) return 'Defence';
  if (position === 'C') return 'Center';
  if (['W', 'LW', 'RW'].includes(position)) return 'Winger';
  return 'Goonsquad';
}

function displayValue(line, key) {
  if (key === 'savePercentage') return formatPercentage(line[key]);
  if (key === 'goalsAgainstAverage') {
    return Number.isFinite(line[key]) ? line[key].toFixed(2) : '—';
  }
  return Number.isFinite(line[key]) ? line[key] : '—';
}

function ScopeIcon({ scopeId }) {
  if (scopeId === 'regular') return <CalendarDays aria-hidden="true" />;
  if (scopeId === 'playoffs') return <ShieldCheck aria-hidden="true" />;
  if (scopeId === 'tournaments') return <Trophy aria-hidden="true" />;
  return <Layers3 aria-hidden="true" />;
}

function eventLabel(line, scopeId) {
  const count = line.seasonsPlayed || 0;
  const singular = scopeId === 'tournaments'
    ? 'tournament'
    : scopeId === 'playoffs'
      ? 'postseason'
      : scopeId === 'all'
        ? 'competition'
        : 'season';
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function openPlayer(line, onOpenPlayer) {
  if (line.profilePlayerId) onOpenPlayer(line.profilePlayerId);
}

function Podium({ leaders, metric, goalie, onOpenPlayer, scopeId }) {
  const label = goalie
    ? ALL_TIME_GOALIE_COLUMNS.find((column) => column.key === metric)?.label
    : ALL_TIME_SKATER_COLUMNS.find((column) => column.key === metric)?.label;
  return (
    <div className="all-time-podium" aria-label={`Top three ${COMPETITION_SCOPE_META[scopeId].label.toLowerCase()} leaders by ${label}`}>
      {leaders.slice(0, 3).map((line, index) => (
        <button
          type="button"
          key={line.playerId}
          data-place={index + 1}
          data-linked={Boolean(line.profilePlayerId)}
          disabled={!line.profilePlayerId}
          onClick={() => openPlayer(line, onOpenPlayer)}
        >
          <span className="all-time-podium-place">
            {index === 0 ? <Trophy aria-hidden="true" /> : <Medal aria-hidden="true" />}
            {index + 1}
          </span>
          <strong>{line.displayName}</strong>
          <small>
            {line.jerseyNumber ? `#${line.jerseyNumber} · ` : ''}
            {positionLabel(line.position)}
          </small>
          <b>{displayValue(line, metric)} <em>{label}</em></b>
        </button>
      ))}
    </div>
  );
}

export default function AllTimeRecords({ leagueLabel, records, onOpenPlayer }) {
  const [mode, setMode] = useState('skaters');
  const [requestedScopeId, setRequestedScopeId] = useState('regular');
  const [sort, setSort] = useState({ key: 'points', direction: 'desc' });
  const availableScopes = records.availableScopes || [];
  const scopeId = availableScopes.includes(requestedScopeId)
    ? requestedScopeId
    : availableScopes[0] || 'regular';

  const scope = records.scopes?.[scopeId] || {
    id: scopeId,
    ...COMPETITION_SCOPE_META[scopeId],
    skaters: records.skaters || [],
    goalies: records.goalies || [],
  };
  const goalie = mode === 'goalies';
  const columns = goalie ? ALL_TIME_GOALIE_COLUMNS : ALL_TIME_SKATER_COLUMNS;
  const lines = goalie ? scope.goalies : scope.skaters;
  const sorted = useMemo(
    () => sortAllTimeRecords(lines, sort),
    [lines, sort],
  );

  const chooseMode = (nextMode) => {
    setMode(nextMode);
    setSort(nextMode === 'goalies'
      ? { key: 'wins', direction: 'desc' }
      : { key: 'points', direction: 'desc' });
  };

  return (
    <section className="all-time-records" aria-labelledby="all-time-records-title">
      <header className="all-time-records-hero">
        <div>
          <span><Trophy aria-hidden="true" /> GOONSQUAD RECORD BOOK</span>
          <h2 id="all-time-records-title">All-time leaders</h2>
          <p>{leagueLabel}</p>
        </div>
        <div className="all-time-mode" role="tablist" aria-label="Player group">
          <button
            type="button"
            role="tab"
            aria-selected={!goalie}
            onClick={() => chooseMode('skaters')}
          >
            <Medal aria-hidden="true" /> Skaters
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={goalie}
            onClick={() => chooseMode('goalies')}
          >
            <Shield aria-hidden="true" /> Goalies
          </button>
        </div>
      </header>

      <div className="all-time-scope-switcher" role="tablist" aria-label="Competition type">
        {COMPETITION_SCOPE_ORDER.map((id) => {
          const item = records.scopes?.[id];
          const available = Boolean(item?.available);
          const playerCount = new Set([
            ...(item?.skaters || []),
            ...(item?.goalies || []),
          ].map((line) => line.playerId)).size;
          return (
            <button
              type="button"
              role="tab"
              key={id}
              aria-selected={scopeId === id}
              disabled={!available}
              onClick={() => setRequestedScopeId(id)}
            >
              <ScopeIcon scopeId={id} />
              <span>
                <strong>{COMPETITION_SCOPE_META[id].label}</strong>
                <small>{available ? `${playerCount} player record${playerCount === 1 ? '' : 's'}` : 'No stats yet'}</small>
              </span>
            </button>
          );
        })}
      </div>

      <div className="all-time-scope-summary">
        <span>{scope.eyebrow}</span>
        <strong>{scope.label}</strong>
        <p>{scope.description}</p>
      </div>

      {sorted.length ? (
        <>
          <Podium
            leaders={sorted}
            metric={sort.key}
            goalie={goalie}
            onOpenPlayer={onOpenPlayer}
            scopeId={scopeId}
          />

          <div className="all-time-table-scroll">
            <table className="all-time-table">
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Player</th>
                  {columns.map((column) => {
                    const active = sort.key === column.key;
                    return (
                      <th
                        key={column.key}
                        scope="col"
                        aria-sort={active
                          ? sort.direction === 'desc' ? 'descending' : 'ascending'
                          : 'none'}
                        data-active={active}
                      >
                        <button
                          type="button"
                          onClick={() => setSort((current) => {
                            if (current.key === column.key) {
                              return {
                                key: column.key,
                                direction: current.direction === 'desc' ? 'asc' : 'desc',
                              };
                            }
                            return {
                              key: column.key,
                              direction: column.lowerIsBetter ? 'asc' : 'desc',
                            };
                          })}
                        >
                          {column.label}
                          {active && (sort.direction === 'desc'
                            ? <ArrowDown aria-hidden="true" />
                            : <ArrowUp aria-hidden="true" />)}
                        </button>
                      </th>
                    );
                  })}
                  <th scope="col"><span className="sr-only">Open profile</span></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((line, index) => (
                  <tr key={line.playerId}>
                    <td><b>{index + 1}</b></td>
                    <td>
                      <button
                        type="button"
                        className="all-time-player"
                        disabled={!line.profilePlayerId}
                        onClick={() => openPlayer(line, onOpenPlayer)}
                      >
                        <span className={line.avatarUrl ? 'has-photo' : ''}>
                          {line.avatarUrl
                            ? <img src={line.avatarUrl} alt="" />
                            : line.jerseyNumber ? `#${line.jerseyNumber}` : line.displayName.slice(0, 1)}
                        </span>
                        <span>
                          <strong>{line.displayName}</strong>
                          <small>{positionLabel(line.position)} · {eventLabel(line, scopeId)}</small>
                        </span>
                      </button>
                    </td>
                    {columns.map((column) => (
                      <td key={column.key} data-active={sort.key === column.key}>
                        {displayValue(line, column.key)}
                      </td>
                    ))}
                    <td>
                      {line.profilePlayerId ? (
                        <button
                          type="button"
                          className="all-time-open"
                          onClick={() => openPlayer(line, onOpenPlayer)}
                          aria-label={`Open ${line.displayName} profile`}
                        >
                          <ChevronRight aria-hidden="true" />
                        </button>
                      ) : <span className="all-time-unlinked" aria-label="Tournament record only">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="all-time-empty">
          <ScopeIcon scopeId={scopeId} />
          <strong>No {scope.label.toLowerCase()} {goalie ? 'goalie' : 'field player'} statistics yet</strong>
          <span>This view will fill automatically when that competition publishes player totals.</span>
        </div>
      )}
    </section>
  );
}
