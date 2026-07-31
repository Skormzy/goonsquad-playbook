import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import PlaymakerCourt from './PlaymakerCourt';
import { createPlaymakerDraft, normalizePlaymakerDraft } from './playmakerModel';

function passToRightWinger() {
  const draft = createPlaymakerDraft('breakout');
  draft.frames[1].ball.transition = 'pass';
  draft.frames[1].ball.receiverId = 'US_RW';
  draft.frames[1].ball.ownerId = 'US_RW';
  return normalizePlaymakerDraft(draft);
}

function renderCourt(props) {
  return renderToStaticMarkup(
    <PlaymakerCourt
      interactive
      onMoveBall={() => {}}
      onMovePlayer={() => {}}
      onPlaceBallTarget={() => {}}
      onSelectPlayer={() => {}}
      selectedPlayerId="US_C"
      {...props}
    />,
  );
}

describe('PlaymakerCourt ball decisions', () => {
  it('shows the exact outgoing receiver before playback', () => {
    const draft = passToRightWinger();
    const markup = renderCourt({ frame: draft.frames[0], nextFrame: draft.frames[1] });

    expect(markup).toContain('data-from-player-id="US_C"');
    expect(markup).toContain('data-receiver-id="US_RW"');
    expect(markup).toContain('C to RW');
  });

  it('keeps the incoming receiver visible on the destination moment', () => {
    const draft = passToRightWinger();
    const markup = renderCourt({ frame: draft.frames[1], previousFrame: draft.frames[0] });

    expect(markup).toContain('data-receiver-id="US_RW"');
    expect(markup).not.toContain('data-receiver-id="US_LW"');
  });

  it('exposes an ownerless ball as a draggable rink object', () => {
    const draft = createPlaymakerDraft('breakout');
    draft.frames[0].ball.ownerId = null;
    draft.frames[0].ball.transition = 'loose';
    draft.frames[0].ball.target = { x: 73, y: 41 };
    const markup = renderCourt({ frame: draft.frames[0] });

    expect(markup).toContain('data-testid="playmaker-loose-ball"');
    expect(markup).toContain('data-rink-x="73"');
    expect(markup).toContain('data-rink-y="41"');
    expect(markup).toContain('playmaker-ball-hit-target');
    expect(markup).toContain('Loose ball. Drag or use arrow keys to position it.');
  });

  it('does not make a possessed ball independently draggable', () => {
    const draft = createPlaymakerDraft('breakout');
    const markup = renderCourt({ frame: draft.frames[0] });

    expect(markup).toContain('data-testid="playmaker-ball-marker"');
    expect(markup).not.toContain('data-testid="playmaker-loose-ball"');
  });
});
