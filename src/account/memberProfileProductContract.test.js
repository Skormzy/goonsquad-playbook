import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('member profile product contract', () => {
  it('supports member requests plus admin review and direct player assignment', () => {
    const baseMigration = read('supabase/migrations/20260723_member_profiles.sql');
    const migration = read('supabase/migrations/20260729_member_player_claim_approval.sql');
    const profile = read('src/profile/ProfileWorkspace.jsx');
    const panel = read('src/account/AccountAdminPanel.jsx');
    const api = read('api/account-admin.js');
    expect(migration).toContain('request_member_player_claim');
    expect(migration).toContain('review_member_player_claim');
    expect(migration).toContain('assign_member_player_claim');
    expect(migration).toContain('unassign_member_player_claim');
    expect(migration).toContain('assert_player_link_admin');
    expect(migration).toContain("status in ('pending', 'approved', 'rejected')");
    expect(migration).toContain('member_player_claims_approved_player_idx');
    expect(migration).toContain('member_player_claims_primary_status_check');
    expect(migration).toMatch(/release_member_player_claim[\s\S]*status = 'approved'/u);
    expect(baseMigration).not.toContain('drop column if exists status');
    expect(profile).toContain('Request your squad player record');
    expect(profile).toContain('AWAITING ADMIN REVIEW');
    expect(panel).toContain('Player profile requests');
    expect(panel).toContain('Assign squad player');
    expect(api).toContain("body.action === 'review-player-claim'");
    expect(api).toContain("body.action === 'assign-player'");
    expect(api).toContain('assertCanManage(actor, target)');
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
    const bootstrapOwner = read('api/auth/bootstrap-owner.js');
    expect(panel).toContain('Member administration');
    expect(panel).toContain('Send reset');
    expect(panel).toContain('Confirm delete');
    expect(api).toContain('requireAccountAdmin');
    expect(api).toContain('Only the account owner can promote another admin.');
    expect(server).toContain("profile?.role !== 'admin'");
    expect(server).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(server).not.toContain('VITE_SUPABASE_SERVICE_ROLE_KEY');
    expect(bootstrapOwner).toContain('configuredAccountOwnerEmail');
    expect(bootstrapOwner).toContain("profile.role !== 'admin'");
    expect(bootstrapOwner).toContain("response.status(200).json({ promoted: false })");
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
