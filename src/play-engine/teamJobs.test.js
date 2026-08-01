import { describe, expect, it } from 'vitest';
import { PLAYS } from '../data/plays';
import {
  positionsForTeamJobs,
  roleLensForPosition,
  roleMatchesLens,
  rolesForRoleLens,
  teamPlanPreview,
  teamJobsForActivePhase,
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

  it('omits the inactive player responsibility from special-teams coaching', () => {
    const penaltyKillPhase = PLAYS.find((play) => play.id === 'pkb').phases[0];
    const wingerJob = teamJobsFromPhase(penaltyKillPhase)
      .find((job) => job.id === 'wingers');

    expect(wingerJob.actions).toHaveLength(1);
    expect(wingerJob.actions[0].role).toBe('LW');
    expect(wingerJob.actions.some((action) => /penalty box/i.test(action.text))).toBe(false);
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

  it('keeps 3D role coaching synchronized with the active authored phase', () => {
    const play = PLAYS.find((entry) => entry.id === 'pomr');
    const openingJobs = teamJobsForActivePhase(play.phases, 0);
    const recoveryJobs = teamJobsForActivePhase(play.phases, 2);
    const openingWingerText = openingJobs
      .find((job) => job.id === 'wingers').actions.map((action) => action.text);
    const recoveryWingerText = recoveryJobs
      .find((job) => job.id === 'wingers').actions.map((action) => action.text);

    expect(openingWingerText).toContain(
      'F1 with secure possession. Protect the ball and scan inside.',
    );
    expect(recoveryWingerText).toContain(
      'Become the 1. Get goal-side, close inside-out, and slow the carrier.',
    );
    expect(recoveryWingerText).not.toEqual(openingWingerText);
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

  it('never presents one selected position as the full team plan', () => {
    const phase = PLAYS.find((play) => play.id === 'trap').phases[0];
    const jobs = teamJobsFromPhase(phase);
    const centerRead = jobs.find((job) => job.id === 'center').actions[0].text;
    const preview = teamPlanPreview(jobs, 'team', 'C', phase.desc);

    expect(preview.label).toBe('Team');
    expect(preview.role).toBeNull();
    expect(preview.text).not.toBe(centerRead);
    expect(preview.text).toBe(phase.desc);
  });

  it('returns the exact position read and only exposes active special-teams roles', () => {
    const trapPhase = PLAYS.find((play) => play.id === 'trap').phases[0];
    const trapJobs = teamJobsFromPhase(trapPhase);
    const rightWinger = trapJobs.find((job) => job.id === 'wingers')
      .actions.find((action) => action.role === 'RW');
    const rightWingerPreview = teamPlanPreview(trapJobs, 'wingers', 'RW');
    const penaltyKillPhase = PLAYS.find((play) => play.id === 'pkb').phases[0];

    expect(rightWingerPreview.role).toBe('RW');
    expect(rightWingerPreview.text).toBe(rightWinger.text);
    expect(positionsForTeamJobs(teamJobsFromPhase(penaltyKillPhase))).not.toContain('RW');
  });

  it('keeps both exact positions selectable when their authored reads match', () => {
    const jobs = teamJobsFromPhase({
      pos: {
        LW: { x: 25, y: 50, role: 'Seal the middle lane.' },
        RW: { x: 75, y: 50, role: 'Seal the middle lane.' },
      },
    });
    const wingerJob = jobs.find((job) => job.id === 'wingers');

    expect(wingerJob.actions.map((action) => action.role)).toEqual(['LW', 'RW']);
    expect(positionsForTeamJobs(jobs)).toEqual(['LW', 'RW']);
  });

  it('never labels an active role read as a position that left the phase', () => {
    const penaltyKillPhase = PLAYS.find((play) => play.id === 'pkb').phases[0];
    const jobs = teamJobsFromPhase(penaltyKillPhase);
    const staleRightWingerPreview = teamPlanPreview(jobs, 'wingers', 'RW');

    expect(staleRightWingerPreview.role).toBe('LW');
    expect(staleRightWingerPreview.text).toBe(
      jobs.find((job) => job.id === 'wingers').actions[0].text,
    );
  });
});
