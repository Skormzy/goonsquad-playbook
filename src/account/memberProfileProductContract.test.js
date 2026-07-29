import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('member profile product contract', () => {
  it('keeps player linking immediate and self-serve', () => {
    const migration = read('supabase/migrations/20260723_member_profiles.sql');
    expect(migration).toContain('request_member_player_claim');
    expect(migration).toContain('on conflict (user_id, player_id)');
    expect(migration).not.toContain('create or replace function public.review_member_player_claim');
    expect(migration).not.toContain('create unique index if not exists member_player_claims_verified_player_idx');
    expect(migration).not.toContain('already verified to another account');
  });

  it('offers email, password recovery, and Google authentication', () => {
    const dialog = read('src/account/AccountDialog.jsx');
    const workspace = read('src/account/AccountWorkspace.jsx');
    const cloud = read('src/playmaker/playmakerCloud.js');
    expect(dialog).toContain('Create my account');
    expect(dialog).toContain('Continue with Google');
    expect(dialog).toContain('Forgot password?');
    expect(workspace).toContain('Create your account');
    expect(workspace).toContain('Sign up with Google');
    expect(workspace).toContain('UsernameField');
    expect(cloud).toContain("provider: 'google'");
    expect(cloud).toContain('resetPasswordForEmail');
  });

  it('routes members through dedicated account and profile workspaces', () => {
    const registry = read('src/routing/viewRegistry.js');
    const app = read('src/App.jsx');
    expect(registry).toContain("'profile'");
    expect(registry).toContain("'account'");
    expect(app).toContain('<ProfileWorkspace />');
    expect(app).toContain('<AccountWorkspace />');
  });

  it('enforces unique normalized usernames at the database boundary', () => {
    const migration = read('supabase/migrations/20260724_member_usernames.sql');
    const cloud = read('src/account/accountCloud.js');
    expect(migration).toContain('profiles_username_lower_idx');
    expect(migration).toContain('check_username_available');
    expect(migration).toContain('update_my_member_profile');
    expect(migration).toContain("username ~ '^[a-z0-9_]{3,24}$'");
    expect(cloud).toContain("cloud.rpc('check_username_available'");
    expect(cloud).toContain("cloud.rpc('update_my_member_profile'");
  });
});
