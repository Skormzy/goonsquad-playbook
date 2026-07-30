import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../context/AppContext';
import { ThemeProvider } from '../context/ThemeContext';
import { standardBreakout3dReplay } from '../replay3d/data/standardBreakout3d';
import { getPlayScene, getStrategyScene } from '../play-engine/sceneRegistry';
import SceneRink2D from './SceneRink2D';

describe('SceneRink2D', () => {
  function renderScene(props) {
    return renderToStaticMarkup(
      <ThemeProvider>
        <AppProvider>
          <SceneRink2D {...props} />
        </AppProvider>
      </ThemeProvider>,
    );
  }

  it('renders the flagship scene through the shared 2D rink renderer', () => {
    const markup = renderScene({
      scene: standardBreakout3dReplay,
      time: 3.8,
      selectedPosition: 'LD',
    });

    expect(markup).toContain('data-renderer="play-scene-2d"');
    expect(markup).toContain('Standard Breakout: Boards Release at 3.8 seconds');
    expect(markup).toContain('>LD<');
    expect(markup).toContain('>LW<');
    expect(markup).toContain('>G<');
    expect(markup.match(/data-team="us"/g)).toHaveLength(6);
    expect(markup.match(/data-team="opponent"/g)).toHaveLength(6);
    expect(markup).toMatch(/data-team="us" data-role="LD" data-focused="true"/);
  });

  it('renders all five authored defensive assignments through runtime IDs', () => {
    const scene = getPlayScene('trap');
    const markup = renderScene({
      coverageLane: 'defence',
      scene,
      time: scene.sourcePhaseTimes[1],
    });

    expect(markup).toContain('data-coverage-visible="true"');
    expect(markup).toContain('data-coverage-count="5"');
    expect(markup.match(/data-testid="coverage-line"/g)).toHaveLength(5);
    expect(markup).toMatch(/data-home-role="RW" data-opponent-id="OP_LD"/);
  });

  it('renders strategy assignments from the same runtime contract', () => {
    const scene = getStrategyScene('watch-your-man', 'correct');
    const markup = renderScene({
      coverageLane: 'defence',
      scene,
      tactical: true,
      time: scene.sourcePhaseTimes[1],
    });

    expect(markup.match(/data-testid="coverage-line"/g)).toHaveLength(5);
  });

  it('keeps coverage hidden for offence and for a user override', () => {
    const scene = getPlayScene('trap');
    const time = scene.sourcePhaseTimes[1];
    const offensiveMarkup = renderScene({
      coverageLane: 'offence',
      scene,
      time,
    });
    const disabledMarkup = renderScene({
      coverageEnabled: false,
      coverageLane: 'defence',
      scene,
      time,
    });

    expect(offensiveMarkup).toContain('data-coverage-visible="false"');
    expect(offensiveMarkup).not.toContain('data-testid="coverage-line"');
    expect(disabledMarkup).not.toContain('data-testid="coverage-line"');
  });
});
