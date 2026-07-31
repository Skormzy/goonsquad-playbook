import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const home = read('src/feed/TeamHome.jsx');
const cloud = read('src/feed/feedCloud.js');
const migration = read('supabase/migrations/20260730_team_feed.sql');
const desktopNav = read('src/components/WorkspaceSwitcher.jsx');
const mobileNav = read('src/components/MobileBottomNav.jsx');

describe('Squad Live product contract', () => {
  it('keeps public performance visible while the team conversation stays private', () => {
    expect(home).toContain('<TeamPulse');
    expect(home).toContain('account.hasTeamAccess ? (');
    expect(home).toContain('<LockedFeed');
    expect(home).toContain('The locker room stays with the team.');
    expect(home).toContain('loadTeamFeed({ userId: currentUserId })');
  });

  it('supports the expected member feed interactions without exposing public media URLs', () => {
    expect(cloud).toContain("createSignedUrls(uniquePaths, 60 * 60)");
    expect(cloud).toContain("table: 'team_feed_posts'");
    expect(cloud).toContain("table: 'team_feed_comments'");
    expect(cloud).toContain("table: 'team_feed_likes'");
    expect(cloud).toContain("table: 'team_feed_mentions'");
    expect(home).toContain('Post to the team');
    expect(home).toContain('Tag a teammate');
    expect(home).toContain('Pin for team');
  });

  it('enforces approved-member access in Postgres and private object storage', () => {
    expect(migration).toContain('create or replace function public.is_approved_team_member');
    expect(migration).toContain("status = 'approved'");
    expect(migration).toContain("create policy \"Approved members read feed posts\"");
    expect(migration).toContain("create policy \"Authors delete feed posts\"");
    expect(migration).toContain("'team-feed-media'");
    expect(migration).toContain('false,');
    expect(migration).toContain("create policy \"Approved members read team feed media\"");
  });

  it('gives Home and Stats their own destinations on desktop and mobile', () => {
    expect(desktopNav).toContain("onContentChange('home')");
    expect(desktopNav).toContain("onContentChange('stats')");
    expect(mobileNav).toContain("content: 'home'");
    expect(mobileNav).toContain("content: 'stats'");
  });
});
