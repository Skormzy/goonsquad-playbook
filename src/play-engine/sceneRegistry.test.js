import { describe, expect, it } from 'vitest';
import { PLAYS } from '../data/plays';
import { TACTICS } from '../data/tactics';
import {
  getPlayScene,
  getRegisteredFaceoffOutcomeScenes,
  getRegisteredPlayScenes,
  getRegisteredStrategyScenes,
  getStrategyScene,
  hasPlayScene,
  hasStrategyScene,
} from './sceneRegistry';
import { validatePlayScene } from './validatePlayScene';

describe('play scene registry', () => {
  it('maps Standard Breakout to its canonical scene', () => {
    expect(hasPlayScene('brk')).toBe(true);
    expect(getPlayScene('brk')).toMatchObject({
      sourcePlayId: 'brk',
      id: 'standard-breakout-3d',
    });
  });

  it('gives every authored play its own linked 3D scene', () => {
    expect(getRegisteredPlayScenes()).toHaveLength(PLAYS.length);
    PLAYS.forEach((play) => {
      const scene = getPlayScene(play.id);
      expect(hasPlayScene(play.id)).toBe(true);
      expect(scene?.sourcePlayId).toBe(play.id);
      expect(validatePlayScene(scene), play.id).toMatchObject({ valid: true, playerCount: 12 });
    });
  });

  it('registers deterministic won and lost scenes for every faceoff', () => {
    const faceoffs = PLAYS.filter((play) => play.faceoff);
    expect(getRegisteredFaceoffOutcomeScenes()).toHaveLength(faceoffs.length * 2);

    faceoffs.forEach((play) => {
      const won = getPlayScene(play.id, 'won');
      const lost = getPlayScene(play.id, 'lost');
      expect(won.presentation.faceoff.outcome).toBe('won');
      expect(lost.presentation.faceoff.outcome).toBe('lost');
      expect(won.ball.segments.find((segment) => segment.type === 'faceoff')?.toPlayerId)
        .toBe(play.faceoff.drawTarget);
      expect(lost.ball.segments.find((segment) => segment.type === 'faceoff')?.toPlayerId)
        .toBe(play.faceoff.lostDrawTarget);
      expect(validatePlayScene(lost), `${play.id}:lost`).toMatchObject({ valid: true, playerCount: 12 });
    });
  });

  it('keeps special-teams rosters complete while placing one penalized athlete off the floor', () => {
    const cases = [
      { id: 'ppum', team: 'opponent' },
      { id: 'ppfo', team: 'opponent' },
      { id: 'pkb', team: 'us' },
      { id: 'pkfo', team: 'us' },
      { id: 'pkcl', team: 'us' },
    ];

    cases.forEach(({ id, team }) => {
      const scene = getPlayScene(id);
      const boxed = scene.players.filter((player) => player.status === 'penalty-box');
      expect(scene.players, id).toHaveLength(12);
      expect(scene.players.filter((player) => player.active), id).toHaveLength(11);
      expect(boxed, id).toHaveLength(1);
      expect(boxed[0], id).toMatchObject({
        active: false,
        label: 'PEN',
        team,
      });
    });

    for (const id of ['ppfo', 'pkfo']) {
      const won = getPlayScene(id, 'won');
      const lost = getPlayScene(id, 'lost');
      expect(won.players.filter((player) => player.status === 'penalty-box')).toHaveLength(1);
      expect(lost.players.filter((player) => player.status === 'penalty-box')).toHaveLength(1);
    }
  });

  it('gives every strategy a mistake and right-way 3D scene', () => {
    expect(getRegisteredStrategyScenes()).toHaveLength(TACTICS.length * 2);
    TACTICS.forEach((tactic) => {
      for (const variant of ['mistake', 'correct']) {
        const scene = getStrategyScene(tactic.id, variant);
        expect(hasStrategyScene(tactic.id, variant)).toBe(true);
        expect(scene).toMatchObject({
          sourceTacticId: tactic.id,
          strategyVariant: variant,
        });
        expect(validatePlayScene(scene), `${tactic.id}:${variant}`).toMatchObject({ valid: true, playerCount: 12 });
      }
    });
  });

  it('returns no scene for unknown content', () => {
    expect(getPlayScene('not-a-play')).toBeNull();
    expect(getStrategyScene('not-a-strategy')).toBeNull();
  });
});
