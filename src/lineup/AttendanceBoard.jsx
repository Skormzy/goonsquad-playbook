import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import GameAvailability from './GameAvailability';
import {
  attendanceAccessLabel,
  attendanceGrantMatches,
  attendanceParticipants,
  buildAttendanceFixtures,
  memberIsAttendanceParticipant,
} from './attendanceModel';
import {
  grantAttendanceAccess,
  loadAttendanceAccess,
  revokeAttendanceAccess,
} from './lineupCloud';

function AccessManager({
  actorId,
  configured,
  fixture,
  grants,
  members,
  participants,
  onChanged,
  qaMode,
}) {
  const [memberId, setMemberId] = useState('');
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');
  const participantIds = useMemo(
    () => new Set(participants.map((member) => member.id)),
    [participants],
  );
  const candidates = members.filter((member) => !participantIds.has(member.id));
  const fixtureGrants = grants.filter((grant) => attendanceGrantMatches(grant, fixture));
  const grantedMembers = fixtureGrants
    .map((grant) => ({ grant, member: members.find((member) => member.id === grant.userId) }))
    .filter((entry) => entry.member);
  const scopeType = fixture.kind === 'tournament' ? 'tournament' : 'fixture';
  const scopeId = fixture.kind === 'tournament' ? fixture.tournamentId : fixture.id;

  const addMember = async () => {
    if (!memberId || !actorId || working) return;
    setWorking(`add:${memberId}`);
    setMessage('');
    try {
      if (!qaMode) {
        await grantAttendanceAccess({
          scopeType,
          scopeId,
          userId: memberId,
          assignedBy: actorId,
        });
      }
      setMessage(`${members.find((member) => member.id === memberId)?.displayName || 'Member'} added.`);
      setMemberId('');
      await onChanged({
        optimisticGrant: qaMode ? {
          scopeType,
          scopeId,
          userId: memberId,
          assignedBy: actorId,
        } : null,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That member could not be added.');
    } finally {
      setWorking('');
    }
  };

  const removeMember = async ({ grant, member }) => {
    setWorking(`remove:${member.id}`);
    setMessage('');
    try {
      if (!qaMode) {
        await revokeAttendanceAccess({
          scopeType: grant.scopeType,
          scopeId: grant.scopeId,
          userId: member.id,
        });
      }
      setMessage(`${member.displayName} removed from this attendance list.`);
      await onChanged({
        optimisticRemoval: qaMode ? grant : null,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That member could not be removed.');
    } finally {
      setWorking('');
    }
  };

  return (
    <details className="attendance-access-manager">
      <summary>
        <UserPlus aria-hidden="true" />
        <span><strong>Manage call-ups</strong><small>{attendanceAccessLabel(fixture)}</small></span>
        <b>{grantedMembers.length}</b>
      </summary>
      <div className="attendance-access-manager-body">
        {!configured && (
          <p className="attendance-access-message is-warning">Scoped attendance is finishing setup. Run the latest database migration to add call-ups.</p>
        )}
        <div className="attendance-access-picker">
          <label>
            <span>Add a member</span>
            <select value={memberId} onChange={(event) => setMemberId(event.target.value)} disabled={!configured && !qaMode}>
              <option value="">Choose a member</option>
              {candidates.map((member) => (
                <option value={member.id} key={member.id}>{member.displayName} (@{member.username})</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={addMember} disabled={!memberId || Boolean(working) || (!configured && !qaMode)}>
            {working.startsWith('add:') ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
            {fixture.kind === 'tournament' ? 'Add to tournament' : 'Add to this game'}
          </button>
        </div>
        {grantedMembers.length > 0 && (
          <div className="attendance-access-grants" aria-label="Invited members">
            {grantedMembers.map(({ grant, member }) => (
              <span key={`${grant.scopeType}:${grant.scopeId}:${member.id}`}>
                <strong>{member.displayName}</strong>
                <small>{fixture.kind === 'tournament' ? 'All tournament games' : 'This game'}</small>
                <button
                  type="button"
                  aria-label={`Remove ${member.displayName}`}
                  title="Remove call-up"
                  disabled={Boolean(working)}
                  onClick={() => removeMember({ grant, member })}
                >
                  {working === `remove:${member.id}`
                    ? <LoaderCircle className="is-spinning" aria-hidden="true" />
                    : <X aria-hidden="true" />}
                </button>
              </span>
            ))}
          </div>
        )}
        {message && <p className="attendance-access-message" role="status">{message}</p>}
      </div>
    </details>
  );
}

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
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState('');
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
    if (!account.hasTeamAccess) return undefined;
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

  if (!account.hasTeamAccess || !dataset || !fixtures.length) return null;

  const safeIndex = Math.min(activeIndex, fixtures.length - 1);
  const fixture = fixtures[safeIndex];
  const participants = qaMode
    ? members
    : attendanceParticipants({ dataset, fixture, grants, members });
  const canRespond = qaMode || memberIsAttendanceParticipant({
    dataset,
    fixture,
    grants,
    member: actor,
  });
  const move = (direction) => {
    setActiveIndex((safeIndex + direction + fixtures.length) % fixtures.length);
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
            onClick={() => setActiveIndex(index)}
          >
            <small>{item.kind === 'tournament' ? item.tournamentName : item.schedule?.scheduleLabel}</small>
            <strong>vs {item.opponent}</strong>
          </button>
        ))}
      </div>
      {error && <p className="attendance-board-error" role="alert">{error}</p>}
      <GameAvailability
        account={account}
        accessManager={isAdmin ? (
          <AccessManager
            actorId={actor.id}
            configured={qaMode || configured}
            fixture={fixture}
            grants={grants}
            members={members}
            participants={participants}
            onChanged={refreshAccess}
            qaMode={qaMode}
          />
        ) : null}
        canRespond={canRespond}
        fixture={fixture}
        members={participants}
        qaMode={qaMode}
        schedule={fixture.schedule}
      />
      <footer><ShieldCheck aria-hidden="true" /> Attendance is limited to each game&apos;s roster and invited call-ups.</footer>
    </section>
  );
}
