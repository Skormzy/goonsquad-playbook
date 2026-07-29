import { describe, expect, it } from 'vitest';
import {
  selectNextRequirement,
  summarizeRequirements,
  validateRequirementsDocument,
} from './vnext-state.mjs';

const requirement = (overrides = {}) => ({
  id: 'sample',
  milestone: 'foundation',
  category: 'architecture',
  status: 'pending',
  priority: 100,
  title: 'Sample',
  dependencies: [],
  acceptance: ['Passes its gate.'],
  evidence: [],
  ...overrides,
});

describe('vNext requirement state', () => {
  it('selects in-progress work before pending work', () => {
    const document = {
      version: 1,
      activeMilestone: 'foundation',
      requirements: [
        requirement({ id: 'pending-high', priority: 1000 }),
        requirement({ id: 'active', status: 'in_progress', priority: 100 }),
      ],
    };

    expect(selectNextRequirement(document).id).toBe('active');
  });

  it('selects the highest-priority pending requirement with completed dependencies', () => {
    const document = {
      version: 1,
      activeMilestone: 'foundation',
      requirements: [
        requirement({ id: 'done', status: 'done' }),
        requirement({ id: 'blocked-by-work', priority: 1000, dependencies: ['unfinished'] }),
        requirement({ id: 'unfinished', status: 'pending', priority: 50 }),
        requirement({ id: 'ready', priority: 500, dependencies: ['done'] }),
      ],
    };

    expect(selectNextRequirement(document).id).toBe('ready');
  });

  it('reports invalid statuses and dependencies', () => {
    const document = {
      version: 1,
      activeMilestone: 'foundation',
      requirements: [requirement({ status: 'almost', dependencies: ['missing'] })],
    };

    expect(validateRequirementsDocument(document)).toEqual([
      'sample has an invalid status.',
      'sample has an unknown dependency: missing.',
    ]);
  });

  it('summarizes status counts and the next requirement', () => {
    const document = {
      version: 1,
      activeMilestone: 'foundation',
      requirements: [
        requirement({ id: 'active', status: 'in_progress' }),
        requirement({ id: 'done', status: 'done' }),
      ],
    };

    expect(summarizeRequirements(document)).toMatchObject({
      activeMilestone: 'foundation',
      counts: { pending: 0, in_progress: 1, done: 1, blocked: 0 },
      nextRequirement: { id: 'active' },
    });
  });
});
