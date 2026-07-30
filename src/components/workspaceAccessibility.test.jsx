import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../context/AppContext';
import { ThemeProvider } from '../context/ThemeContext';
import Sidebar from './Sidebar';

const mainSource = readFileSync(new URL('../main.jsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
const rinkSource = readFileSync(new URL('./RinkSVG.jsx', import.meta.url), 'utf8');
const strategySource = readFileSync(new URL('./TacticsLearn.jsx', import.meta.url), 'utf8');
const guideSource = readFileSync(new URL('./KeyboardHelp.jsx', import.meta.url), 'utf8');
const playmakerSource = readFileSync(new URL('../playmaker/PlaymakerWorkspace.jsx', import.meta.url), 'utf8');
const tutorialSource = readFileSync(new URL('../playmaker/PlaymakerTutorial.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

function renderSidebar() {
  return renderToStaticMarkup(
    <ThemeProvider>
      <AppProvider>
        <Sidebar embedded />
      </AppProvider>
    </ThemeProvider>,
  );
}

describe('workspace accessibility contract', () => {
  it('names search and favorite controls without nesting interactive elements', () => {
    const markup = renderSidebar();

    expect(markup).toContain('type="search"');
    expect(markup).toContain('aria-label="Search plays"');
    expect(markup).toContain('aria-label="Save 1-2-2 Strong-Side Lock"');
    expect(markup).toContain('aria-current="true"');
    expect(markup).not.toContain('role="button"');
  });

  it('names strategy controls and exposes their selected state', () => {
    expect(strategySource).toContain('aria-label="Strategy principle"');
    expect(strategySource).toContain('<PlaybackControls compact />');
    expect(strategySource).toContain('aria-pressed={activeTab === tab.id}');
  });

  it('honors reduced-motion preferences in CSS, Framer Motion, and rink pulses', () => {
    expect(mainSource).toContain('<MotionConfig reducedMotion="user">');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('transition-duration: 0.01ms !important');
    expect(rinkSource).toContain('useReducedMotion()');
    expect(rinkSource).toContain("data-motion={reducedMotion ? 'reduced' : 'full'}");
    expect(rinkSource).toContain('!reducedMotion &&');
  });

  it('defines visible focus treatment for every native workspace control', () => {
    expect(css).toContain('button:focus-visible');
    expect(css).toContain('select:focus-visible');
    expect(css).toContain('input:focus-visible');
    expect(css).toContain('textarea:focus-visible');
    expect(css).toContain('a:focus-visible');
    expect(css).toContain('[role="button"]:focus-visible');
    expect(css).toContain('--gs-cyan: #38d7ff');
    expect(css).toContain('outline: 2px solid var(--gs-cyan)');
  });

  it('provides a context-aware guide and an accessible Create walkthrough', () => {
    expect(guideSource).toContain('aria-label="Goonsquad product guide"');
    expect(guideSource).toContain('role="tablist"');
    expect(guideSource).toContain('role="tabpanel"');
    expect(guideSource).toContain('onClick={startCreateTutorial}');
    expect(playmakerSource).toContain('aria-label="Open Create tutorial"');
    expect(playmakerSource).toContain('label="About authored moments"');
    expect(playmakerSource).toContain('label="About player intent"');
    expect(playmakerSource).toContain('label="About ball decisions"');
    expect(tutorialSource).toContain('aria-label="Create tutorial"');
    expect(tutorialSource).toContain('aria-label="Exit Create tutorial"');
  });

  it('keeps catalog shortcuts available after a user clicks a replay control', () => {
    expect(appSource).toContain("target?.closest('input,select,textarea,[contenteditable=\"true\"]')");
    expect(appSource).toContain("['ArrowRight', 'ArrowLeft', ' '].includes(e.key)");
    expect(appSource).toContain("e.key === '['");
    expect(appSource).toContain("e.key === ']'");
  });
});
