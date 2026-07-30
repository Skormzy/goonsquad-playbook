import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  PLAYMAKER_TUTORIAL_STEPS,
  PLAYMAKER_TUTORIAL_STORAGE_KEY,
} from './playmakerTutorialContent';

const workspaceSource = readFileSync(new URL('./PlaymakerWorkspace.jsx', import.meta.url), 'utf8');
const tutorialSource = readFileSync(new URL('./PlaymakerTutorial.jsx', import.meta.url), 'utf8');
const dialogFocusSource = readFileSync(new URL('../hooks/useDialogFocus.js', import.meta.url), 'utf8');

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

  it('teaches exact receiver identity across the authored 2D and 3D views without promising universal device behavior', () => {
    const ballStep = PLAYMAKER_TUTORIAL_STEPS.find((step) => step.id === 'ball');
    expect(`${ballStep.body} ${ballStep.detail}`).toContain('exact receiver');
    expect(`${ballStep.body} ${ballStep.detail}`).toContain('2D line');
    expect(`${ballStep.body} ${ballStep.detail}`).toContain('destination possession');
    expect(`${ballStep.body} ${ballStep.detail}`).toContain('all 3D cameras');
    const tutorialCopy = JSON.stringify(PLAYMAKER_TUTORIAL_STEPS);
    expect(tutorialCopy).not.toContain('every camera');
    expect(tutorialCopy).not.toContain('every device');
    expect(tutorialCopy).not.toContain('never reinterpret');
    expect(tutorialCopy).toContain('does not replace a teammate or coach');
  });

  it('remains restartable and keyboard accessible', () => {
    expect(tutorialSource).toContain('onClose: closeTutorial');
    expect(dialogFocusSource).toContain("event.key === 'Escape'");
    expect(tutorialSource).toContain("event.key === 'ArrowRight'");
    expect(tutorialSource).toContain('setStepIndex(0)');
    expect(JSON.stringify(PLAYMAKER_TUTORIAL_STEPS).toLowerCase()).not.toContain(['ska', 'te'].join(''));
  });
});
