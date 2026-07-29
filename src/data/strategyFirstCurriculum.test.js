import { describe, expect, it } from 'vitest';
import { getPlayScene, getStrategyScene } from '../play-engine/sceneRegistry';
import { validatePlayScene } from '../play-engine/validatePlayScene';
import { PLAYS } from './plays';
import { TACTICS } from './tactics';

const HOME_ROLES = ['LW', 'C', 'RW', 'LD', 'RD', 'G'];

function expectTwelveMovingPlayers(phases, homeKey = 'pos') {
  phases.forEach((phase) => {
    expect(Object.keys(phase[homeKey])).toEqual(expect.arrayContaining(HOME_ROLES));
    expect(phase.opp).toHaveLength(6);
  });

  for (let index = 1; index < phases.length; index += 1) {
    const previous = phases[index - 1];
    const current = phases[index];
    HOME_ROLES.forEach((role) => {
      expect(
        [current[homeKey][role].x, current[homeKey][role].y],
        `${role} must visibly adjust in phase ${index + 1}`,
      ).not.toEqual([previous[homeKey][role].x, previous[homeKey][role].y]);
    });
    current.opp.forEach((player) => {
      const prior = previous.opp.find((candidate) => candidate.id === player.id);
      expect(
        [player.x, player.y],
        `${player.id} must visibly adjust in phase ${index + 1}`,
      ).not.toEqual([prior.x, prior.y]);
    });
  }
}

describe('strategy-first team curriculum', () => {
  it('models the coach 1-2-2 with a strong-side pressure handoff', () => {
    const play = PLAYS.find((candidate) => candidate.id === 'trap');

    expect(play.phases).toHaveLength(5);
    expect(play.phases.map((phase) => phase.ballOwner)).toEqual([
      'o5',
      'o5',
      'o3',
      'o4',
      'LW',
    ]);
    expect(play.phases[1].pos.RW.y).toBeGreaterThan(play.phases[1].pos.C.y);
    expect(play.phases[3].pos.LW.y).toBeGreaterThan(play.phases[3].pos.C.y);
    expect(play.phases[3].ballPath).toHaveLength(4);
    expectTwelveMovingPlayers(play.phases);

    const scene = getPlayScene('trap');
    expect(validatePlayScene(scene)).toMatchObject({ valid: true, playerCount: 12 });
    expect(scene.sourcePhaseTimes).toHaveLength(5);
    expect(scene.ball.segments.some((segment) => (
      segment.fromPlayerId === 'OP_RD' && segment.toPlayerId === 'OP_RW'
    ))).toBe(true);
    expect(scene.ball.segments.at(-1).ownerId).toBe('US_LW');
  });

  it('turns an abandoned slot into one clear pass and an immediate shot', () => {
    const play = PLAYS.find((candidate) => candidate.id === 'slot-window');

    expect(play.phases).toHaveLength(4);
    expect(play.phases.map((phase) => phase.ballOwner)).toEqual(['LW', 'LW', 'C', null]);
    expect(play.phases[2].ballPath.at(-1)).toEqual(play.phases[2].ball);
    expectTwelveMovingPlayers(play.phases);

    const scene = getPlayScene('slot-window');
    expect(validatePlayScene(scene)).toMatchObject({ valid: true, playerCount: 12 });
    expect(scene.ball.segments.some((segment) => (
      segment.type === 'pass'
      && segment.fromPlayerId === 'US_LW'
      && segment.toPlayerId === 'US_C'
    ))).toBe(true);
    expect(scene.ball.segments.some((segment) => (
      segment.type === 'shot' && segment.fromPlayerId === 'US_C'
    ))).toBe(true);
  });

  it('teaches the same initial read through mistake and correct strategy scenes', () => {
    const tactic = TACTICS.find((candidate) => candidate.id === 'protect-the-middle');

    expect(tactic.correctScene.phases[0]).toEqual(tactic.mistakeScene.phases[0]);
    expectTwelveMovingPlayers(tactic.correctScene.phases, 'our');
    expectTwelveMovingPlayers(tactic.mistakeScene.phases, 'our');
    expect(validatePlayScene(getStrategyScene(tactic.id, 'correct')))
      .toMatchObject({ valid: true, playerCount: 12 });
    expect(validatePlayScene(getStrategyScene(tactic.id, 'mistake')))
      .toMatchObject({ valid: true, playerCount: 12 });
  });
});
