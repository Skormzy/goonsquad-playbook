import { describe, expect, it } from 'vitest';
import { getJerseyNumber, getUniformIdentityColors } from './uniformIdentity';

describe('uniform identity helpers', () => {
  it('assigns stable jersey numbers by role', () => {
    expect(getJerseyNumber({ role: 'LD', team: 'us' })).toBe('4');
    expect(getJerseyNumber({ role: 'C', team: 'us' })).toBe('91');
    expect(getJerseyNumber({ role: 'F', team: 'opponent' })).toBe('16');
  });

  it('uses team accent colors for readable production-asset details', () => {
    expect(getUniformIdentityColors({
      team: 'us',
      uniform: { stripe: '#1d4ed8' },
    })).toMatchObject({
      accent: '#1d4ed8',
      number: '#1d4ed8',
      crest: '#0f172a',
    });

    expect(getUniformIdentityColors({
      team: 'opponent',
      uniform: { stripe: '#fee2e2' },
    })).toMatchObject({
      accent: '#fee2e2',
      number: '#fee2e2',
      outline: '#7f1d1d',
    });
  });
});
