import { describe, expect, it } from 'vitest';
import {
  getRigProfileForKey,
  missingNamedPartGroups,
  missingSideBalancedPartGroups,
} from './playerRigAcceptance';

describe('player rig acceptance', () => {
  it('uses separate runner and goalie acceptance profiles', () => {
    expect(getRigProfileForKey('runnerHome').requiredClips).toContain('forehand-pass');
    expect(getRigProfileForKey('runnerHome').requiredClips).not.toContain('goalie-slide');

    expect(getRigProfileForKey('goalieAway').requiredClips).toContain('goalie-slide');
    expect(getRigProfileForKey('goalieAway').requiredClips).not.toContain('forehand-pass');
  });

  it('reports missing required named equipment groups', () => {
    const profile = getRigProfileForKey('runnerAway');
    const missing = missingNamedPartGroups(
      ['home_jersey_mesh', 'shorts', 'running_shoe_left', 'helmet_shell'],
      profile.requiredNamedPartGroups,
    );

    expect(missing).toEqual([['glove', 'mitt']]);
  });

  it('does not require static stick geometry in runner GLBs because replay owns the controlled stick', () => {
    const runner = getRigProfileForKey('runnerHome');
    const goalie = getRigProfileForKey('goalieHome');

    expect(runner.requiredNamedPartGroups).not.toContainEqual(['stick', 'shaft', 'blade']);
    expect(goalie.requiredNamedPartGroups).toContainEqual(['stick', 'shaft', 'blade']);
  });

  it('caps production runner dimensions so player rigs cannot ship with toy-wide arm spans', () => {
    const runner = getRigProfileForKey('runnerHome');

    expect(runner.maxWidth).toBeLessThanOrEqual(1.55);
    expect(runner.maxDepth).toBeLessThanOrEqual(1.55);
    expect(runner.minHeight).toBeGreaterThanOrEqual(1.45);
    expect(runner.maxHeight).toBeLessThanOrEqual(2.45);
  });

  it('reports runner equipment groups that are present on only one body side', () => {
    const profile = getRigProfileForKey('runnerHome');
    const missing = missingSideBalancedPartGroups(
      [
        'shoe_footwear_left',
        'shoe_footwear_right',
        'glove_mitt_left',
        'compression_sleeve_forearm_left',
        'jersey_uniform_top_left_sleeve',
        'jersey_uniform_top_right_sleeve',
      ],
      profile.requiredSideBalancedPartGroups.filter((group) => (
        ['shoes', 'gloves', 'forearm compression sleeves', 'jersey sleeves'].includes(group.label)
      )),
    );

    expect(missing).toEqual([
      {
        label: 'gloves',
        missingSide: 'right',
        fragments: ['glove', 'mitt'],
      },
      {
        label: 'forearm compression sleeves',
        missingSide: 'right',
        fragments: ['compression_sleeve_forearm'],
      },
    ]);
  });
});
