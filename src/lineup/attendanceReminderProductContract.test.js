import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const api = read('api/attendance-reminders.js');
const app = read('src/App.jsx');
const board = read('src/lineup/AttendanceBoard.jsx');
const game = read('src/lineup/GameAvailability.jsx');
const manager = read('src/lineup/AttendanceReminderManager.jsx');
const memberControl = read('src/lineup/AttendanceNotificationControl.jsx');
const serviceWorker = read('public/sw.js');

describe('attendance reminder product contract', () => {
  it('lets an administrator target only eligible players who are still waiting', () => {
    expect(api).toContain('requireAccountAdmin(request)');
    expect(api).toContain(".from('team_game_availability')");
    expect(api).toContain("admin.rpc('can_access_game_attendance'");
    expect(manager).toContain('Remind waiting');
    expect(manager).toContain('recipientIds: [...selected]');
    expect(game).toContain('awaiting={awaiting}');
  });

  it('supports explicit PWA push opt-in and handles notification taps', () => {
    expect(memberControl).toContain('Enable phone reminders');
    expect(serviceWorker).toContain("self.addEventListener('push'");
    expect(serviceWorker).toContain("self.addEventListener('notificationclick'");
    expect(serviceWorker).toContain('actionUrls?.[event.action]');
  });

  it('keeps email responses scanner-safe with a signed POST confirmation', () => {
    expect(api).toContain('verifyAttendanceToken');
    expect(api).toContain("body.action === 'respond'");
    expect(app).toContain('<AttendanceResponseDialog');
    expect(app).toContain("url.searchParams.delete('attendanceToken')");
  });

  it('focuses the correct fixture when a notification opens the lineup board', () => {
    expect(api).toContain("destination.searchParams.set('attendanceFixture', fixture.id)");
    expect(board).toContain("searchParams.get('attendanceFixture')");
    expect(board).toContain('requestedIndex >= 0 ? requestedIndex : activeIndex');
  });
});
