import { describe, expect, it } from 'vitest';
import {
  FACE_OFF_OUTCOMES,
  FACE_OFF_PLAY_IDS,
  resolveFaceoffPlayOutcome,
} from '../data/faceoffPlays';
import { PLAYS } from '../data/plays';
import { compilePlayThreeDScene } from './compileThreeDScene';
import { auditFaceoffPlay } from './faceoffContract';
import { samplePlayScene } from './samplePlayScene';

describe('faceoff replay contract', () => {
  const outcomeCases = FACE_OFF_PLAY_IDS.flatMap((playId) => (
    FACE_OFF_OUTCOMES.map((outcome) => [playId, outcome])
  ));

  it('covers every authored faceoff play', () => {
    const authoredFaceoffs = PLAYS.filter((play) => play.faceoff).map((play) => play.id);
    expect(authoredFaceoffs).toEqual(FACE_OFF_PLAY_IDS);
    expect(authoredFaceoffs).toEqual(['dzfl', 'dzfr', 'nzfc', 'ozfl', 'ppfo', 'pkfo']);
  });

  it.each(outcomeCases)('%s:%s uses a legal setup and one coherent draw outcome', (playId, outcome) => {
    const basePlay = PLAYS.find((candidate) => candidate.id === playId);
    const play = resolveFaceoffPlayOutcome(basePlay, outcome);
    const scene = compilePlayThreeDScene(play);
    const audit = auditFaceoffPlay(play, scene);

    expect(audit.errors, audit.errors.join('\n')).toEqual([]);
  });

  it.each(outcomeCases)('%s:%s keeps the draw loose until contact and then gives it to the authored target', (playId, outcome) => {
    const basePlay = PLAYS.find((candidate) => candidate.id === playId);
    const play = resolveFaceoffPlayOutcome(basePlay, outcome);
    const scene = compilePlayThreeDScene(play);
    const draw = scene.ball.segments.find((segment) => segment.type === 'faceoff');
    const beforeContact = samplePlayScene(scene, Math.max(0, draw.from - 0.01));
    const duringContact = samplePlayScene(scene, draw.from + (draw.to - draw.from) * 0.5);
    const afterContact = samplePlayScene(scene, Math.min(scene.duration, draw.to + 0.03));

    expect(beforeContact.ball.ownerId).toBeNull();
    expect(duringContact.ball).toMatchObject({ segmentType: 'faceoff', ownerId: null });
    expect(afterContact.ball.ownerId).toBe(play.faceoff.outcomeTarget);
    expect(duringContact.players.filter((player) => player.role === 'C').map((player) => player.action))
      .toEqual(['forehand-pass', 'forehand-pass']);
  });

  it.each(FACE_OFF_PLAY_IDS)('%s keeps the legal setup identical while the resolution changes', (playId) => {
    const basePlay = PLAYS.find((candidate) => candidate.id === playId);
    const won = resolveFaceoffPlayOutcome(basePlay, 'won');
    const lost = resolveFaceoffPlayOutcome(basePlay, 'lost');

    expect(lost.phases.slice(0, 2)).toEqual(won.phases.slice(0, 2));
    expect(won.faceoff.outcomeTarget).toMatch(/^US_/);
    expect(lost.faceoff.outcomeTarget).toMatch(/^OP_/);
    expect(lost.phases[2].ballOwner)
      .toBe(`op-${lost.faceoff.outcomeTarget.slice(3).toLowerCase()}`);
    expect(lost.phases[2].t).toMatch(/Draw Lost/);
  });

  it('uses the lost-draw response for the 3D team plan', () => {
    const basePlay = PLAYS.find((candidate) => candidate.id === 'dzfl');
    const lost = resolveFaceoffPlayOutcome(basePlay, 'lost');
    const scene = compilePlayThreeDScene(lost);

    expect(scene.presentation.responsibilities).toEqual([
      expect.objectContaining({ role: 'Winger', action: expect.stringMatching(/strong-side point/i) }),
      expect.objectContaining({ role: 'Center', action: expect.stringMatching(/recover underneath/i) }),
      expect.objectContaining({ role: 'Defense', action: expect.stringMatching(/strong post/i) }),
    ]);
  });

  it('rejects non-centers that encroach inside the official 4.57m clearance', () => {
    const play = structuredClone(PLAYS.find((candidate) => candidate.id === 'dzfl'));
    play.phases[0].pos.LW.x = play.faceoff.dot.x - 10;
    const audit = auditFaceoffPlay(play, compilePlayThreeDScene(play));

    expect(audit.errors.some((error) => error.includes('4.57m faceoff clearance'))).toBe(true);
  });

  it('rejects centers that are not approximately one stick length apart', () => {
    const play = structuredClone(PLAYS.find((candidate) => candidate.id === 'dzfl'));
    play.phases[0].pos.C.y = play.faceoff.dot.y - 3;
    play.phases[0].opp.find((player) => player.l === 'C').y = play.faceoff.dot.y + 3;
    const audit = auditFaceoffPlay(play, compilePlayThreeDScene(play));

    expect(audit.errors.some((error) => error.includes('center separation'))).toBe(true);
  });
});
