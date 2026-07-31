import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import WorkspaceSwitcher from './WorkspaceSwitcher';

const colors = {
  accent: '#22d3ee',
  accentBackground: '#22d3ee18',
  border: '#1e2d42',
  track: '#0c1527',
  text: '#e2e8f0',
  muted: '#8098b5',
};

describe('WorkspaceSwitcher', () => {
  it('renders content and view as separate accessible controls', () => {
    const markup = renderToStaticMarkup(
      <WorkspaceSwitcher
        content="plays"
        mode="2d"
        onContentChange={vi.fn()}
        onModeChange={vi.fn()}
        colors={colors}
      />,
    );

    expect(markup).toContain('aria-label="Primary navigation"');
    expect(markup).toContain('aria-label="View"');
    expect(markup).toContain('data-testid="workspace-content-plays"');
    expect(markup).toContain('data-testid="workspace-content-playmaker"');
    expect(markup).toContain('data-testid="workspace-content-home"');
    expect(markup).toContain('data-testid="workspace-content-stats"');
    expect(markup).toContain('data-testid="workspace-view-3d"');
    expect(markup).toContain('>HOME</span>');
    expect(markup.indexOf('workspace-content-home')).toBeLessThan(markup.indexOf('workspace-content-stats'));
    expect(markup.indexOf('workspace-content-stats')).toBeLessThan(markup.indexOf('workspace-content-plays'));
  });

  it('shows Squad Live and Stats as separate first-class surfaces without view switches', () => {
    const homeMarkup = renderToStaticMarkup(
      <WorkspaceSwitcher
        content="home"
        mode="2d"
        onContentChange={vi.fn()}
        onModeChange={vi.fn()}
        colors={colors}
      />,
    );
    const markup = renderToStaticMarkup(
      <WorkspaceSwitcher
        content="stats"
        mode="2d"
        onContentChange={vi.fn()}
        onModeChange={vi.fn()}
        colors={colors}
      />,
    );

    expect(homeMarkup).toContain('data-content="home"');
    expect(homeMarkup).toContain('data-testid="workspace-content-home"');
    expect(homeMarkup).toContain('aria-current="page"');
    expect(homeMarkup).not.toContain('aria-label="View"');
    expect(markup).toContain('data-content="stats"');
    expect(markup).toContain('data-testid="workspace-content-stats"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).not.toContain('aria-label="View"');
  });

  it('shows Playmaker as a first-class content surface without a redundant view switch', () => {
    const markup = renderToStaticMarkup(
      <WorkspaceSwitcher
        content="playmaker"
        mode="2d"
        onContentChange={vi.fn()}
        onModeChange={vi.fn()}
        colors={colors}
      />,
    );

    expect(markup).toContain('data-content="playmaker"');
    expect(markup).toContain('data-testid="workspace-content-playmaker"');
    expect(markup).not.toContain('aria-label="View"');
  });

  it('disables 3D while Strategy has no production scene', () => {
    const markup = renderToStaticMarkup(
      <WorkspaceSwitcher
        content="strategy"
        mode="2d"
        onContentChange={vi.fn()}
        onModeChange={vi.fn()}
        colors={colors}
      />,
    );

    expect(markup).toMatch(/data-testid="workspace-view-3d"[^>]*disabled/);
  });

  it('keeps private modules actionable but visibly locked for public visitors', () => {
    const markup = renderToStaticMarkup(
      <WorkspaceSwitcher
        content="stats"
        mode="2d"
        onContentChange={vi.fn()}
        onModeChange={vi.fn()}
        privateAccess={false}
        accessMessage="Create an account and request access."
        colors={colors}
      />,
    );

    expect(markup).toMatch(/data-locked="true"[^>]*data-testid="workspace-content-plays"/);
    expect(markup).toMatch(/data-locked="true"[^>]*data-testid="workspace-content-strategy"/);
    expect(markup).toMatch(/data-locked="true"[^>]*data-testid="workspace-content-playmaker"/);
    expect(markup).not.toMatch(/data-testid="workspace-content-stats"[^>]*data-locked/);
    expect(markup).not.toMatch(/data-testid="workspace-content-home"[^>]*data-locked/);
    expect(markup).toContain('Create an account and request access.');
  });
});
