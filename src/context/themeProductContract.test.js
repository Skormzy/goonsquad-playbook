import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('application theme contract', () => {
  it('publishes the selected theme to the full document', () => {
    const context = read('src/context/ThemeContext.jsx');
    expect(context).toContain('root.dataset.theme = theme');
    expect(context).toContain('root.style.colorScheme = theme');
    expect(context).toContain('document.body.style.backgroundColor = THEMES[theme].bg');
  });

  it('defines complete root tokens for light and dark UI surfaces', () => {
    const css = read('src/index.css');
    expect(css).toContain(':root[data-theme="light"]');
    expect(css).toContain('--gs-overlay: rgba(255, 255, 255, 0.94)');
    expect(css).toContain('--gs-overlay-solid: #ffffff');
    expect(css).toContain('--gs-on-accent: #ffffff');
  });

  it('does not pin the account identity panel to a dark palette', () => {
    const css = read('src/account/account.css');
    const identity = css.slice(
      css.indexOf('.account-workspace-identity {'),
      css.indexOf('.account-workspace-panel {'),
    );
    expect(identity).toContain('background: var(--account-panel)');
    expect(identity).toContain('color: var(--account-text)');
    expect(identity).not.toContain('#090d12');
    expect(identity).not.toContain('#0d141d');
  });

  it('passes the selected theme into every production 3D scene', () => {
    const production = read('src/components/vnext3d/ProductionReplayPreview.jsx');
    const tactical = read('src/tactical3d/TacticalReplayPreview.jsx');
    const create = read('src/playmaker/Playmaker3DPreview.jsx');
    const scene = read('src/tactical3d/TacticalReplayScene.jsx');
    const court = read('src/components/vnext3d/ProductionCourt.jsx');
    expect(production).toContain('theme={theme}');
    expect(tactical).toContain('theme={theme}');
    expect(create).toContain('theme={theme}');
    expect(scene).toContain("theme === 'light' ? '#dfe5e8' : '#080d14'");
    expect(court).toContain("theme === 'light' ? '#cbd3d8' : '#111720'");
  });
});
