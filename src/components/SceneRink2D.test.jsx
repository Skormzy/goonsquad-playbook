import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../context/AppContext';
import { ThemeProvider } from '../context/ThemeContext';
import { standardBreakout3dReplay } from '../replay3d/data/standardBreakout3d';
import SceneRink2D from './SceneRink2D';

describe('SceneRink2D', () => {
  it('renders the flagship scene through the shared 2D rink renderer', () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider>
        <AppProvider>
          <SceneRink2D
            scene={standardBreakout3dReplay}
            time={3.8}
            selectedPosition="LD"
          />
        </AppProvider>
      </ThemeProvider>,
    );

    expect(markup).toContain('data-renderer="play-scene-2d"');
    expect(markup).toContain('Standard Breakout: Boards Release at 3.8 seconds');
    expect(markup).toContain('>LD<');
    expect(markup).toContain('>LW<');
    expect(markup).toContain('>G<');
    expect(markup.match(/data-team="us"/g)).toHaveLength(6);
    expect(markup.match(/data-team="opponent"/g)).toHaveLength(6);
    expect(markup).toMatch(/data-team="us" data-role="LD" data-focused="true"/);
  });
});
