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

  it('uses authored strategy assignments and stable play fallbacks', () => {
    const strategy = getStrategyScene('watch-your-man', 'correct');
    const play = getPlayScene('brk');
    expect(tacticalMatchupsForReplay(strategy)).toHaveLength(5);
    expect(tacticalMatchupsForReplay(strategy).every(({ source }) => source === 'authored')).toBe(true);
    expect(tacticalMatchupsForReplay(play)).toHaveLength(5);
    expect(tacticalMatchupsForReplay(play).every(({ source }) => source === 'role-fallback')).toBe(true);
  });

  it('fills every partial strategy assignment without replacing authored matchups', () => {
    getRegisteredStrategyScenes().forEach((strategy) => {
      const matchups = tacticalMatchupsForReplay(strategy);
      expect(matchups).toHaveLength(5);
      expect(new Set(matchups.map(({ homePlayerId }) => homePlayerId)).size).toBe(5);
      (strategy.presentation.matchups ?? []).forEach((authored) => {
        expect(matchups).toContainEqual(authored);
      });
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
