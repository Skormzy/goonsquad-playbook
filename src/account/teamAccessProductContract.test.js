import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const accountContext = read('src/account/AccountContext.jsx');
const appContext = read('src/context/AppContext.jsx');
const app = read('src/App.jsx');
const header = read('src/components/Header.jsx');
const mobileNav = read('src/components/MobileBottomNav.jsx');
const switcher = read('src/components/WorkspaceSwitcher.jsx');
const gate = read('src/account/TeamAccessGate.jsx');
const profile = read('src/profile/ProfileWorkspace.jsx');
const css = read('src/account/teamAccess.css');

describe('approved member access product contract', () => {
  it('derives access only from an approved player link or administrator role', () => {
    expect(accountContext).toContain("profile?.role === 'admin' || approvedPlayerLink");
    expect(accountContext).toContain("claim.status === 'approved'");
    expect(accountContext).toContain("claim.status === 'pending'");
  });

  it('blocks private view changes and direct URLs before private modules mount', () => {
    expect(appContext).toContain('isPrivateTeamView(next) && !hasTeamAccess');
    expect(appContext).toContain("activeViewRef.current = 'home'");
    expect(app).toContain('privateWorkspaceBlocked');
    expect(app).toContain('<PrivateWorkspaceGate requestedView={activeView} />');
    expect(app).toContain('<TeamAccessPrompt />');
  });

  it('keeps locked navigation actionable on desktop and mobile', () => {
    expect(switcher).toContain("data-locked={locked || undefined}");
    expect(switcher).toContain("aria-haspopup={locked ? 'dialog' : undefined}");
    expect(header).toContain('privateAccess={account.hasTeamAccess}');
    expect(mobileNav).toContain('if (setActiveView(nextView) === false) return;');
    expect(mobileNav).toContain('data-testid={`mobile-nav-${content}`}');
    expect(mobileNav).toContain('<LockKeyhole className="mobile-bottom-nav-lock"');
  });

  it('gives each account state a direct next action without exposing private content', () => {
    expect(gate).toContain('Create account or sign in');
    expect(gate).toContain('Request player access');
    expect(gate).toContain('View request');
    expect(gate).toContain('Home game updates and the complete public Stats section stay open.');
    expect(profile).toContain('unlock Squad Live, Plays, Strategy, and Create after admin approval');
    expect(css).toContain('.team-access-dialog');
    expect(css).toContain('@media (max-width: 600px)');
  });

  it('keeps the visual QA access override development-only', () => {
    expect(accountContext).toContain('import.meta.env.DEV');
    expect(accountContext).toContain("searchParams.get('qaTeamAccess')");
  });
});
