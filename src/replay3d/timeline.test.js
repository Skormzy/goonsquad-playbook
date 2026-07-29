import { describe, expect, it } from 'vitest';
import {
  BALL_RECEIVE_CONTACT_SECONDS,
  BALL_RELEASE_CONTACT_SECONDS,
} from '../play-engine/ballContactTiming';
import { standardBreakout3dReplay } from './data/standardBreakout3d';
import { sampleReplayAt } from './timeline';

describe('sampleReplayAt', () => {
  it('interpolates every player and the ball at a specific replay time', () => {
    const frame = sampleReplayAt(standardBreakout3dReplay, 3.8);

    expect(frame.players).toHaveLength(12);
    expect(frame.players.find((player) => player.id === 'US_LD').position.x).toBeGreaterThan(12);
    expect(frame.players.find((player) => player.id === 'US_C').speedMps).toBeGreaterThan(0);
    expect(frame.ball.position.x).toBeGreaterThanOrEqual(4);
    expect(frame.ball.position.x).toBeLessThan(22);
    expect(frame.event?.label).toContain('boards');
  });

  it('returns settled end-state positions after the replay has finished', () => {
    const frame = sampleReplayAt(standardBreakout3dReplay, 99);
    const rightWing = frame.players.find((player) => player.id === 'US_RW');

    expect(frame.time).toBe(standardBreakout3dReplay.duration);
    expect(rightWing.position.y).toBeGreaterThan(58);
    expect(frame.ball.ownerId).toBe('US_LW');
  });

  it('marks ball carriers with stick-handle action metadata', () => {
    const frame = sampleReplayAt(standardBreakout3dReplay, 1.2);
    const leftDefense = frame.players.find((player) => player.id === 'US_LD');

    expect(leftDefense.action).toBe('stick-handle');
    expect(leftDefense.actionIntensity).toBeGreaterThan(0.65);
    expect(frame.ball.stickTargetPlayerId).toBe('US_LD');
    expect(frame.ball.stickContact).toBe('carry');
    expect(frame.ball.stickContactWeight).toBe(1);
    expect(Math.hypot(
      frame.ball.position.x - leftDefense.position.x,
      frame.ball.position.y - leftDefense.position.y,
    )).toBeLessThan(2.2);
  });

  it('marks the passer and receiver during a board breakout pass', () => {
    const releaseFrame = sampleReplayAt(standardBreakout3dReplay, 2.5);
    const receiveFrame = sampleReplayAt(standardBreakout3dReplay, 4.15);

    expect(releaseFrame.ball.segmentType).toBe('board-pass');
    expect(releaseFrame.ball.fromPlayerId).toBe('US_LD');
    expect(releaseFrame.ball.toPlayerId).toBe('US_LW');
    expect(releaseFrame.ball.stickContact).toBe('release');
    expect(releaseFrame.ball.stickContactWeight).toBeGreaterThan(0);
    expect(releaseFrame.ball.trajectoryPosition).toBeTruthy();
    expect(releaseFrame.players.find((player) => player.id === 'US_LD').action).toBe('forehand-pass');
    expect(receiveFrame.players.find((player) => player.id === 'US_LW').action).toBe('receive-pass');
  });

  it('uses short real-time release and reception contact windows', () => {
    const freeFlightFrame = sampleReplayAt(standardBreakout3dReplay, 2.62);
    const beforeReceptionFrame = sampleReplayAt(standardBreakout3dReplay, 4.3);
    const receptionFrame = sampleReplayAt(standardBreakout3dReplay, 4.45);

    expect(freeFlightFrame.ball.stickContact).toBeUndefined();
    expect(freeFlightFrame.ball.stickContactWeight).toBe(0);
    expect(beforeReceptionFrame.ball.stickContact).toBeUndefined();
    expect(beforeReceptionFrame.ball.stickContactWeight).toBe(0);
    expect(receptionFrame.ball.stickContact).toBe('receive');
    expect(receptionFrame.ball.stickContactWeight).toBeGreaterThan(0);
  });

  it('keeps the wall carrier in control through the blue line', () => {
    const supportFrame = sampleReplayAt(standardBreakout3dReplay, 5.9);
    const entryFrame = sampleReplayAt(standardBreakout3dReplay, 8.2);
    const settledFrame = sampleReplayAt(standardBreakout3dReplay, 8.65);

    expect(supportFrame.ball.segmentType).toBe('carry');
    expect(supportFrame.ball.ownerId).toBe('US_LW');
    expect(supportFrame.players.find((player) => player.id === 'US_LW').action).toBe('stick-handle');
    expect(entryFrame.ball.ownerId).toBe('US_LW');
    expect(entryFrame.players.find((player) => player.id === 'US_RW').action).not.toBe('receive-pass');
    expect(entryFrame.players.find((player) => player.id === 'US_C').position.y).toBeGreaterThan(55);
    expect(settledFrame.ball.ownerId).toBe('US_LW');
    expect(settledFrame.players.find((player) => player.id === 'US_C').position.y).toBeGreaterThanOrEqual(64);
    expect(settledFrame.players.find((player) => player.id === 'US_RW').position.y).toBeGreaterThanOrEqual(64);
    expect(settledFrame.event.nextRead).toBe('Hold the wall; let both support lanes arrive');
  });

  it('keeps close-camera stick contacts inside a compact blade-pocket envelope', () => {
    for (const time of [1.2, 2.46, 4.45, 4.75, 5.9, 6.55]) {
      const frame = sampleReplayAt(standardBreakout3dReplay, time);
      const target = frame.players.find((player) => player.id === frame.ball.stickTargetPlayerId);

      expect(frame.ball.stickContact, `expected stick contact at ${time}s`).toBeTruthy();
      expect(target, `expected a stick target at ${time}s`).toBeTruthy();

      const contactDistance = Math.hypot(
        frame.ball.position.x - target.position.x,
        frame.ball.position.y - target.position.y,
      );

      expect(contactDistance, `wide ball pocket at ${time}s`).toBeLessThanOrEqual(1.22);
    }
  });

  it('keeps ball position continuous at release and receive contact boundaries', () => {
    const contactBoundaryTimes = [
      2.4 + BALL_RELEASE_CONTACT_SECONDS,
      4.6 - BALL_RECEIVE_CONTACT_SECONDS,
    ];

    for (const boundary of contactBoundaryTimes) {
      const before = sampleReplayAt(standardBreakout3dReplay, boundary - 0.001).ball.position;
      const after = sampleReplayAt(standardBreakout3dReplay, boundary + 0.001).ball.position;
      const jump = Math.hypot(after.x - before.x, after.y - before.y);

      expect(jump, `ball jumped at ${boundary.toFixed(3)}s`).toBeLessThan(0.25);
    }
  });

  it('keeps route velocity continuous around authored player keyframes', () => {
    const before = sampleReplayAt(standardBreakout3dReplay, 3.8 - 0.01);
    const at = sampleReplayAt(standardBreakout3dReplay, 3.8);
    const after = sampleReplayAt(standardBreakout3dReplay, 3.8 + 0.01);
    const player = (frame) => frame.players.find(({ id }) => id === 'US_C').position;
    const incoming = { x: player(at).x - player(before).x, y: player(at).y - player(before).y };
    const outgoing = { x: player(after).x - player(at).x, y: player(after).y - player(at).y };
    const turn = Math.abs(Math.atan2(outgoing.y, outgoing.x) - Math.atan2(incoming.y, incoming.x));

    expect(turn).toBeLessThan(0.35);
  });
});
