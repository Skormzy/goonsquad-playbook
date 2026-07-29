import { describe, expect, it } from 'vitest';
import { PLAYS } from '../data/plays';
import { TACTICS } from '../data/tactics';
import {
  getPlayScene,
  getRegisteredFaceoffOutcomeScenes,
  getRegisteredPlayScenes,
  getRegisteredStrategyScenes,
  getStrategyScene,
} from './sceneRegistry';
import { auditThreeDSceneLibrary } from './auditThreeDSceneMechanics';

describe('3D scene mechanics', () => {
  it('keeps every authored play and strategy comprehensive and mechanically coherent', () => {
    const lostFaceoffScenes = getRegisteredFaceoffOutcomeScenes()
      .filter((scene) => scene.presentation.faceoff.outcome === 'lost');
    const report = auditThreeDSceneLibrary([
      ...getRegisteredPlayScenes(),
      ...getRegisteredStrategyScenes(),
      ...lostFaceoffScenes,
    ]);

    expect(report.sceneCount).toBe(PLAYS.length + TACTICS.length * 2 + lostFaceoffScenes.length);
    expect(report.errors, report.errors.join('\n')).toEqual([]);
    expect(report.valid).toBe(true);
  });

  it('turns the penalty-kill box and clear into complete teaching sequences', () => {
    const box = getPlayScene('pkb');
    const clear = getPlayScene('pkcl');

    expect(box.sourcePhaseTimes).toHaveLength(3);
    expect(box.events.map((event) => event.label)).toEqual([
      'Box Set Behind the Ball',
      'Box Slides to the Left Wall',
      'Box Recovers Across the Middle',
    ]);
    expect(clear.sourcePhaseTimes).toHaveLength(2);
    expect(clear.ball.segments.some((segment) => (
      segment.fromPlayerId === 'US_LD' && segment.toPlayerId === 'US_LW'
    ))).toBe(true);
  });

  it('preserves authored strategy action order and ownership', () => {
    const backcheckMistake = getStrategyScene('instant-backcheck', 'mistake');
    const actionTypes = backcheckMistake.ball.segments
      .filter((segment) => ['pass', 'board-pass', 'shot'].includes(segment.type))
      .map((segment) => segment.type);

    expect(actionTypes.slice(-2)).toEqual(['pass', 'shot']);
  });
});
