import { describe, expect, it } from 'vitest';
import {
  buildAutopilotPrompt,
  buildStatusSummary,
  selectNextRequirement,
} from './goonsquad-autopilot-compiler.mjs';

function checklist(requirements) {
  return {
    goal: 'Raise replay quality.',
    policy: {
      runtimeCapMinutes: 25,
    },
    requirements,
  };
}

describe('goonsquad autopilot compiler', () => {
  it('selects the highest-priority unfinished requirement', () => {
    const selected = selectNextRequirement(checklist([
      { id: 'surface-markings', status: 'todo', priority: 700 },
      { id: 'player-realism', status: 'in_progress', priority: 1000 },
      { id: 'completed-scale', status: 'done', priority: 1200 },
    ]));

    expect(selected.id).toBe('player-realism');
  });

  it('ignores completed requirements', () => {
    const selected = selectNextRequirement(checklist([
      { id: 'done-high', status: 'done', priority: 1000 },
      { id: 'open-low', status: 'todo', priority: 100 },
    ]));

    expect(selected.id).toBe('open-low');
  });

  it('skips blocked requirements so their unblockers can run next', () => {
    const selected = selectNextRequirement(checklist([
      { id: 'visual-goal', status: 'blocked', priority: 1000, blockedBy: ['asset-pipeline'] },
      { id: 'asset-pipeline', status: 'todo', priority: 990 },
    ]));

    expect(selected.id).toBe('asset-pipeline');
  });

  it('builds a prompt with verification and checklist updates', () => {
    const selected = {
      id: 'runner-assets',
      title: 'Build accepted runner GLBs',
      category: 'assets',
      status: 'todo',
      priority: 990,
      why: 'Athlete realism needs production assets.',
      acceptance: ['Passes runner acceptance checks.'],
      verification: ['npm run asset:player:validate:production -- --runners-only'],
      files: ['src/replay3d/assets/playerRigSelection.js'],
    };

    const prompt = buildAutopilotPrompt(checklist([selected]), selected);

    expect(prompt).toContain('runner-assets');
    expect(prompt).toContain('npm run check:terms');
    expect(prompt).toContain('npm run build');
    expect(prompt).toContain('Update docs/3d-quality/autopilot-requirements.json');
  });

  it('holds the quality loop to a state-of-the-art realism bar', () => {
    const selected = {
      id: 'player-closeup',
      title: 'Close player quality',
      category: 'players',
      status: 'in_progress',
      priority: 1000,
      why: 'Close cameras reveal the real player quality.',
      acceptance: ['Close player screenshots improve.'],
      verification: ['npm test -- src/components/replay3d/ReplayPlayer.test.jsx'],
      files: ['src/components/replay3d/ReplayPlayer.jsx'],
    };

    const prompt = buildAutopilotPrompt(checklist([selected]), selected);

    expect(prompt).toContain('state-of-the-art 3D ball hockey playbook');
    expect(prompt).toContain('Do not mark a requirement done just because one pass improved it');
    expect(prompt).toContain('score remains below the target quality bar');
  });

  it('summarizes checklist status counts', () => {
    expect(buildStatusSummary(checklist([
      { id: 'a', status: 'todo' },
      { id: 'b', status: 'todo' },
      { id: 'c', status: 'done' },
    ]))).toEqual({ todo: 2, done: 1 });
  });
});
