import { describe, expect, it } from 'vitest';
import {
  getPlayScene,
  getRegisteredStrategyScenes,
  getStrategyScene,
} from '../play-engine/sceneRegistry';
import {
  matchupGapColor,
  nextTacticalTarget,
  tacticalMatchupsForReplay,
  tacticalRoutePoints,
  TACTICAL_LAYER_DEFAULTS,
  upcomingBallLayer,
} from './tacticalLayers';

describe('3D tactical layers', () => {
  it('keeps every optional layer off by default', () => {
    expect(TACTICAL_LAYER_DEFAULTS).toEqual({
      matchups: false,
      routes: false,
      passing: false,
      targets: false,
    });
  });

  it('uses only authored assignments for strategies and plays', () => {
    const strategy = getStrategyScene('watch-your-man', 'correct');
    const play = getPlayScene('brk');
    expect(tacticalMatchupsForReplay(strategy)).toHaveLength(5);
    expect(tacticalMatchupsForReplay(strategy).every(({ source }) => source === 'authored')).toBe(true);
    expect(tacticalMatchupsForReplay(play)).toEqual(play.presentation?.matchups ?? []);
  });

  it('never invents missing strategy assignments', () => {
    getRegisteredStrategyScenes().forEach((strategy) => {
      const matchups = tacticalMatchupsForReplay(strategy);
      expect(matchups).toEqual(strategy.presentation.matchups ?? []);
      expect(matchups.every(({ source }) => source === 'authored')).toBe(true);
    });
  });

  it('hands the strong-side matchup to the new pressure winger on a reversal', () => {
    const strategy = getStrategyScene('protect-the-middle', 'correct');
    const rightLock = tacticalMatchupsForReplay(
      strategy,
      strategy.sourcePhaseTimes[2] + 0.1,
    );
    const leftLock = tacticalMatchupsForReplay(
      strategy,
      strategy.sourcePhaseTimes[3] + 0.1,
    );

    expect(rightLock).toContainEqual({
      homePlayerId: 'US_RW',
      opponentPlayerId: 'OP_LW',
      source: 'authored',
    });
    expect(leftLock).toContainEqual({
      homePlayerId: 'US_LW',
      opponentPlayerId: 'OP_RD',
      source: 'authored',
    });
  });

  it('derives routes and next targets from the authoritative player tracks', () => {
    const replay = getPlayScene('brk');
    const winger = replay.players.find((player) => player.id === 'US_LW');
    const route = tacticalRoutePoints(winger);
    const target = nextTacticalTarget(winger, 3.9);
    expect(route.length).toBeGreaterThan(2);
    expect(route.every((point) => point.length === 3 && point.every(Number.isFinite))).toBe(true);
    expect(target).toMatchObject({ playerId: 'US_LW', role: 'LW' });
    expect(target.time).toBeGreaterThan(3.9);
  });

  it('exposes the upcoming authored ball movement without inventing a lane', () => {
    const replay = getPlayScene('brk');
    const layer = upcomingBallLayer(replay, 2.2);
    expect(layer).toMatchObject({ type: 'board-pass', from: 2.4, to: 4.6 });
    expect(layer.points).toHaveLength(3);
    expect(upcomingBallLayer(replay, replay.duration)).toBeNull();
  });

  it('uses readable gap colors', () => {
    expect(matchupGapColor(3)).toBe('#42df91');
    expect(matchupGapColor(6)).toBe('#f5bc58');
    expect(matchupGapColor(9)).toBe('#ff6468');
  });
});
