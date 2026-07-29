import { describe, expect, it } from 'vitest';
import { samplePlayScene } from '../play-engine/samplePlayScene';
import { sampleTacticalReplay } from '../tactical3d/sampleTacticalReplay';
import { compilePlaymakerScene, playmakerReadiness } from './compilePlaymakerScene';
import {
  createPlaymakerDraft,
  normalizePlaymakerDraft,
  PLAYMAKER_ROSTER,
} from './playmakerModel';

function movingDraft() {
  const draft = createPlaymakerDraft('breakout');
  PLAYMAKER_ROSTER.forEach((player, index) => {
    const destination = draft.frames[1].players[player.id];
    destination.x = Math.min(98, destination.x + 1 + (index % 2) * 0.25);
    destination.y = Math.min(98, destination.y + 1);
    destination.action = player.role === 'G' ? 'support' : 'run';
  });
  return draft;
}

describe('playmaker scene compiler', () => {
  it('compiles authored moments into a validated 12-player shared scene', () => {
    const draft = movingDraft();
    const readiness = playmakerReadiness(draft);

    expect(readiness.valid, readiness.report.errors.join('\n')).toBe(true);
    expect(readiness.playerCount).toBe(12);
    expect(readiness.movingCount).toBe(12);
    expect(readiness.scene.rink).toMatchObject({ orientation: 'vertical', ourNet: 'bottom' });
    expect(readiness.scene.presentation).toMatchObject({
      captionsPlacement: 'below-rink',
      coachingOverlaysDefault: false,
      audio: false,
    });
    readiness.scene.players.forEach((player) => {
      expect(player.keyframes[0].time).toBe(0);
      expect(player.keyframes.at(-1).time).toBe(readiness.scene.duration);
    });
  });

  it('turns an owner change into a direct pass with authoritative endpoints', () => {
    const draft = movingDraft();
    draft.frames[1].ball.transition = 'pass';
    draft.frames[1].ball.ownerId = 'US_RW';
    draft.frames[1].ball.receiverId = 'US_RW';
    const scene = compilePlaymakerScene(draft);
    const [segment] = scene.ball.segments;

    expect(segment).toMatchObject({
      type: 'pass',
      fromPlayerId: 'US_C',
      toPlayerId: 'US_RW',
      from: 0,
      to: scene.duration,
    });
    expect(segment.start).toEqual({
      x: draft.frames[0].players.US_C.x,
      y: draft.frames[0].players.US_C.y,
    });
    expect(segment.end).toEqual({
      x: draft.frames[1].players.US_RW.x,
      y: draft.frames[1].players.US_RW.y,
    });
  });

  it.each(['pass', 'board-pass'])('preserves every authored teammate receiver through %s compilation and 3D sampling', (transition) => {
    PLAYMAKER_ROSTER.forEach((source) => {
      const teammates = PLAYMAKER_ROSTER.filter((player) => (
        player.team === source.team && player.id !== source.id
      ));

      teammates.forEach((receiver) => {
        const draft = movingDraft();
        draft.frames[0].ball.ownerId = source.id;
        draft.frames[1].ball.transition = transition;
        draft.frames[1].ball.receiverId = receiver.id;
        draft.frames[1].ball.ownerId = receiver.id;
        const scene = compilePlaymakerScene(draft);
        const [segment] = scene.ball.segments;
        const sampled = sampleTacticalReplay(scene, scene.duration - 0.01);

        expect(segment.fromPlayerId, `${source.id} should remain the passer`).toBe(source.id);
        expect(segment.toPlayerId, `${receiver.id} should remain the receiver`).toBe(receiver.id);
        expect(segment.type).toBe(transition);
        expect(sampled.ball.fromPlayerId).toBe(source.id);
        expect(sampled.ball.toPlayerId).toBe(receiver.id);
      });
    });
  });

  it('uses the explicit receiver when legacy possession and receiver fields disagree', () => {
    const draft = movingDraft();
    draft.frames[1].ball.transition = 'pass';
    draft.frames[1].ball.receiverId = 'US_RW';
    draft.frames[1].ball.ownerId = 'US_LW';

    const normalized = normalizePlaymakerDraft(draft);
    const scene = compilePlaymakerScene(draft);

    expect(normalized.frames[1].ball).toMatchObject({
      ownerId: 'US_RW',
      receiverId: 'US_RW',
    });
    expect(scene.ball.segments[0].toPlayerId).toBe('US_RW');
  });

  it('fails closed when a pass does not name a valid teammate', () => {
    const draft = movingDraft();
    draft.frames[1].ball.transition = 'pass';
    draft.frames[1].ball.receiverId = 'OP_RW';
    draft.frames[1].ball.ownerId = 'OP_RW';
    const readiness = playmakerReadiness(draft);

    expect(readiness.valid).toBe(false);
    expect(readiness.ballValid).toBe(false);
    expect(readiness.report.errors).toContain('Ball decision into moment 2 needs an explicit receiver.');
    expect(readiness.scene.ball.segments[0].type).toBe('loose');
    expect(readiness.scene.ball.segments[0].toPlayerId).toBeUndefined();
  });

  it('supports an authored shot without inventing a receiver', () => {
    const draft = movingDraft();
    draft.frames[1].ball.transition = 'shot';
    draft.frames[1].ball.ownerId = null;
    draft.frames[1].ball.receiverId = null;
    draft.frames[1].ball.target = { x: 50, y: 94 };
    const scene = compilePlaymakerScene(draft);
    const frame = samplePlayScene(scene, scene.duration / 2);

    expect(scene.ball.segments[0]).toMatchObject({
      type: 'shot',
      fromPlayerId: 'US_C',
      end: { x: 50, y: 94 },
    });
    expect(frame.players).toHaveLength(12);
    expect(frame.ball.position.x).toBeTypeOf('number');
    expect(frame.ball.position.y).toBeTypeOf('number');
  });
});
