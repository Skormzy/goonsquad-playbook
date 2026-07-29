import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dialogSource = readFileSync(new URL('./AccountDialog.jsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(new URL('./AccountWorkspace.jsx', import.meta.url), 'utf8');
const profileSource = readFileSync(new URL('../profile/ProfileWorkspace.jsx', import.meta.url), 'utf8');
const contextSource = readFileSync(new URL('./AccountContext.jsx', import.meta.url), 'utf8');

describe('player-facing account copy integrity', () => {
  it('keeps deployment vendors and credentials out of account screens', () => {
    const visibleSources = `${dialogSource}\n${workspaceSource}\n${profileSource}`;
    expect(visibleSources).not.toMatch(/supabase|project url|publishable key/iu);
    expect(visibleSources).not.toContain('Connection required');
    expect(visibleSources).not.toContain('What is left?');
    expect(visibleSources).toContain('Accounts are temporarily unavailable');
    expect(visibleSources).toContain('local plays remain safe');
  });

  it('announces account failures as alerts and routine notices as statuses', () => {
    expect(dialogSource).toContain("role={account.statusTone === 'error' ? 'alert' : 'status'}");
    expect(workspaceSource).toContain("role={account.statusTone === 'error' ? 'alert' : 'status'}");
    expect(profileSource).toContain("role={account.statusTone === 'error' ? 'alert' : 'status'}");
    expect(contextSource).toContain("setStatusTone('error')");
    expect(contextSource).toContain("setStatusTone('success')");
  });
});
