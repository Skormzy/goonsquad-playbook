import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./KeyboardHelp.jsx', import.meta.url), 'utf8');

describe('contextual product guide', () => {
  it('uses the detailed URL route when choosing stats help', () => {
    expect(source).toContain('guideTopicForView(activeView, routeSearch)');
    expect(source).toContain("if (topic === 'game') return 'Game result'");
    expect(source).toContain("if (topic === 'matchup') return 'Opponent matchup'");
    expect(source).toContain("if (topic === 'player-stats') return 'Player stats'");
  });

  it('labels the account workspace instead of falling back to Plays 2D', () => {
    expect(source).toContain("if (activeView === 'account') return 'Account'");
  });
});
