import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../context/AppContext';
import RolePositionSelector from './RolePositionSelector';

const jobs = [
  {
    id: 'wingers',
    label: 'Wingers',
    roles: ['LW', 'RW'],
    primaryRole: 'LW',
    actions: [
      { role: 'LW', text: 'Seal the far-side lane.', urgency: 'run' },
      { role: 'RW', text: 'Close inside-out on the carrier.', urgency: 'sprint' },
    ],
  },
  {
    id: 'center',
    label: 'Center',
    roles: ['C'],
    primaryRole: 'C',
    actions: [{ role: 'C', text: 'Protect the middle.', urgency: 'run' }],
  },
  {
    id: 'defense',
    label: 'Defense',
    roles: ['LD', 'RD'],
    primaryRole: 'LD',
    actions: [
      { role: 'LD', text: 'Hold the inside lane.', urgency: 'hold' },
      { role: 'RD', text: 'Shift with the unit.', urgency: 'run' },
    ],
  },
];

describe('RolePositionSelector', () => {
  it('shows a truthful all-team state and every active exact position', () => {
    const markup = renderToStaticMarkup(
      <AppProvider>
        <RolePositionSelector jobs={jobs} />
      </AppProvider>,
    );

    expect(markup).toContain('data-testid="role-position-team"');
    expect(markup).toContain('aria-pressed="true"');
    for (const position of ['lw', 'c', 'rw', 'ld', 'rd']) {
      expect(markup).toContain(`data-testid="role-position-${position}"`);
    }
    expect(markup).not.toContain('data-testid="role-position-g"');
  });
});
