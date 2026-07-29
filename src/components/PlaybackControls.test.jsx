import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../context/AppContext';
import { ThemeProvider } from '../context/ThemeContext';
import { formatPlaybackTime } from '../play-engine/formatPlaybackTime';
import PlaybackControls from './PlaybackControls';

function renderControls() {
  return renderToStaticMarkup(
    <ThemeProvider>
      <AppProvider>
        <PlaybackControls />
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
    expect(html.match(/<option/g)).toHaveLength(4);
  });

  it('formats deterministic replay time without changing control width', () => {
    expect(formatPlaybackTime(0)).toBe('0:00.0');
    expect(formatPlaybackTime(4.6)).toBe('0:04.6');
    expect(formatPlaybackTime(68.25)).toBe('1:08.3');
  });
});
