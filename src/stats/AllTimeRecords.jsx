import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Medal,
  Shield,
  Trophy,
} from 'lucide-react';
import {
  ALL_TIME_GOALIE_COLUMNS,
  ALL_TIME_SKATER_COLUMNS,
  sortAllTimeRecords,
} from './allTimeRecordsModel';
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

function Podium({ leaders, metric, goalie, onOpenPlayer }) {
  const label = goalie
    ? ALL_TIME_GOALIE_COLUMNS.find((column) => column.key === metric)?.label
    : ALL_TIME_SKATER_COLUMNS.find((column) => column.key === metric)?.label;
  return (
    <div className="all-time-podium" aria-label={`Top three all-time by ${label}`}>
      {leaders.slice(0, 3).map((line, index) => (
        <button
          type="button"
          key={line.playerId}
          data-place={index + 1}
          onClick={() => onOpenPlayer(line.playerId)}
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

export default function AllTimeRecords({ records, onOpenPlayer }) {
  const [mode, setMode] = useState('skaters');
  const [sort, setSort] = useState({ key: 'points', direction: 'desc' });
  const goalie = mode === 'goalies';
  const columns = goalie ? ALL_TIME_GOALIE_COLUMNS : ALL_TIME_SKATER_COLUMNS;
  const lines = goalie ? records.goalies : records.skaters;
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
          <p>Every verified season in one sortable Goonsquad archive.</p>
        </div>
        <div className="all-time-mode" role="tablist" aria-label="Record book group">
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

      <Podium
        leaders={sorted}
        metric={sort.key}
        goalie={goalie}
        onOpenPlayer={onOpenPlayer}
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
                    onClick={() => onOpenPlayer(line.playerId)}
                  >
                    <span className={line.avatarUrl ? 'has-photo' : ''}>
                      {line.avatarUrl
                        ? <img src={line.avatarUrl} alt="" />
                        : line.jerseyNumber ? `#${line.jerseyNumber}` : line.displayName.slice(0, 1)}
                    </span>
                    <span>
                      <strong>{line.displayName}</strong>
                      <small>{positionLabel(line.position)} · {line.seasonsPlayed} season{line.seasonsPlayed === 1 ? '' : 's'}</small>
                    </span>
                  </button>
                </td>
                {columns.map((column) => (
                  <td key={column.key} data-active={sort.key === column.key}>
                    {displayValue(line, column.key)}
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="all-time-open"
                    onClick={() => onOpenPlayer(line.playerId)}
                    aria-label={`Open ${line.displayName} profile`}
                  >
                    <ChevronRight aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
