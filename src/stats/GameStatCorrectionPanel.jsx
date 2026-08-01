import { useMemo, useState } from 'react';
import {
  Check,
  PencilLine,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  removeTeamGameStatOverride,
  saveTeamGameStatOverride,
} from './statsCloud';
import { effectiveGameKey } from './gameStatOverrides';
import { formatGameDate } from './statsModel';

const PLAYER_STATS = Object.freeze([
  ['goals', 'G'],
  ['assists', 'A'],
  ['penaltyMinutes', 'PIM'],
  ['shots', 'SH'],
  ['powerPlayGoals', 'PPG'],
  ['shortHandedGoals', 'SHG'],
  ['emptyNetGoals', 'ENG'],
  ['plusMinus', '+/-'],
]);

const TEAM_STATS = Object.freeze([
  ['shotsFor', 'Shots for'],
  ['shotsAgainst', 'Shots against'],
  ['powerPlayGoals', 'PP goals'],
  ['powerPlayOpportunities', 'PP chances'],
  ['penaltyKillGoalsAgainst', 'PK goals against'],
  ['timesShorthanded', 'Times short-handed'],
  ['faceoffWins', 'Faceoff wins'],
  ['faceoffAttempts', 'Faceoff attempts'],
  ['blocks', 'Blocks'],
  ['takeaways', 'Takeaways'],
  ['turnovers', 'Turnovers'],
]);

const EMPTY_GOAL = Object.freeze({
  teamSide: 'us',
  scorerId: '',
  opponentScorer: '',
  assistOneId: '',
  assistTwoId: '',
  strength: 'EV',
  period: 1,
  clock: '',
});

const EMPTY_PENALTY = Object.freeze({
  teamSide: 'us',
  playerId: '',
  opponentPlayer: '',
  minutes: 2,
  penalty: '',
  period: 1,
  clock: '',
});

function finite(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function inputValue(value) {
  return Number.isFinite(Number(value)) && value !== null && value !== '' ? value : '';
}

function clockSeconds(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})(?::([0-5]?\d))?$/u);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2] || 0);
}

