import { describe, expect, it } from 'vitest';
import {
  attendanceActionUrl,
  buildAttendanceEmail,
  signAttendanceToken,
  verifyAttendanceToken,
} from './attendanceReminders';

const secret = 'test-secret-that-is-long-enough-for-attendance-links';
const payload = {
  competitionLabel: 'Monday League',
  exp: 2_000_000_000,
  fixtureId: 'fixture-42',
  opponent: 'Viperz',
  response: 'in',
  scheduledAt: '2030-01-02T20:00:00.000Z',
  userId: 'user-17',
};

describe('attendance reminder response links', () => {
  it('round-trips a signed, unexpired attendance choice', () => {
    const token = signAttendanceToken(payload, secret);
    expect(verifyAttendanceToken(token, secret, 1_900_000_000_000)).toMatchObject(payload);
  });

  it('rejects tampered and expired links', () => {
    const token = signAttendanceToken(payload, secret);
    expect(() => verifyAttendanceToken(`${token}x`, secret, 1_900_000_000_000)).toThrow('invalid');
    expect(() => verifyAttendanceToken(token, secret, 2_000_000_001_000)).toThrow('expired');
  });

  it('creates app confirmation links and clear email actions for every response', () => {
    const actionUrls = Object.fromEntries(['in', 'maybe', 'out'].map((response) => {
      const token = signAttendanceToken({ ...payload, response }, secret);
      return [response, attendanceActionUrl('https://goonsquad.app/?content=home', token)];
    }));
    const email = buildAttendanceEmail({
      actionUrls,
      competitionLabel: payload.competitionLabel,
      message: 'Please answer tonight.',
      opponent: payload.opponent,
      scheduledAt: payload.scheduledAt,
    });

    expect(actionUrls.in).toContain('attendanceToken=');
    expect(email.html).toContain('I&#039;m in');
    expect(email.html).toContain('Maybe');
    expect(email.html).toContain('I&#039;m out');
    expect(email.text).toContain(actionUrls.out);
  });
});
