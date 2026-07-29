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

  it('offers open email registration, username sign-in, and password recovery', () => {
    const dialog = read('src/account/AccountDialog.jsx');
    const workspace = read('src/account/AccountWorkspace.jsx');
    const cloud = read('src/playmaker/playmakerCloud.js');
    const usernameLogin = read('api/auth/username-login.js');
    expect(dialog).toContain('Create my account');
    expect(dialog).toContain('Email or username');
    expect(dialog).toContain('Keep me signed in on this device');
    expect(dialog).not.toContain('Continue with Google');
    expect(dialog).toContain('Forgot password?');
    expect(workspace).toContain('Create your account');
    expect(workspace).toContain('Email or username');
    expect(workspace).toContain('UsernameField');
    expect(workspace).not.toContain('Sign up with Google');
    expect(cloud).toContain('/api/auth/username-login');
    expect(cloud).toContain('adaptiveAuthStorage');
    expect(cloud).not.toContain("provider: 'google'");
    expect(usernameLogin).toContain('admin.auth.admin.getUserById');
    expect(usernameLogin).toContain('signInWithPassword');
    expect(usernameLogin).not.toContain('response.status(200).json({ email');
    expect(cloud).toContain('resetPasswordForEmail');
    expect(cloud).toContain("window.location.origin");
    expect(cloud).toContain('runtimeOrigin || publicAppUrl');
  });

  it('keeps account administration behind a server-authorized admin console', () => {
    const panel = read('src/account/AccountAdminPanel.jsx');
    const api = read('api/account-admin.js');
    const server = read('server/supabaseAdmin.js');
    expect(panel).toContain('Member administration');
    expect(panel).toContain('Send reset');
    expect(panel).toContain('Confirm delete');
    expect(api).toContain('requireAccountAdmin');
    expect(api).toContain('Only the account owner can promote another admin.');
    expect(server).toContain("profile?.role !== 'admin'");
    expect(server).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(server).not.toContain('VITE_SUPABASE_SERVICE_ROLE_KEY');
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
