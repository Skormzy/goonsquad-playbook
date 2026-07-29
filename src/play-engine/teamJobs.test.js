import { describe, expect, it } from 'vitest';
import { PLAYS } from '../data/plays';
import {
  roleLensForPosition,
  roleMatchesLens,
  rolesForRoleLens,
  teamJobsFromPhase,
  teamJobsFromPresentation,
} from './teamJobs';

describe('team jobs', () => {
  it('groups authored player responsibilities into tactical role lenses', () => {
    const phase = PLAYS.find((play) => play.id === 'brk').phases[0];
    const jobs = teamJobsFromPhase(phase);

    expect(jobs.map((job) => job.id)).toEqual(['wingers', 'center', 'defense']);
    expect(jobs.find((job) => job.id === 'wingers').roles).toEqual(['LW', 'RW']);
    expect(jobs.find((job) => job.id === 'defense').actions).toHaveLength(2);
  });

  it('omits a generic goalie job but preserves a tactically specific goalie job', () => {
    const ordinaryPhase = PLAYS.find((play) => play.id === 'brk').phases[0];
    const twoOnOnePhase = PLAYS.find((play) => play.id === 'd21').phases[0];

    expect(teamJobsFromPhase(ordinaryPhase).some((job) => job.id === 'goalie')).toBe(false);
    expect(teamJobsFromPhase(twoOnOnePhase).some((job) => job.id === 'goalie')).toBe(true);
  });

  it('normalizes concise 3D presentation responsibilities into the same contract', () => {
    const jobs = teamJobsFromPresentation([
      { role: 'Defense', action: 'Draw pressure and bank the ball wide.' },
      { role: 'Winger', action: 'Receive on the wall and carry wide.' },
      { role: 'Center', action: 'Stay underneath as middle support.' },
    ]);

    expect(jobs.map((job) => job.id)).toEqual(['wingers', 'center', 'defense']);
    expect(jobs.find((job) => job.id === 'wingers').actions[0].text)
      .toBe('Receive on the wall and carry wide.');
  });

  it('exposes grouped role membership without turning team view into a selection', () => {
    expect(rolesForRoleLens('team')).toEqual([]);
    expect(roleMatchesLens('LW', 'wingers')).toBe(true);
    expect(roleMatchesLens('RD', 'defense')).toBe(true);
    expect(roleMatchesLens('C', 'wingers')).toBe(false);
    expect(roleLensForPosition('RW')).toBe('wingers');
    expect(roleLensForPosition('LD')).toBe('defense');
    expect(roleLensForPosition('G')).toBe('goalie');
  });
});
