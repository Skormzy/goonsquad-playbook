import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import EpManager from './EpManager';
import GameAvailability from './GameAvailability';
import {
  attendanceGrantMatches,
  attendanceParticipants,
  buildAttendanceFixtures,
  memberIsAttendanceParticipant,
  rosterTeamIdsForMember,
} from './attendanceModel';
import {
  loadAttendanceAccess,
  loadGameEpRoster,
} from './lineupCloud';
import { formatLeagueScheduleName } from '../stats/statsModel';

export default function AttendanceBoard({
  account,
  currentMember,
  dataset,
  isAdmin = false,
  members = [],
  qaMode = false,
  tournaments = [],
}) {
  const [grants, setGrants] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [epPlayers, setEpPlayers] = useState([]);
  const [epConfigured, setEpConfigured] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState('');
  const [requestedFixtureId, setRequestedFixtureId] = useState(() => (typeof window === 'undefined'
    ? ''
    : new URL(window.location.href).searchParams.get('attendanceFixture') || ''));
  const actor = useMemo(() => ({
    ...currentMember,
    id: currentMember?.id || account.user?.id || (qaMode ? 'qa-user' : ''),
    role: isAdmin ? 'admin' : currentMember?.role || account.profile?.role || 'member',
  }), [account.profile?.role, account.user?.id, currentMember, isAdmin, qaMode]);

  const refreshAccess = async ({ optimisticGrant = null, optimisticRemoval = null } = {}) => {
    if (qaMode) {
      setGrants((current) => {
        if (optimisticGrant) return [...current, optimisticGrant];
        if (optimisticRemoval) {
          return current.filter((grant) => !(
            grant.scopeType === optimisticRemoval.scopeType
            && grant.scopeId === optimisticRemoval.scopeId
            && grant.userId === optimisticRemoval.userId
          ));
        }
        return current;
      });
      return;
    }
    const result = await loadAttendanceAccess();
    setConfigured(result.configured);
    setGrants(result.grants);
  };

  useEffect(() => {
    let active = true;
    if (!account.hasTeamAccess && !qaMode) return undefined;
    if (qaMode) return undefined;
    loadAttendanceAccess()
      .then((result) => {
        if (!active) return;
        setConfigured(result.configured);
        setGrants(result.grants);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Attendance access could not load.');
      });
    return () => { active = false; };
  }, [account.hasTeamAccess, qaMode]);

  const fixtures = useMemo(() => buildAttendanceFixtures({
    dataset,
    tournaments,
    grants,
    member: actor,
  }), [actor, dataset, grants, tournaments]);

  const requestedIndex = requestedFixtureId
    ? fixtures.findIndex((item) => item.id === requestedFixtureId)
    : -1;
  const safeIndex = fixtures.length
    ? Math.min(requestedIndex >= 0 ? requestedIndex : activeIndex, fixtures.length - 1)
    : 0;
  const fixture = fixtures[safeIndex] || null;

  const refreshEpRoster = async ({
    optimisticAdd = null,
    optimisticUpdate = null,
    optimisticRemoval = null,
  } = {}) => {
    if (qaMode) {
      setEpPlayers((current) => {
        if (optimisticAdd) return [...current, optimisticAdd];
        if (optimisticUpdate) {
          return current.map((player) => (
            player.playerId === optimisticUpdate.playerId
              ? { ...player, ...optimisticUpdate }
              : player
          ));
        }
        if (optimisticRemoval) {
          return current.filter((player) => player.playerId !== optimisticRemoval);
        }
        return current;
      });
      return;
    }
    if (!fixture?.id) {
      setEpPlayers([]);
      return;
    }
    const result = await loadGameEpRoster(fixture.id);
    setEpConfigured(result.configured);
    setEpPlayers(result.players);
  };

  useEffect(() => {
    let active = true;
    if ((!account.hasTeamAccess && !qaMode) || qaMode || !fixture?.id) return undefined;
    loadGameEpRoster(fixture.id)
      .then((result) => {
        if (!active) return;
        setEpConfigured(result.configured);
        setEpPlayers(result.players);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'EP roster could not load.');
      });
    return () => { active = false; };
  }, [account.hasTeamAccess, fixture?.id, qaMode]);

  if ((!account.hasTeamAccess && !qaMode) || !dataset || !fixtures.length) return null;

  const accountParticipantCandidates = qaMode
    ? members.filter((member) => (
      member.qaAttendanceParticipant !== false
      || grants.some((grant) => grant.userId === member.id && attendanceGrantMatches(grant, fixture))
    ))
    : attendanceParticipants({ dataset, fixture, grants, members });
  const accountParticipants = accountParticipantCandidates.map((member) => ({
    ...member,
    attendanceRole: fixture?.seasonTeamId
      && rosterTeamIdsForMember(dataset, member).has(fixture.seasonTeamId)
      ? 'Roster'
      : 'EP',
  }));
  const participants = [...accountParticipants, ...epPlayers];
  const canRespond = qaMode || memberIsAttendanceParticipant({
    dataset,
    fixture,
    grants,
    member: actor,
  });
  const move = (direction) => {
    setRequestedFixtureId('');
    setActiveIndex((safeIndex + direction + fixtures.length) % fixtures.length);
  };
  const chooseFixture = (index) => {
    setRequestedFixtureId('');
    setActiveIndex(index);
  };

  return (
    <section className="attendance-board" aria-label="Upcoming game attendance">
      <header className="attendance-board-header">
        <div>
          <span><CalendarDays aria-hidden="true" /> ATTENDANCE</span>
          <strong>{safeIndex + 1} of {fixtures.length}</strong>
        </div>
        <nav aria-label="Choose an upcoming game">
          <button type="button" onClick={() => move(-1)} disabled={fixtures.length < 2} aria-label="Previous game"><ChevronLeft aria-hidden="true" /></button>
          <button type="button" onClick={() => move(1)} disabled={fixtures.length < 2} aria-label="Next game"><ChevronRight aria-hidden="true" /></button>
        </nav>
      </header>
      <div className="attendance-board-tabs" role="tablist" aria-label="Upcoming games">
        {fixtures.map((item, index) => (
          <button
            type="button"
            role="tab"
            aria-selected={index === safeIndex}
            key={item.id}
            onClick={() => chooseFixture(index)}
          >
            <small>{item.kind === 'tournament' ? item.tournamentName : formatLeagueScheduleName(item.schedule)}</small>
            <strong>vs {item.opponent}</strong>
          </button>
        ))}
      </div>
      {error && <p className="attendance-board-error" role="alert">{error}</p>}
      <GameAvailability
        account={account}
        accessManager={isAdmin ? (
          <EpManager
            accessConfigured={qaMode || configured}
            actorId={actor.id}
            dataset={dataset}
            epConfigured={qaMode || epConfigured}
            epPlayers={epPlayers}
            fixture={fixture}
            grants={grants}
            members={members}
            participants={participants}
            onAccessChanged={refreshAccess}
            onEpChanged={refreshEpRoster}
            qaMode={qaMode}
          />
        ) : null}
        canRespond={canRespond}
        fixture={fixture}
        isAdmin={isAdmin}
        members={participants}
        qaMode={qaMode}
        schedule={fixture.schedule}
        trackingResponses={epPlayers.map((player) => ({
          fixtureId: fixture.id,
          userId: player.id,
          response: player.response,
          note: player.note,
          updatedAt: player.updatedAt,
        }))}
      />
      <footer><ShieldCheck aria-hidden="true" /> Attendance is limited to each game&apos;s roster and EPs.</footer>
    </section>
  );
}
