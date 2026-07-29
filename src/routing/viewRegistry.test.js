import { describe, expect, it } from 'vitest';
import {
  createViewRegistry,
  INTERNAL_VIEW_IDS,
  PUBLIC_VIEW_IDS,
  resolveInitialView,
} from './viewRegistry';

describe('view registry', () => {
  it('keeps internal tools outside the public registry', () => {
    expect(PUBLIC_VIEW_IDS).toEqual(['playbook', 'tactics', 'replay3d', 'strategy3d', 'playmaker', 'stats', 'profile', 'account']);
    expect(INTERNAL_VIEW_IDS).toEqual(['rigreview']);
    expect(createViewRegistry().has('rigreview')).toBe(false);
  });

  it('makes rig review available to local development only', () => {
    expect(createViewRegistry({ includeInternal: true }).has('rigreview')).toBe(true);
    expect(resolveInitialView('http://localhost/?view=rigreview')).toBe('stats');
    expect(resolveInitialView('http://localhost/?view=rigreview', { includeInternal: true })).toBe('rigreview');
  });

  it('preserves every public view in all environments', () => {
    for (const view of PUBLIC_VIEW_IDS) {
      expect(resolveInitialView(`http://localhost/?view=${view}`)).toBe(view);
    }
  });

  it('resolves canonical content and viewing mode parameters', () => {
    expect(resolveInitialView('http://localhost/?content=plays&mode=2d')).toBe('playbook');
    expect(resolveInitialView('http://localhost/?content=plays&mode=3d')).toBe('replay3d');
    expect(resolveInitialView('http://localhost/?content=strategy&mode=2d')).toBe('tactics');
    expect(resolveInitialView('http://localhost/?content=strategy&mode=3d')).toBe('strategy3d');
    expect(resolveInitialView('http://localhost/?content=playmaker')).toBe('playmaker');
    expect(resolveInitialView('http://localhost/?content=stats')).toBe('stats');
    expect(resolveInitialView('http://localhost/?content=profile')).toBe('profile');
    expect(resolveInitialView('http://localhost/?content=account')).toBe('account');
  });

  it('opens the team statistics home from the bare product URL', () => {
    expect(resolveInitialView('http://localhost/')).toBe('stats');
    expect(resolveInitialView('http://localhost/?unknown=1')).toBe('stats');
  });
});
