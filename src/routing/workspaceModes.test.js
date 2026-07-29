import { describe, expect, it } from 'vitest';
import {
  activeViewForWorkspace,
  contentForActiveView,
  isWorkspaceModeAvailable,
  modeForActiveView,
} from './workspaceModes';

describe('workspace modes', () => {
  it('separates content choice from viewing mode', () => {
    expect(contentForActiveView('playbook')).toBe('plays');
    expect(contentForActiveView('replay3d')).toBe('plays');
    expect(contentForActiveView('tactics')).toBe('strategy');
    expect(contentForActiveView('strategy3d')).toBe('strategy');
    expect(contentForActiveView('playmaker')).toBe('playmaker');
    expect(contentForActiveView('stats')).toBe('stats');
    expect(contentForActiveView('profile')).toBe('profile');
    expect(contentForActiveView('account')).toBe('account');
    expect(modeForActiveView('playbook')).toBe('2d');
    expect(modeForActiveView('replay3d')).toBe('3d');
    expect(modeForActiveView('strategy3d')).toBe('3d');
  });

  it('maps supported workspace combinations to existing surfaces', () => {
    expect(activeViewForWorkspace('plays', '2d')).toBe('playbook');
    expect(activeViewForWorkspace('plays', '3d')).toBe('replay3d');
    expect(activeViewForWorkspace('strategy', '2d')).toBe('tactics');
    expect(activeViewForWorkspace('strategy', '3d')).toBe('strategy3d');
    expect(activeViewForWorkspace('playmaker', '2d')).toBe('playmaker');
    expect(activeViewForWorkspace('stats', '2d')).toBe('stats');
    expect(activeViewForWorkspace('profile', '2d')).toBe('profile');
    expect(activeViewForWorkspace('account', '2d')).toBe('account');
  });

  it('makes both views available for plays and strategy', () => {
    expect(isWorkspaceModeAvailable('strategy', '2d')).toBe(true);
    expect(isWorkspaceModeAvailable('strategy', '3d')).toBe(true);
    expect(isWorkspaceModeAvailable('plays', '3d')).toBe(true);
    expect(isWorkspaceModeAvailable('playmaker', '2d')).toBe(true);
    expect(isWorkspaceModeAvailable('playmaker', '3d')).toBe(false);
    expect(isWorkspaceModeAvailable('stats', '2d')).toBe(true);
    expect(isWorkspaceModeAvailable('stats', '3d')).toBe(false);
    expect(isWorkspaceModeAvailable('profile', '2d')).toBe(true);
    expect(isWorkspaceModeAvailable('profile', '3d')).toBe(false);
    expect(isWorkspaceModeAvailable('account', '2d')).toBe(true);
    expect(isWorkspaceModeAvailable('account', '3d')).toBe(false);
  });
});
