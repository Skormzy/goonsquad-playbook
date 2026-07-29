import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  CORE_PLAYS,
  CORE_TACTICS,
  itemsForCurriculumLane,
} from '../data/coreCatalog';
import ReplayCatalogNavigator from './ReplayCatalogNavigator';
import { catalogSequence } from './replayCatalogNavigation';

describe('ReplayCatalogNavigator', () => {
  it('resolves adjacent items within a curriculum lane without wrapping', () => {
    const defence = itemsForCurriculumLane(CORE_PLAYS, 'defence');
    const first = catalogSequence(defence, defence[0].id);
    const middle = catalogSequence(defence, defence[3].id);
    const last = catalogSequence(defence, defence.at(-1).id);

    expect(first.previous).toBeNull();
    expect(first.next?.id).toBe(defence[1].id);
    expect(middle.previous?.id).toBe(defence[2].id);
    expect(middle.next?.id).toBe(defence[4].id);
    expect(last.next).toBeNull();
  });

  it('renders the current play lane and its sequence state', () => {
    const markup = renderToStaticMarkup(
      <ReplayCatalogNavigator
        currentId="dzfl"
        items={CORE_PLAYS}
        kind="play"
        onSelect={vi.fn()}
      />,
    );

    expect(markup).toContain('aria-label="Browse 3D plays"');
    expect(markup).toContain('DEFENCE 02 / 06');
    expect(markup).toContain('D-Zone Faceoff');
    expect(markup).toContain('BROWSE PLAYS');
    expect(markup).toContain('aria-label="Browse all plays. Current play: D-Zone Faceoff"');
    expect(markup.match(/data-item-id=/g)).toHaveLength(
      itemsForCurriculumLane(CORE_PLAYS, 'defence').length,
    );
    expect(markup).toContain('data-lane="offence"');
    expect(markup).toContain('aria-current="true"');
  });

  it('renders the current strategy lane with strategy-specific labels', () => {
    const markup = renderToStaticMarkup(
      <ReplayCatalogNavigator
        currentId={CORE_TACTICS[2].id}
        items={CORE_TACTICS}
        kind="strategy"
        onSelect={vi.fn()}
      />,
    );

    expect(markup).toContain('aria-label="Browse 3D strategies"');
    expect(markup).toContain('DEFENCE 03 / 04');
    expect(markup).toContain('BROWSE STRATEGIES');
    expect(markup.match(/data-item-id=/g)).toHaveLength(
      itemsForCurriculumLane(CORE_TACTICS, 'defence').length,
    );
  });
});
