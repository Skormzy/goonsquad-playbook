import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const viewer = readFileSync(new URL('./PlayViewer.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

describe('responsive play workspace structure', () => {
  it('defines the four desktop coaching regions', () => {
    expect(viewer).toContain('data-region="library"');
    expect(viewer).toContain('data-region="rink"');
    expect(viewer).toContain('data-region="detail"');
    expect(viewer).toContain('data-region="timeline"');
    expect(css).toContain('.play-workspace-desktop');
    expect(css).toContain('grid-template-columns: minmax(190px, 218px)');
    expect(css).toContain('minmax(340px, 500px)');
  });

  it('uses a separate mobile bottom sheet and rink-first bounded height', () => {
    expect(viewer).toContain('data-testid="play-bottom-sheet"');
    expect(viewer).toContain('aria-controls="mobile-coaching-detail"');
    expect(css).toContain('.play-bottom-sheet');
    expect(css).toContain('height: min(58svh, 520px)');
    expect(css).toContain('.curriculum-lane-switch');
  });

  it('does not use page zoom as a responsive layout mechanism', () => {
    expect(css).not.toMatch(/\.app-content\s*\{[^}]*zoom:/s);
  });
});