function clockLabel(value) {
  if (!Number.isFinite(value)) return 'Time not entered';
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

function eventId() {
  if (globalThis.crypto?.randomUUID) return `admin-${globalThis.crypto.randomUUID()}`;
  return `admin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function cleanPlayerLine(line) {
  return {
    id: line.id,
    playerId: String(line.playerId),
    gamesPlayed: finite(line.gamesPlayed, 1),
    goals: finite(line.goals),
    assists: finite(line.assists),
    shots: line.shots === null || line.shots === undefined ? null : finite(line.shots),
    penaltyMinutes: finite(line.penaltyMinutes),
    plusMinus: line.plusMinus === null || line.plusMinus === undefined ? null : finite(line.plusMinus),
    blocks: line.blocks === null || line.blocks === undefined ? null : finite(line.blocks),
    takeaways: line.takeaways === null || line.takeaways === undefined ? null : finite(line.takeaways),
    turnovers: line.turnovers === null || line.turnovers === undefined ? null : finite(line.turnovers),
    powerPlayGoals: finite(line.powerPlayGoals),
    shortHandedGoals: finite(line.shortHandedGoals),
    emptyNetGoals: finite(line.emptyNetGoals),
  };
}

function cleanGoalieLine(line) {
  return {
    id: line.id,
    playerId: String(line.playerId),
    gamesPlayed: finite(line.gamesPlayed, 1),
    wins: finite(line.wins),
    losses: finite(line.losses),
    ties: finite(line.ties),
    goalsAgainst: finite(line.goalsAgainst),
    shotsAgainst: finite(line.shotsAgainst),
    saves: finite(line.saves),
    shutouts: finite(line.shutouts),
    minutesPlayed: finite(line.minutesPlayed),
  };
}

function starterPlayerLine(playerId) {
  return cleanPlayerLine({ playerId, gamesPlayed: 1 });
}

function starterGoalieLine(playerId) {
  return cleanGoalieLine({ playerId, gamesPlayed: 1 });
}

function playerName(playersById, playerId, fallback = 'Unknown player') {
  return playersById.get(String(playerId))?.displayName || fallback;
}

function correctionError(error) {
  const message = String(error?.message || error || 'Game correction failed.');
  if (/function .*team_game_stat_override|schema cache|could not find the function/iu.test(message)) {
    return 'The game-correction database update has not been installed yet.';
  }
  return message;
}

function NumericInput({ label, value, onChange, min = 0 }) {
  return (
    <label className="game-correction-number">
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        value={inputValue(value)}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
      />
    </label>
  );
}

export default function GameStatCorrectionPanel({
  game,
  details,
  rosterPlayers,
  onClose,
  onSaved,
}) {
  const [tab, setTab] = useState('scoring');
  const [summary, setSummary] = useState({
    goalsFor: finite(game.goalsFor),
    goalsAgainst: finite(game.goalsAgainst),
    overtime: Boolean(game.overtime),
    status: game.status || 'final',
  });
  const [teamStats, setTeamStats] = useState(() => Object.fromEntries(
    TEAM_STATS.map(([key]) => [key, details.team?.[key] ?? null]),
  ));
  const [playerLines, setPlayerLines] = useState(() => details.players.map(cleanPlayerLine));
  const [goalieLines, setGoalieLines] = useState(() => details.goalies.map(cleanGoalieLine));
  const [events, setEvents] = useState(() => details.events.map((event) => ({ ...event, detail: { ...event.detail } })));
  const [goal, setGoal] = useState(EMPTY_GOAL);
  const [penalty, setPenalty] = useState(EMPTY_PENALTY);
  const [newPlayerId, setNewPlayerId] = useState('');
  const [newGoalieId, setNewGoalieId] = useState('');
  const [note, setNote] = useState(game.adminCorrection?.note || '');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [statusTone, setStatusTone] = useState('');
  const playersById = useMemo(
    () => new Map(rosterPlayers.map((player) => [String(player.id), player])),
    [rosterPlayers],
  );
  const fieldPlayerIds = new Set(playerLines.map((line) => String(line.playerId)));
  const goaliePlayerIds = new Set(goalieLines.map((line) => String(line.playerId)));
  const availableFieldPlayers = rosterPlayers.filter((player) => !fieldPlayerIds.has(String(player.id)));
  const availableGoalies = rosterPlayers.filter((player) => !goaliePlayerIds.has(String(player.id)));
  const ourGoalCount = events.filter((event) => event.eventType === 'goal' && event.teamSide === 'us').length;

  const ensurePlayerLine = (playerId) => {
    if (!playerId) return;
    setPlayerLines((current) => current.some((line) => String(line.playerId) === String(playerId))
      ? current
      : [...current, starterPlayerLine(playerId)]);
  };

  const bumpPlayer = (playerId, field, amount) => {
    if (!playerId) return;
    setPlayerLines((current) => {
      const existing = current.find((line) => String(line.playerId) === String(playerId));
      const base = existing || starterPlayerLine(playerId);
      const updated = {
        ...base,
        [field]: Math.max(0, finite(base[field]) + amount),
      };
      return existing
        ? current.map((line) => String(line.playerId) === String(playerId) ? updated : line)
        : [...current, updated];
    });
  };

  const addGoal = () => {
    const scorer = goal.teamSide === 'us'
      ? playerName(playersById, goal.scorerId, '')
      : goal.opponentScorer.trim();
    if (!scorer) {
      setStatus('Choose or enter the goal scorer.');
      setStatusTone('error');
      return;
    }
    const assistIds = goal.teamSide === 'us'
      ? [goal.assistOneId, goal.assistTwoId].filter((id, index, all) => id && id !== goal.scorerId && all.indexOf(id) === index)
      : [];
    const nextEvent = {
      id: eventId(),
      period: Math.max(1, finite(goal.period, 1)),
      clockSeconds: clockSeconds(goal.clock),
      eventType: 'goal',
      teamSide: goal.teamSide,
      primaryPlayerId: goal.teamSide === 'us' ? goal.scorerId : null,
      secondaryPlayerId: assistIds[0] || null,
      detail: {
        scorer,
        strength: goal.strength,
        assists: assistIds.map((id) => playerName(playersById, id)),
        assistPlayerIds: assistIds,
      },
      source: 'admin',
    };
    setEvents((current) => [...current, nextEvent]);
    if (goal.teamSide === 'us') {
      bumpPlayer(goal.scorerId, 'goals', 1);
      assistIds.forEach((id) => bumpPlayer(id, 'assists', 1));
      if (goal.strength === 'PP') bumpPlayer(goal.scorerId, 'powerPlayGoals', 1);
      if (goal.strength === 'SH') bumpPlayer(goal.scorerId, 'shortHandedGoals', 1);
      if (goal.strength === 'EN') bumpPlayer(goal.scorerId, 'emptyNetGoals', 1);
    }
    setGoal(EMPTY_GOAL);
    setStatus('Goal added. Player totals updated in the preview.');
    setStatusTone('success');
  };

  const addPenalty = () => {
    const name = penalty.teamSide === 'us'
      ? playerName(playersById, penalty.playerId, '')
      : penalty.opponentPlayer.trim();
    if (!name || !penalty.penalty.trim()) {
      setStatus('Choose the player and enter the infraction.');
      setStatusTone('error');
      return;
    }
    const minutes = Math.max(0, finite(penalty.minutes));
    setEvents((current) => [...current, {
      id: eventId(),
      period: Math.max(1, finite(penalty.period, 1)),
      clockSeconds: clockSeconds(penalty.clock),
      eventType: 'penalty',
      teamSide: penalty.teamSide,
      primaryPlayerId: penalty.teamSide === 'us' ? penalty.playerId : null,
      secondaryPlayerId: null,
      detail: { player: name, minutes, penalty: penalty.penalty.trim() },
      source: 'admin',
    }]);
    if (penalty.teamSide === 'us') bumpPlayer(penalty.playerId, 'penaltyMinutes', minutes);
    setPenalty(EMPTY_PENALTY);
    setStatus('Penalty added. The player line has been updated.');
    setStatusTone('success');
  };

  const removeEvent = (event) => {
    if (event.teamSide === 'us' && event.eventType === 'goal') {
      bumpPlayer(event.primaryPlayerId, 'goals', -1);
      const assistIds = event.detail?.assistPlayerIds || [event.secondaryPlayerId].filter(Boolean);
      assistIds.forEach((id) => bumpPlayer(id, 'assists', -1));
      if (event.detail?.strength === 'PP') bumpPlayer(event.primaryPlayerId, 'powerPlayGoals', -1);
      if (event.detail?.strength === 'SH') bumpPlayer(event.primaryPlayerId, 'shortHandedGoals', -1);
      if (event.detail?.strength === 'EN') bumpPlayer(event.primaryPlayerId, 'emptyNetGoals', -1);
    }
    if (event.teamSide === 'us' && event.eventType === 'penalty') {
      bumpPlayer(event.primaryPlayerId, 'penaltyMinutes', -finite(event.detail?.minutes));
    }
    setEvents((current) => current.filter((item) => item.id !== event.id));
  };

  const save = async () => {
    setBusy(true);
    setStatus('');
    try {
      await saveTeamGameStatOverride({
        gameKey: effectiveGameKey(game),
        gameExternalId: game.externalId,
        seasonTeamId: game.seasonTeamId,
        note,
        payload: {
          version: 1,
          game: summary,
          teamStats,
          playerLines,
          goalieLines,
          events,
        },
      });
      await onSaved();
      setStatus('Correction published. Every game, season, career, leaderboard, and profile view now uses it.');
      setStatusTone('success');
    } catch (error) {
      setStatus(correctionError(error));
      setStatusTone('error');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!window.confirm('Remove this correction and return to the league data?')) return;
    setBusy(true);
    setStatus('');
    try {
      await removeTeamGameStatOverride(effectiveGameKey(game));
      await onSaved();
      onClose();
    } catch (error) {
      setStatus(correctionError(error));
      setStatusTone('error');
      setBusy(false);
    }
  };

  return (
    <div className="stats-manager-backdrop game-correction-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="game-correction-panel" role="dialog" aria-modal="true" aria-labelledby="game-correction-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="stats-manager-header game-correction-header">
          <div>
            <span><PencilLine aria-hidden="true" /> TEAM UPDATE</span>
            <h2 id="game-correction-title">{game.opponent} · {formatGameDate(game.scheduledAt)}</h2>
            <p>The league import stays untouched. This team correction becomes the game sheet shown in the app.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close game correction" title="Close"><X aria-hidden="true" /></button>
        </header>

        <nav className="stats-manager-tabs game-correction-tabs" aria-label="Game correction section">
          {[
            ['scoring', 'Scoring'],
            ['players', 'Player lines'],
            ['team', 'Game totals'],
            ['goalies', 'Goalies'],
          ].map(([id, label]) => <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}
        </nav>

        <div className="game-correction-scroll">
          {tab === 'scoring' && <div className="game-correction-section">
            <div className="game-correction-scoreboard">
              <NumericInput label="Goonsquad" value={summary.goalsFor} onChange={(value) => setSummary((current) => ({ ...current, goalsFor: finite(value) }))} />
              <strong>{finite(summary.goalsFor)}–{finite(summary.goalsAgainst)}</strong>
              <NumericInput label={game.opponent} value={summary.goalsAgainst} onChange={(value) => setSummary((current) => ({ ...current, goalsAgainst: finite(value) }))} />
              <span data-complete={ourGoalCount === finite(summary.goalsFor)}>{ourGoalCount} of {finite(summary.goalsFor)} Goonsquad goals assigned</span>
            </div>

            <section className="game-correction-card">
              <header><div><span>ADD EVENT</span><h3>Goal</h3></div><Plus aria-hidden="true" /></header>
              <div className="game-correction-form-grid">
                <label><span>Team</span><select value={goal.teamSide} onChange={(event) => setGoal({ ...goal, teamSide: event.target.value })}><option value="us">Goonsquad</option><option value="opponent">{game.opponent}</option></select></label>
                {goal.teamSide === 'us' ? <label className="is-wide"><span>Scorer</span><select value={goal.scorerId} onChange={(event) => { ensurePlayerLine(event.target.value); setGoal({ ...goal, scorerId: event.target.value }); }}><option value="">Choose scorer</option>{rosterPlayers.map((player) => <option key={player.id} value={player.id}>{player.displayName}</option>)}</select></label> : <label className="is-wide"><span>Opponent scorer</span><input value={goal.opponentScorer} onChange={(event) => setGoal({ ...goal, opponentScorer: event.target.value })} /></label>}
                {goal.teamSide === 'us' && <><label><span>Primary assist</span><select value={goal.assistOneId} onChange={(event) => setGoal({ ...goal, assistOneId: event.target.value })}><option value="">Unassisted</option>{rosterPlayers.filter((player) => String(player.id) !== goal.scorerId).map((player) => <option key={player.id} value={player.id}>{player.displayName}</option>)}</select></label><label><span>Secondary assist</span><select value={goal.assistTwoId} onChange={(event) => setGoal({ ...goal, assistTwoId: event.target.value })}><option value="">None</option>{rosterPlayers.filter((player) => String(player.id) !== goal.scorerId && String(player.id) !== goal.assistOneId).map((player) => <option key={player.id} value={player.id}>{player.displayName}</option>)}</select></label></>}
                <label><span>Strength</span><select value={goal.strength} onChange={(event) => setGoal({ ...goal, strength: event.target.value })}><option value="EV">Even strength</option><option value="PP">Power play</option><option value="SH">Short-handed</option><option value="EN">Empty net</option><option value="PS">Penalty shot</option></select></label>
                <label><span>Period</span><input type="number" min="1" value={goal.period} onChange={(event) => setGoal({ ...goal, period: event.target.value })} /></label>
                <label><span>Time (m:ss)</span><input inputMode="numeric" placeholder="8:42" value={goal.clock} onChange={(event) => setGoal({ ...goal, clock: event.target.value })} /></label>
              </div>
              <button type="button" className="game-correction-add" onClick={addGoal}><Plus aria-hidden="true" /> Add goal</button>
            </section>

            <section className="game-correction-card">
              <header><div><span>ADD EVENT</span><h3>Penalty</h3></div><Plus aria-hidden="true" /></header>
              <div className="game-correction-form-grid">
                <label><span>Team</span><select value={penalty.teamSide} onChange={(event) => setPenalty({ ...penalty, teamSide: event.target.value })}><option value="us">Goonsquad</option><option value="opponent">{game.opponent}</option></select></label>
                {penalty.teamSide === 'us' ? <label className="is-wide"><span>Player</span><select value={penalty.playerId} onChange={(event) => { ensurePlayerLine(event.target.value); setPenalty({ ...penalty, playerId: event.target.value }); }}><option value="">Choose player</option>{rosterPlayers.map((player) => <option key={player.id} value={player.id}>{player.displayName}</option>)}</select></label> : <label className="is-wide"><span>Opponent player</span><input value={penalty.opponentPlayer} onChange={(event) => setPenalty({ ...penalty, opponentPlayer: event.target.value })} /></label>}
                <label className="is-wide"><span>Infraction</span><input placeholder="Tripping" value={penalty.penalty} onChange={(event) => setPenalty({ ...penalty, penalty: event.target.value })} /></label>
                <label><span>Minutes</span><input type="number" min="0" value={penalty.minutes} onChange={(event) => setPenalty({ ...penalty, minutes: event.target.value })} /></label>
                <label><span>Period</span><input type="number" min="1" value={penalty.period} onChange={(event) => setPenalty({ ...penalty, period: event.target.value })} /></label>
                <label><span>Time (m:ss)</span><input inputMode="numeric" placeholder="12:10" value={penalty.clock} onChange={(event) => setPenalty({ ...penalty, clock: event.target.value })} /></label>
              </div>
              <button type="button" className="game-correction-add" onClick={addPenalty}><Plus aria-hidden="true" /> Add penalty</button>
            </section>

            <section className="game-correction-card game-correction-events">
              <header><div><span>GAME LOG</span><h3>{events.length ? `${events.length} published events` : 'No events yet'}</h3></div><Check aria-hidden="true" /></header>
              {events.length > 0 && <ol>{events.slice().sort((a, b) => finite(a.period) - finite(b.period) || finite(a.clockSeconds) - finite(b.clockSeconds)).map((event) => <li key={event.id}><span>P{event.period}<small>{clockLabel(event.clockSeconds)}</small></span><div><strong>{event.eventType === 'goal' ? event.detail?.scorer : event.detail?.player}</strong><small>{event.teamSide === 'us' ? 'Goonsquad' : game.opponent} · {event.eventType === 'goal' ? [event.detail?.strength, event.detail?.assists?.length ? `from ${event.detail.assists.join(', ')}` : 'unassisted'].filter(Boolean).join(' · ') : `${event.detail?.minutes || 0} min · ${event.detail?.penalty}`}</small></div><button type="button" onClick={() => removeEvent(event)} aria-label={`Remove ${event.eventType}`}><Trash2 aria-hidden="true" /></button></li>)}</ol>}
            </section>
          </div>}

          {tab === 'players' && <div className="game-correction-section">
            <div className="game-correction-intro"><span>AUTHORITATIVE BOX SCORE</span><h3>Every edit below changes this game and the player&apos;s season and career totals.</h3></div>
            <div className="game-correction-add-line"><select value={newPlayerId} onChange={(event) => setNewPlayerId(event.target.value)}><option value="">Add another roster player</option>{availableFieldPlayers.map((player) => <option key={player.id} value={player.id}>{player.displayName}</option>)}</select><button type="button" disabled={!newPlayerId} onClick={() => { setPlayerLines((current) => [...current, starterPlayerLine(newPlayerId)]); setNewPlayerId(''); }}><Plus aria-hidden="true" /> Add line</button></div>
            <div className="game-correction-table-scroll"><table className="game-correction-table"><thead><tr><th>Player</th>{PLAYER_STATS.map(([, label]) => <th key={label}>{label}</th>)}<th><span className="sr-only">Remove</span></th></tr></thead><tbody>{playerLines.slice().sort((a, b) => playerName(playersById, a.playerId).localeCompare(playerName(playersById, b.playerId))).map((line) => <tr key={line.playerId}><td>{playerName(playersById, line.playerId)}</td>{PLAYER_STATS.map(([field]) => <td key={field}><input type="number" min={field === 'plusMinus' ? -30 : 0} value={inputValue(line[field])} aria-label={`${playerName(playersById, line.playerId)} ${field}`} onChange={(event) => setPlayerLines((current) => current.map((item) => item.playerId === line.playerId ? { ...item, [field]: event.target.value === '' ? null : Number(event.target.value) } : item))} /></td>)}<td><button type="button" onClick={() => setPlayerLines((current) => current.filter((item) => item.playerId !== line.playerId))} aria-label={`Remove ${playerName(playersById, line.playerId)} from the box score`}><Trash2 aria-hidden="true" /></button></td></tr>)}</tbody></table></div>
          </div>}

          {tab === 'team' && <div className="game-correction-section">
            <div className="game-correction-intro"><span>GAME TOTALS</span><h3>Enter only what is known. A blank stays unpublished instead of pretending to be zero.</h3></div>
            <div className="game-correction-team-grid">{TEAM_STATS.map(([field, label]) => <NumericInput key={field} label={label} value={teamStats[field]} onChange={(value) => setTeamStats((current) => ({ ...current, [field]: value }))} />)}</div>
            <label className="game-correction-check"><input type="checkbox" checked={summary.overtime} onChange={(event) => setSummary((current) => ({ ...current, overtime: event.target.checked }))} /><span>Overtime result</span></label>
          </div>}

          {tab === 'goalies' && <div className="game-correction-section">
            <div className="game-correction-intro"><span>GOALTENDING</span><h3>Add or correct the complete goalie line for this game.</h3></div>
            <div className="game-correction-add-line"><select value={newGoalieId} onChange={(event) => setNewGoalieId(event.target.value)}><option value="">Add goalie</option>{availableGoalies.map((player) => <option key={player.id} value={player.id}>{player.displayName}</option>)}</select><button type="button" disabled={!newGoalieId} onClick={() => { setGoalieLines((current) => [...current, starterGoalieLine(newGoalieId)]); setNewGoalieId(''); }}><Plus aria-hidden="true" /> Add line</button></div>
            {goalieLines.map((line) => <section className="game-correction-goalie" key={line.playerId}><header><strong>{playerName(playersById, line.playerId)}</strong><button type="button" onClick={() => setGoalieLines((current) => current.filter((item) => item.playerId !== line.playerId))}><Trash2 aria-hidden="true" /> Remove</button></header><div className="game-correction-team-grid"><label><span>Result</span><select value={line.wins ? 'win' : line.losses ? 'loss' : line.ties ? 'tie' : 'none'} onChange={(event) => setGoalieLines((current) => current.map((item) => item.playerId === line.playerId ? { ...item, wins: event.target.value === 'win' ? 1 : 0, losses: event.target.value === 'loss' ? 1 : 0, ties: event.target.value === 'tie' ? 1 : 0 } : item))}><option value="none">No result</option><option value="win">Win</option><option value="loss">Loss</option><option value="tie">Tie</option></select></label>{[['shotsAgainst', 'Shots against'], ['saves', 'Saves'], ['goalsAgainst', 'Goals against'], ['minutesPlayed', 'Minutes'], ['shutouts', 'Shutout (0/1)']].map(([field, label]) => <NumericInput key={field} label={label} value={line[field]} onChange={(value) => setGoalieLines((current) => current.map((item) => item.playerId === line.playerId ? { ...item, [field]: finite(value) } : item))} />)}</div></section>)}
          </div>}
        </div>

        <footer className="game-correction-footer">
          <label><span>Admin note <small>Optional · visible with the correction</small></span><input aria-label="Admin note (optional)" maxLength="1000" value={note} placeholder="Why this was corrected" onChange={(event) => setNote(event.target.value)} /></label>
          {status && <p role="status" data-tone={statusTone}>{status}</p>}
          <div>
            {game.adminCorrection && <button type="button" className="is-reset" disabled={busy} onClick={reset}><RotateCcw aria-hidden="true" /> Use league data</button>}
            <button type="button" className="is-save" disabled={busy} onClick={save}><Save aria-hidden="true" /> {busy ? 'Publishing…' : 'Publish correction'}</button>
          </div>
        </footer>
      </section>
    </div>
  );
}
