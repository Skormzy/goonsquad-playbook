import { useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck2,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  HelpCircle,
  UsersRound,
  X,
} from 'lucide-react';
import { formatGameDate, formatLeagueScheduleName } from '../stats/statsModel';
import {
  loadGameAvailability,
  saveGameAvailability,
} from './lineupCloud';
import AttendanceNotificationControl from './AttendanceNotificationControl';
import AttendanceReminderManager from './AttendanceReminderManager';
import './gameAvailability.css';

const RESPONSES = Object.freeze([
  { id: 'in', label: "I'm in", short: 'In', Icon: Check },
  { id: 'maybe', label: 'Maybe', short: 'Maybe', Icon: HelpCircle },
  { id: 'out', label: "I'm out", short: 'Out', Icon: X },
]);

function Avatar({ member }) {
  return (
    <span className="game-availability-avatar">
      {member.avatarUrl
        ? <img src={member.avatarUrl} alt="" />
        : member.displayName?.slice(0, 1).toUpperCase() || '?'}
    </span>
  );
}

export default function GameAvailability({
  accessManager = null,
  account,
  canRespond = true,
  compactDock = false,
  fixture,
  isAdmin = false,
  members = [],
  onExpandDock = null,
  qaMode = false,
  schedule,
  trackingResponses = [],
}) {
  const [responses, setResponses] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!fixture?.id || (!account.hasTeamAccess && !qaMode)) {
      setResponses([]);
      return undefined;
    }
    if (qaMode) {
      setConfigured(true);
      setResponses([
        { fixtureId: fixture.id, userId: 'qa-user', response: 'in', note: '', updatedAt: new Date().toISOString() },
        { fixtureId: fixture.id, userId: 'qa-coach', response: 'in', note: '', updatedAt: new Date().toISOString() },
      ]);
      return undefined;
    }
    loadGameAvailability(fixture.id)
      .then((result) => {
        if (!active) return;
        setConfigured(result.configured);
        setResponses(result.responses);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Availability could not load.');
      });
    return () => { active = false; };
  }, [account.hasTeamAccess, fixture?.id, qaMode]);

  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );
  const allResponses = useMemo(
    () => [...responses, ...trackingResponses],
    [responses, trackingResponses],
  );
  const responseByUser = useMemo(
    () => new Map(allResponses.map((response) => [response.userId, response])),
    [allResponses],
  );
  const actorId = account.user?.id || (qaMode ? 'qa-user' : '');
  const current = responseByUser.get(actorId) || null;
  const groups = useMemo(() => Object.fromEntries(
    RESPONSES.map(({ id }) => [
      id,
      allResponses
        .filter((response) => response.response === id)
        .map((response) => memberById.get(response.userId))
        .filter(Boolean),
    ]),
  ), [allResponses, memberById]);
  const awaiting = members.filter((member) => !responseByUser.has(member.id));

  if ((!account.hasTeamAccess && !qaMode) || !fixture) return null;

  const competitionLabel = fixture.kind === 'tournament'
    ? [fixture.tournamentName, fixture.stageLabel].filter(Boolean).join(' · ')
    : formatLeagueScheduleName(schedule);

  const choose = async (response) => {
    if (busy || !configured || !actorId || !canRespond) return;
    setBusy(true);
    setError('');
    const optimistic = {
      fixtureId: fixture.id,
      userId: actorId,
      response,
      note: '',
      updatedAt: new Date().toISOString(),
    };
    setResponses((currentRows) => [
      optimistic,
      ...currentRows.filter((row) => row.userId !== actorId),
    ]);
    try {
      if (qaMode) return;
      await saveGameAvailability({
        fixtureId: fixture.id,
        userId: actorId,
        response,
      });
    } catch (saveError) {
      const refreshed = await loadGameAvailability(fixture.id).catch(() => null);
      if (refreshed) setResponses(refreshed.responses);
      setError(saveError instanceof Error ? saveError.message : 'Availability could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const responseChoices = (shortLabels = false) => (
    <div className="game-availability-choice" role="group" aria-label="Your availability">
      {RESPONSES.map((item) => {
        const ResponseIcon = item.Icon;
        return (
          <button
            type="button"
            key={item.id}
            data-response={item.id}
            aria-label={item.label}
            aria-pressed={current?.response === item.id}
            disabled={busy}
            onClick={() => choose(item.id)}
          >
            <ResponseIcon aria-hidden="true" />
            {shortLabels ? item.short : item.label}
          </button>
        );
      })}
    </div>
  );

  if (compactDock) {
    return (
      <section className="game-availability is-compact-dock" aria-label={`Attendance for ${fixture.opponent}`}>
        {!configured ? (
          <div className="game-availability-setup">
            <Clock3 aria-hidden="true" />
            <span><strong>Lineup board is finishing setup</strong><small>Attendance will appear shortly.</small></span>
          </div>
        ) : (
          <>
            {canRespond && responseChoices(true)}
            <button
              type="button"
              className="game-availability-summary"
              aria-label="Open attendance details"
              onClick={onExpandDock}
            >
              <span data-response="in"><b>{groups.in.length}</b> In</span>
              <span data-response="maybe"><b>{groups.maybe.length}</b> Maybe</span>
              <span data-response="out"><b>{groups.out.length}</b> Out</span>
              <span><b>{awaiting.length}</b> Waiting</span>
              <ChevronUp aria-hidden="true" />
            </button>
          </>
        )}
        {error && <p className="game-availability-error" role="alert">{error}</p>}
      </section>
    );
  }

  return (
    <section className="game-availability" aria-labelledby="game-availability-title">
      <header>
        <CalendarCheck2 aria-hidden="true" />
        <div>
          <span>GAME LINEUP</span>
          <h2 id="game-availability-title">vs {fixture.opponent}</h2>
          <p>{formatGameDate(fixture.scheduledAt)} · {competitionLabel}</p>
        </div>
      </header>

      {!configured ? (
        <div className="game-availability-setup">
          <Clock3 aria-hidden="true" />
          <span><strong>Lineup board is finishing setup</strong><small>Player availability will appear here shortly.</small></span>
        </div>
      ) : (
        <>
          {canRespond ? responseChoices() : (
            <div className="game-availability-coach-view">
              <UsersRound aria-hidden="true" />
              <span><strong>Coach view</strong><small>Add yourself as a player only if you are dressing for this game.</small></span>
            </div>
          )}

          <button
            type="button"
            className="game-availability-summary"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            <span data-response="in"><b>{groups.in.length}</b> In</span>
            <span data-response="maybe"><b>{groups.maybe.length}</b> Maybe</span>
            <span data-response="out"><b>{groups.out.length}</b> Out</span>
            <span><b>{awaiting.length}</b> Waiting</span>
            {expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </button>

          {expanded && (
            <div className="game-availability-roster">
              {RESPONSES.map(({ id, short }) => (
                <section key={id} data-response={id}>
                  <h3>{short} <span>{groups[id].length}</span></h3>
                  {groups[id].map((member) => (
                    <div key={member.id}>
                      <Avatar member={member} />
                      <span>
                        <strong>{member.displayName}</strong>
                        <small>
                          {[
                            member.attendanceRole === 'EP' ? 'EP' : null,
                            member.jerseyNumber ? `#${member.jerseyNumber}` : null,
                            member.position,
                          ].filter(Boolean).join(' · ') || (member.username ? `@${member.username}` : 'Player')}
                        </small>
                      </span>
                    </div>
                  ))}
                  {!groups[id].length && <p>No responses yet</p>}
                </section>
              ))}
              <section data-response="waiting">
                <h3>Waiting <span>{awaiting.length}</span></h3>
                {awaiting.map((member) => (
                  <div key={member.id}>
                    <Avatar member={member} />
                    <span>
                      <strong>{member.displayName}</strong>
                      <small>{member.attendanceRole === 'EP' ? 'EP · Not answered' : 'Not answered'}</small>
                    </span>
                  </div>
                ))}
                {!awaiting.length && <p>Everyone answered</p>}
              </section>
            </div>
          )}
          {canRespond && <AttendanceNotificationControl qaMode={qaMode} />}
          {isAdmin && (
            <AttendanceReminderManager
              awaiting={awaiting}
              competitionLabel={competitionLabel}
              fixture={fixture}
              qaMode={qaMode}
            />
          )}
          {accessManager}
        </>
      )}
      {error && <p className="game-availability-error" role="alert">{error}</p>}
      <footer><UsersRound aria-hidden="true" /> Game roster and EPs</footer>
    </section>
  );
}
