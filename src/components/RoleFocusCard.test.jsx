import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AppProvider } from '../context/AppContext';
import { ThemeProvider } from '../context/ThemeContext';
import ResponsibilityPanel from './ResponsibilityPanel';
import RoleFocusCard from './RoleFocusCard';

function renderWithApp(component) {
  return renderToStaticMarkup(
    <ThemeProvider>
      <AppProvider>{component}</AppProvider>
    </ThemeProvider>,
  );
}

describe('RoleFocusCard', () => {
  it('renders the selected role responsibility as below-rink coaching content', () => {
    const markup = renderWithApp(<RoleFocusCard compact embedded />);

    expect(markup).toContain('data-testid="role-focus-card"');
    expect(markup).toContain('data-role="C"');
    expect(markup).toContain('ROLE FOCUS');
    expect(markup).toContain('Center');
    expect(markup).toContain('Middle anchor. Read the ball and organize the second layer.');
  });

  it('packages the primary system as complete grouped team jobs', () => {
    const markup = renderWithApp(<ResponsibilityPanel compact embedded />);

    expect(markup).toContain('data-testid="role-lens-team"');
    expect(markup).toContain('data-testid="role-lens-wingers"');
    expect(markup).toContain('data-testid="role-lens-center"');
    expect(markup).toContain('data-testid="role-lens-defense"');
    expect(markup).toContain('data-testid="role-lens-goalie"');
    expect(markup).toContain('Track the ball and keep the unit connected with clear calls.');
  });
});
