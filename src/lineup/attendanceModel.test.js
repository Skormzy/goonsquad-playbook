import { describe, expect, it } from 'vitest';
import {
  attendanceParticipants,
  buildAttendanceFixtures,
  memberCanViewAttendance,
} from './attendanceModel';

const NOW = new Date('2026-07-31T12:00:00-04:00').getTime();
const dataset = {
  players: [
    { id: 'player-seymour', externalId: '101' },
    { id: 'player-sunday', externalId: '202' },
  ],
  memberships: [
    { playerId: 'player-seymour', seasonTeamId: 'monday', active: true },
    { playerId: 'player-sunday', seasonTeamId: 'sunday', active: true },
  ],
  teams: [
    { id: 'monday', scheduleLabel: 'MONDAY' },
    { id: 'sunday', scheduleLabel: 'SUNDAY' },
  ],
  games: [
    { id: 'sun-1', seasonTeamId: 'sunday', opponent: 'Viperz', scheduledAt: '2026-08-02T18:00:00-04:00', status: 'scheduled', stage: 'regular' },
    { id: 'mon-1', seasonTeamId: 'monday', opponent: 'Red Wolves', scheduledAt: '2026-08-03T19:00:00-04:00', status: 'scheduled', stage: 'regular' },
    { id: 'sun-2', seasonTeamId: 'sunday', opponent: 'Bomb Squad', scheduledAt: '2026-08-09T18:00:00-04:00', status: 'scheduled', stage: 'playoffs' },
    { id: 'mon-2', seasonTeamId: 'monday', opponent: 'Ducks', scheduledAt: '2026-08-10T19:00:00-04:00', status: 'scheduled', stage: 'playoffs' },
    { id: 'mon-3', seasonTeamId: 'monday', opponent: 'Bloodhounds', scheduledAt: '2026-08-17T19:00:00-04:00', status: 'scheduled', stage: 'playoffs' },
  ],
};
const seymour = { id: 'user-seymour', role: 'member', playerExternalId: '101' };
const sundayPlayer = { id: 'user-sunday', role: 'member', playerExternalId: '202' };

describe('fixture-scoped attendance', () => {
  it('shows a linked member only the next two games on their own roster', () => {
    const fixtures = buildAttendanceFixtures({ dataset, member: seymour, now: NOW });
    expect(fixtures.map((fixture) => fixture.id)).toEqual(['mon-1', 'mon-2']);
    expect(fixtures.some((fixture) => fixture.seasonTeamId === 'sunday')).toBe(false);
  });

  it('adds exactly one other-league game when an admin calls the member up', () => {
    const grants = [{ scopeType: 'fixture', scopeId: 'sun-1', userId: seymour.id }];
    const fixtures = buildAttendanceFixtures({ dataset, grants, member: seymour, now: NOW });
    expect(fixtures.map((fixture) => fixture.id)).toEqual(['sun-1', 'mon-1']);
    expect(memberCanViewAttendance({ dataset, fixture: dataset.games[2], grants, member: seymour })).toBe(false);
  });

  it('unlocks every open game in an invited tournament', () => {
    const tournaments = [{
      id: 'provincials-2026',
      name: 'Provincials 2026',
      shortName: 'Provincials',
      status: 'upcoming',
      startDate: '2026-08-21',
      games: [
        { id: 't-game-1', opponent: 'Alpha', date: '2026-08-21', time: '18:00', status: 'scheduled', stage: 'round-robin' },
        { id: 't-game-2', opponent: 'Beta', date: '2026-08-22', time: '10:00', status: 'scheduled', stage: 'round-robin' },
        { id: 't-semifinal', opponent: 'TBD', date: '2026-08-23', time: '10:00', status: 'scheduled', stage: 'semifinal' },
      ],
    }];
    const grants = [{ scopeType: 'tournament', scopeId: 'provincials-2026', userId: seymour.id }];
    const fixtures = buildAttendanceFixtures({ dataset, tournaments, grants, member: seymour, now: NOW });
    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      'mon-1',
      'mon-2',
      't-game-1',
      't-game-2',
      't-semifinal',
    ]);
  });

  it('keeps the response roster to scheduled players and explicit call-ups', () => {
    const fixture = { ...dataset.games[0], kind: 'league' };
    const invited = { id: seymour.id, role: 'member', playerExternalId: '101' };
    const grants = [{ scopeType: 'fixture', scopeId: fixture.id, userId: invited.id }];
    const participants = attendanceParticipants({
      dataset,
      fixture,
      grants,
      members: [invited, sundayPlayer, { id: 'coach', role: 'admin' }],
    });
    expect(participants.map((member) => member.id)).toEqual([seymour.id, sundayPlayer.id]);
  });

  it('lets an admin see the next two team games without making the coach a player', () => {
    const coach = { id: 'coach', role: 'admin' };
    const fixtures = buildAttendanceFixtures({ dataset, member: coach, now: NOW });
    expect(fixtures.map((fixture) => fixture.id)).toEqual(['sun-1', 'mon-1']);
    const participants = attendanceParticipants({ dataset, fixture: fixtures[0], members: [coach, sundayPlayer] });
    expect(participants.map((member) => member.id)).toEqual([sundayPlayer.id]);
  });
});
