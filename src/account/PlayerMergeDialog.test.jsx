import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PlayerMergeDialog, { PlayerMergeReview } from './PlayerMergeDialog';

const preview = {
  source: { id: 'wrong', displayName: 'Abraham Saodzi', jerseyNumber: 7, position: 'W' },
  target: { id: 'correct', displayName: 'Abraham Sadozi', jerseyNumber: 0, position: 'G' },
  counts: { playerRecords: 2, gameStats: 11, goalieStats: 30, memberships: 4, accounts: 1 },
  blockers: [], conflicts: { jerseyNumber: true, position: true },
};

describe('merge confirmation direction', () => {
  it('makes the retained name and preserved records explicit', () => {
    const html = renderToStaticMarkup(<PlayerMergeReview preview={preview} number="0" position="G" onNumberChange={() => {}} onPositionChange={() => {}} />);
    const sourceCard = html.slice(html.indexOf('data-retained="false"'), html.indexOf('data-retained="true"'));
    const targetCard = html.slice(html.indexOf('data-retained="true"'), html.indexOf('player-merge-outcome'));
    expect(sourceCard).toContain('Player being merged');
    expect(sourceCard).toContain('Abraham Saodzi');
    expect(targetCard).toContain('Player that remains');
    expect(targetCard).toContain('Abraham Sadozi');
    expect(targetCard).not.toContain('Abraham Saodzi');
    expect(html).toContain('Abraham Sadozi will be the single player shown.');
    expect(html).toContain('Old profile links lead to this player.');
    expect(html).toContain('Different values');
    expect(html).toContain('<option value="0" selected="">#0</option>');
  });

  it('shows server blockers so the admin knows why combining is unavailable', () => {
    const html = renderToStaticMarkup(<PlayerMergeReview preview={{ ...preview, blockers: ['These records are linked to different member accounts.'] }} number="" position="" />);
    expect(html).toContain('These players cannot be merged yet');
    expect(html).toContain('These records are linked to different member accounts.');
    expect(html).toContain('role="alert"');
  });

  it('starts by choosing a target, without offering a commit before a server preview', () => {
    const html = renderToStaticMarkup(<PlayerMergeDialog source={preview.source} rows={[preview.source, preview.target]} onPreview={() => {}} onMerge={() => {}} onClose={() => {}} />);
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('Search for the player that remains');
    expect(html).toContain('aria-label="Merge to Abraham Sadozi"');
    expect(html).not.toContain('aria-label="Merge to Abraham Saodzi"');
    expect(html).not.toContain('type="submit"');
  });
});
