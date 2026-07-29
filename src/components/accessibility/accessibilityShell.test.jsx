import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../../context/AppContext';
import { ThemeProvider } from '../../context/ThemeContext';
import Sidebar from '../Sidebar';

const appSource = readFileSync(new URL('../../App.jsx', import.meta.url), 'utf8');
const catalogSource = readFileSync(
  new URL('../../tactical3d/ReplayCatalogNavigator.jsx', import.meta.url),
  'utf8',
);
const dialogHookSource = readFileSync(
  new URL('../../hooks/useDialogFocus.js', import.meta.url),
  'utf8',
);
const documentSource = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
const strategySource = readFileSync(new URL('../StrategyModal.jsx', import.meta.url), 'utf8');

describe('application accessibility shell', () => {
  it('allows browser zoom and accounts for device safe areas', () => {
    expect(documentSource).toContain(
      'content="width=device-width, initial-scale=1, viewport-fit=cover"',
    );
    expect(documentSource).not.toContain('user-scalable=no');
    expect(documentSource).not.toContain('maximum-scale');
  });

  it('provides a stable skip target and route-owned main landmark', () => {
    expect(appSource).toContain('<SkipLink />');
    expect(appSource).toContain('id="main-content"');
    expect(appSource).toContain('tabIndex={-1}');
    expect(appSource).toContain("activeView === 'playbook' || activeView === 'tactics'");
  });

  it('exposes the overlay play library as a closable modal', () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider>
        <AppProvider>
          <Sidebar />
        </AppProvider>
      </ThemeProvider>,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-label="Play library"');
    expect(markup).toContain('aria-label="Close play library"');
  });

  it('uses shared dialog focus management for major replay overlays', () => {
    expect(strategySource).toContain('useDialogFocus');
    expect(catalogSource).toContain('useDialogFocus');
    expect(catalogSource).toContain("role={open ? 'dialog' : undefined}");
    expect(dialogHookSource).toContain("event.key === 'Escape'");
    expect(dialogHookSource).toContain("event.key !== 'Tab'");
    expect(dialogHookSource).toContain('opener?.isConnected');
  });
});
