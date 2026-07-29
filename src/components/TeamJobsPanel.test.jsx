import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../context/AppContext';
import { ThemeProvider } from '../context/ThemeContext';
import TeamJobsPanel from './TeamJobsPanel';

const jobs = [
  {
    id: 'wingers',
    label: 'Wingers',
    roles: ['LW', 'RW'],
    primaryRole: 'LW',
    actions: [{ role: 'LW', text: 'Receive on the wall and carry wide.', urgency: 'run' }],
  },
  {
    id: 'center',
    label: 'Center',
    roles: ['C'],
    primaryRole: 'C',
    actions: [{ role: 'C', text: 'Stay underneath as middle support.', urgency: 'hold' }],
  },
  {
    id: 'defense',
    label: 'Defense',
    roles: ['LD', 'RD'],
    primaryRole: 'LD',
    actions: [{ role: 'LD', text: 'Draw pressure and bank the ball wide.', urgency: 'hold' }],
  },
];

describe('TeamJobsPanel', () => {
  it('defaults to a concise team overview with grouped role lenses', () => {
    const markup = renderToStaticMarkup(
      <ThemeProvider>
        <AppProvider>
          <TeamJobsPanel
            eyebrow="PLAY PURPOSE"
            summary="Beat pressure with support."
            jobs={jobs}
            wide
          />
        </AppProvider>
      </ThemeProvider>,
    );

    expect(markup).toContain('data-active-lens="team"');
    expect(markup).toContain('data-testid="role-lens-team"');
    expect(markup).toContain('data-testid="role-lens-wingers"');
    expect(markup).toContain('Wingers');
    expect(markup).toContain('Defense');
    expect(markup).not.toContain('Left Wing');
    expect(markup).not.toContain('Right Wing');
  });
});
