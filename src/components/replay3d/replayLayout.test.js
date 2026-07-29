import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

function cssBlock(selector) {
  const match = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\n\\}`));
  return match?.[1] ?? '';
}

describe('3D replay layout', () => {
  it('lets the WebGL stage read as the primary experience instead of a small framed preview', () => {
    const shell = cssBlock('.replay3d-shell');
    const stage = cssBlock('.replay3d-stage');

    expect(shell).toContain('padding: 0 0 12px');
    expect(stage).toContain('width: 100%');
    expect(stage).not.toContain('width: min(100%, 1120px)');
    expect(stage).not.toContain('border: 1px solid');
    expect(stage).not.toContain('border-radius: 8px');
  });

  it('keeps the 3D stage as a full first-screen broadcast surface on modern mobile and desktop viewports', () => {
    const shell = cssBlock('.replay3d-shell');
    const mobileShell = css.match(/@media \(max-width: 900px\) \{\s*\.replay3d-shell\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';

    expect(shell).toContain('calc(100svh - 92px)');
    expect(shell).not.toContain('calc(100vh - 126px)');
    expect(mobileShell).toContain('grid-template-rows: minmax(420px, 64svh) auto auto');
  });
});
