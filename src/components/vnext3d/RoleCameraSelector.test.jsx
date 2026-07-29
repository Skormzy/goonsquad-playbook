import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import RoleCameraSelector from './RoleCameraSelector';

describe('RoleCameraSelector', () => {
  it('offers every exact position and exposes the selected follow target', () => {
    const markup = renderToStaticMarkup(
      <RoleCameraSelector onSelect={vi.fn()} selectedPosition="RW" />,
    );

    expect(markup).toContain('aria-label="Player to follow"');
    for (const label of [
      'Follow Left winger',
      'Follow Center',
      'Follow Right winger',
      'Follow Left defense',
      'Follow Right defense',
      'Follow Goalie',
    ]) {
      expect(markup).toContain(`aria-label="${label}"`);
    }
    expect(markup).toContain('aria-label="Follow Right winger" aria-pressed="true"');
  });
});
