import { describe, expect, it } from 'vitest';
import { getPlayScene } from './sceneRegistry';
import { samplePlayScene } from './samplePlayScene';
import { standardBreakoutTacticalSpacing } from './tacticalSpacing';

const replay = getPlayScene('brk');

describe('Standard Breakout tactical spacing', () => {
  it.each([
    [1.2, 'retrieval'],
    [3.72, 'board-release'],
    [5.8, 'wall-advance'],
    [7.8, 'controlled-entry'],
    [8.65, 'entry-settle'],
  ])('passes the %s second %s read', (time, phase) => {
    const spacing = standardBreakoutTacticalSpacing(samplePlayScene(replay, time));

    expect(spacing.phase).toBe(phase);
    expect(spacing.status).toBe('pass');
    expect(Object.values(spacing.metrics).every(Number.isFinite)).toBe(true);
  });

  it('rejects an entry that collapses weak-side width', () => {
    const frame = structuredClone(samplePlayScene(replay, 7.8));
    const carrier = frame.players.find((player) => player.id === 'US_LW');
    const weakSide = frame.players.find((player) => player.id === 'US_RW');
    weakSide.position.x = carrier.position.x + 5;

    expect(standardBreakoutTacticalSpacing(frame)).toMatchObject({
      phase: 'controlled-entry',
      status: 'fail',
    });
  });

  it('rejects a wall advance that abandons middle support', () => {
    const frame = structuredClone(samplePlayScene(replay, 5.8));
    const center = frame.players.find((player) => player.id === 'US_C');
    center.position.x = 8;

    expect(standardBreakoutTacticalSpacing(frame)).toMatchObject({
      phase: 'wall-advance',
      status: 'fail',
    });
  });

  it('rejects a settled entry before both support lanes arrive', () => {
    const frame = structuredClone(samplePlayScene(replay, 8.65));
    const center = frame.players.find((player) => player.id === 'US_C');
    center.position.y = 61;

    expect(standardBreakoutTacticalSpacing(frame)).toMatchObject({
      phase: 'entry-settle',
      status: 'fail',
    });
  });
});
