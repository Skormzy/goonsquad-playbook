import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../context/AppContext';
import { ThemeProvider } from '../context/ThemeContext';
import { formatPlaybackTime } from '../play-engine/formatPlaybackTime';
import { PLAYBACK_SPEEDS, normalizePlaybackSpeed } from '../play-engine/playbackSpeeds';
import PlaybackControls from './PlaybackControls';

function renderControls({ compact = false } = {}) {
  return renderToStaticMarkup(
    <ThemeProvider>
      <AppProvider>
        <PlaybackControls compact={compact} />
      </AppProvider>
    </ThemeProvider>,
  );
}

describe('PlaybackControls', () => {
  it('renders a complete stable transport and timeline', () => {
    const html = renderControls();
    expect(html).toContain('data-testid="playback-replay"');
    expect(html).toContain('data-testid="playback-rewind"');
    expect(html).toContain('data-testid="playback-previous"');
    expect(html).toContain('data-testid="playback-play-toggle"');
    expect(html).toContain('data-testid="playback-next"');
    expect(html).toContain('type="range"');
    expect(html).toContain('aria-label="Replay timeline"');
    expect(html).toContain('data-testid="playback-speed"');
    expect(html).toContain('aria-label="Replay speed"');
    expect(html.match(/<option/g)).toHaveLength(3);
    expect(html).toContain('¼x');
    expect(html).toContain('½x');
    expect(html).not.toContain('1.5x');
    expect(html).not.toContain('2x');
  });

  it('shows a named phase rail in compact 3D transports', () => {
    const html = renderControls({ compact: true });
    expect(html).toContain('data-testid="playback-phase-selector"');
    expect(html).toContain('aria-label="Replay phases"');
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('data-testid="playback-phase-0"');
    expect(html).toContain('data-testid="playback-phase-1"');
  });

  it('offers only deliberate slow-motion speeds and normalizes obsolete fast links', () => {
    expect(PLAYBACK_SPEEDS).toEqual([0.25, 0.5, 1]);
    expect(normalizePlaybackSpeed(0.25)).toBe(0.25);
    expect(normalizePlaybackSpeed(0.5)).toBe(0.5);
    expect(normalizePlaybackSpeed(1.5)).toBe(1);
    expect(normalizePlaybackSpeed(2)).toBe(1);
  });

  it('formats deterministic replay time without changing control width', () => {
    expect(formatPlaybackTime(0)).toBe('0:00.0');
    expect(formatPlaybackTime(4.6)).toBe('0:04.6');
    expect(formatPlaybackTime(68.25)).toBe('1:08.3');
  });
});
