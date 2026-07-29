import { describe, expect, it } from 'vitest';
import {
  createPlaymakerDraft,
  normalizePlaymakerDraft,
  PLAYMAKER_ROSTER,
  playmakerFrameTimes,
} from './playmakerModel';

describe('playmaker draft model', () => {
  it('starts every play with two complete 5v5 plus goalie moments', () => {
    const draft = createPlaymakerDraft('breakout');

    expect(draft.frames).toHaveLength(2);
    expect(Object.keys(draft.frames[0].players)).toHaveLength(12);
    expect(Object.keys(draft.frames[1].players).sort()).toEqual(
      PLAYMAKER_ROSTER.map((player) => player.id).sort(),
    );
    expect(draft.frames[0].ball.ownerId).toBe('US_C');
    expect(draft.frames[1].ball).toMatchObject({
      ownerId: 'US_C',
      receiverId: 'US_C',
      transition: 'carry',
    });
    expect(draft.schemaVersion).toBe(2);
    expect(playmakerFrameTimes(draft)).toEqual([0, 2]);
  });

  it('migrates a legacy possession change into an explicit receiver contract', () => {
    const legacy = createPlaymakerDraft('breakout');
    legacy.schemaVersion = 1;
    legacy.frames[1].ball.transition = 'pass';
    legacy.frames[1].ball.ownerId = 'US_RW';
    delete legacy.frames[1].ball.receiverId;

    const draft = normalizePlaymakerDraft(legacy);

    expect(draft.schemaVersion).toBe(2);
    expect(draft.frames[1].ball).toMatchObject({
      ownerId: 'US_RW',
      receiverId: 'US_RW',
      transition: 'pass',
    });
  });

  it('does not reinterpret an opponent as the receiver of a teammate pass', () => {
    const value = createPlaymakerDraft('breakout');
    value.frames[1].ball.transition = 'pass';
    value.frames[1].ball.ownerId = 'OP_RW';
    value.frames[1].ball.receiverId = 'OP_RW';

    const draft = normalizePlaymakerDraft(value);

    expect(draft.frames[1].ball.ownerId).toBeNull();
    expect(draft.frames[1].ball.receiverId).toBeNull();
  });

  it('supports an explicit loose-ball recovery without turning it into a pass', () => {
    const value = createPlaymakerDraft('breakout');
    value.frames[1].ball.transition = 'loose';
    value.frames[1].ball.ownerId = 'OP_C';
    value.frames[1].ball.receiverId = null;

    const draft = normalizePlaymakerDraft(value);

    expect(draft.frames[1].ball).toMatchObject({
      ownerId: 'OP_C',
      receiverId: null,
      transition: 'loose',
    });
  });

  it('repairs partial imported drafts without dropping either team', () => {
    const draft = normalizePlaymakerDraft({
      title: 'Imported shape',
      frames: [{ players: { US_C: { x: 44, y: 31 } } }],
    });

    expect(draft.title).toBe('Imported shape');
    expect(draft.frames).toHaveLength(2);
    expect(Object.keys(draft.frames[0].players)).toHaveLength(12);
    expect(draft.frames[0].players.US_C).toMatchObject({ x: 44, y: 31 });
  });
});
