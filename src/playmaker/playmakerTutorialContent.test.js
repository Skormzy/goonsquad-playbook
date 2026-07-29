import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PLAYMAKER_TUTORIAL_STEPS,
  PLAYMAKER_TUTORIAL_STORAGE_KEY,
} from './playmakerTutorialContent';

const workspaceSource = readFileSync(new URL('./PlaymakerWorkspace.jsx', import.meta.url), 'utf8');
const tutorialSource = readFileSync(new URL('./PlaymakerTutorial.jsx', import.meta.url), 'utf8');

describe('Create guided tutorial contract', () => {
  it('walks through the complete authoring workflow in a stable order', () => {
    expect(PLAYMAKER_TUTORIAL_STEPS.map((step) => step.id)).toEqual([
      'welcome',
      'identity',
      'shape',
      'moment',
      'player',
      'ball',
      'timeline',
      'preview',
      'readiness',
      'save',
    ]);
    expect(PLAYMAKER_TUTORIAL_STORAGE_KEY).toMatch(/_v1$/u);
  });

  it('targets real, unique controls in the Create workspace', () => {
    const targets = PLAYMAKER_TUTORIAL_STEPS.map((step) => step.target);
    expect(new Set(targets).size).toBe(targets.length);
    targets.forEach((target) => {
      const tutorialId = target.match(/data-tutorial="([^"]+)"/u)?.[1];
      expect(tutorialId).toBeTruthy();
      expect(workspaceSource).toContain(`data-tutorial="${tutorialId}"`);
    });
  });

  it('teaches exact receiver identity and remains restartable and keyboard accessible', () => {
    const ballStep = PLAYMAKER_TUTORIAL_STEPS.find((step) => step.id === 'ball');
    expect(`${ballStep.body} ${ballStep.detail}`).toContain('exact receiver');
    expect(`${ballStep.body} ${ballStep.detail}`).toContain('all 3D cameras');
    expect(tutorialSource).toContain("event.key === 'Escape'");
    expect(tutorialSource).toContain("event.key === 'ArrowRight'");
    expect(tutorialSource).toContain('setStepIndex(0)');
    expect(JSON.stringify(PLAYMAKER_TUTORIAL_STEPS).toLowerCase()).not.toContain(['ska', 'te'].join(''));
  });
});
