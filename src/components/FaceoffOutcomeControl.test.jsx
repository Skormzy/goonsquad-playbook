import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../context/AppContext';
import { CORE_PLAYS } from '../data/coreCatalog';
import FaceoffOutcomeControl from './FaceoffOutcomeControl';

describe('FaceoffOutcomeControl', () => {
  it('renders an accessible two-state result switch for faceoff plays', () => {
    const faceoff = CORE_PLAYS.find((play) => play.id === 'dzfl');
    const html = renderToStaticMarkup(
      <AppProvider>
        <FaceoffOutcomeControl play={faceoff} outcome="lost" onOutcomeChange={() => {}} />
      </AppProvider>,
    );

    expect(html).toContain('data-testid="faceoff-outcome-control"');
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Faceoff result"');
    expect(html).toContain('data-outcome="won"');
    expect(html).toContain('data-outcome="lost" aria-pressed="true"');
    expect(html).toContain('DRAW RESULT');
  });

  it('stays absent for non-faceoff plays', () => {
    const standardBreakout = CORE_PLAYS.find((play) => play.id === 'brk');
    const html = renderToStaticMarkup(
      <AppProvider>
        <FaceoffOutcomeControl play={standardBreakout} />
      </AppProvider>,
    );

    expect(html).toBe('');
  });
});
