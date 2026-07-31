import { describe, expect, it } from 'vitest';
import {
  isPrivateTeamView,
  PRIVATE_TEAM_VIEWS,
  teamAccessPromptCopy,
} from './teamAccess';

describe('private team workspaces', () => {
  it('protects every authored team module while leaving public account surfaces open', () => {
    expect(PRIVATE_TEAM_VIEWS).toEqual([
      'playbook',
      'replay3d',
      'tactics',
      'strategy3d',
      'playmaker',
    ]);
    expect(isPrivateTeamView('stats')).toBe(false);
    expect(isPrivateTeamView('profile')).toBe(false);
    expect(isPrivateTeamView('account')).toBe(false);
  });

  it('explains that pending requests still require admin approval', () => {
    const copy = teamAccessPromptCopy('pending', 'Plays');
    expect(copy.title).toContain('admin');
    expect(copy.detail).toContain('approved');
    expect(copy.action).toBe('View request');
  });
});
