import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
  .replaceAll('\r\n', '\n');

const home = read('src/feed/TeamHome.jsx');
const styles = read('src/feed/feed.css');

describe('Game Pulse team ownership contract', () => {
  it('keeps Monday and Sunday records separate and routes each team to its own stats view', () => {
    expect(home).toContain('className="team-pulse-team-records"');
    expect(home).toContain('className={`team-pulse-team-record ${tone}`.trim()}');
    expect(home).toContain('onOpenStats({ season: snapshot.season.id, team: team.id })');
    expect(home).toContain("const tone = day === 'Sunday' ? 'is-sunday' : day === 'Monday' ? 'is-monday' : ''");
    expect(home).not.toContain('className="team-pulse-record"');
    expect(home).not.toContain('className="team-pulse-leagues"');
    expect(styles).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(styles).toContain('.team-pulse-team-record.is-monday');
  });

  it('clears stale stats and tournament scope before opening a team record', () => {
    for (const key of ['competition', 'season', 'stage', 'team', 'tournament', 'tournamentGame']) {
      expect(home).toContain(`'${key}',`);
    }
    expect(home).toContain('onOpenStats={(params = {}) => navigate(\'stats\', params)}');
  });
});
