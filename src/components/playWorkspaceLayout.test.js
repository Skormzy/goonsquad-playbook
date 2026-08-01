import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const viewer = readFileSync(new URL('./PlayViewer.jsx', import.meta.url), 'utf8');
const mobileTeamPlan = readFileSync(new URL('./MobileTeamPlan.jsx', import.meta.url), 'utf8');
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

  it('uses one desktop coaching source while retaining guided cues on compact layouts', () => {
    expect(viewer.match(/<ReplayTeachingCue accent=\{currentPhaseColor\}>/g)).toHaveLength(1);
    expect(viewer).toContain('<div className="play-detail-faceoff">');
    expect(viewer).not.toContain('<div className="play-region-label"');
  });

  it('uses a shared exact-role coaching dock and rink-first bounded height', () => {
    expect(viewer).toContain('className="play-bottom-sheet"');
    expect(viewer).toContain('fallbackText={phase?.desc}');
    expect(mobileTeamPlan).toContain('data-testid="mobile-team-plan"');
    expect(mobileTeamPlan).toContain('aria-controls={contentId}');
    expect(mobileTeamPlan).toContain('<RolePositionSelector');
    expect(viewer).toContain('className="play-mobile-library-trigger"');
    expect(viewer).toContain('const syncSheet = () => setSheetOpen(query.matches)');
    expect(css).toContain('.play-bottom-sheet');
    expect(css).toContain('height: min(58svh, 520px)');
    expect(css).toContain('.curriculum-lane-switch');
  });

  it('does not use page zoom as a responsive layout mechanism', () => {
    expect(css).not.toMatch(/\.app-content\s*\{[^}]*zoom:/s);
  });

  it('keeps instructional copy complete and readable at every compact breakpoint', () => {
    const readabilitySeal = css.split('/* Replay coaching readability seal')[1];

    expect(readabilitySeal).toBeTruthy();
    expect(readabilitySeal).toContain('.replay-teaching-cue-copy p');
    expect(readabilitySeal).toContain('white-space: normal');
    expect(readabilitySeal).toContain('text-overflow: clip');
    expect(readabilitySeal).toContain('-webkit-line-clamp: unset');
    expect(readabilitySeal).toContain('font-size: 13px');
    expect(readabilitySeal).not.toMatch(/-webkit-line-clamp:\s*[12]\s*;/);
    expect(readabilitySeal).not.toContain('text-overflow: ellipsis');
  });
});
