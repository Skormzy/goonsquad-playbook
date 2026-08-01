import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const visibleModules = [
  './PlayerProfilePage.jsx',
  './StatsWorkspace.jsx',
  './OpponentHeadToHead.jsx',
  './AllTimeRecords.jsx',
  './TournamentWorkspace.jsx',
  './TournamentAdminPanel.jsx',
  './GameStatCorrectionPanel.jsx',
  '../account/AccountDialog.jsx',
  '../account/AccountWorkspace.jsx',
  '../account/AccountAdminPanel.jsx',
  '../profile/ProfileWorkspace.jsx',
  '../feed/TeamHome.jsx',
  '../help/guideContent.js',
].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');

describe('player-facing league source copy', () => {
  it('keeps verification stamps and archive receipts out of the interface', () => {
    for (const phrase of [
      'Official team archive',
      'Official profile',
      'Official source',
      'Official game sheet',
      'Official tournament totals',
      'Verified matchup context',
      'ADMIN VERIFIED',
      'source-verified',
      'verified statistics',
      'What is verified',
      'SOURCE RECEIPT',
    ]) {
      expect(visibleModules).not.toContain(phrase);
    }
  });

  it('uses plain league and action labels instead', () => {
    expect(visibleModules).toContain('League game sheet');
    expect(visibleModules).toContain('League fixture');
    expect(visibleModules).toContain('League profile');
    expect(visibleModules).toContain('Tournament page');
    expect(visibleModules).toContain('League site');
  });
});
