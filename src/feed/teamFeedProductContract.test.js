import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const home = read('src/feed/TeamHome.jsx');
const styles = read('src/feed/feed.css');
const cloud = read('src/feed/feedCloud.js');
const migration = read('supabase/migrations/20260730_team_feed.sql');
const activityMigration = read('supabase/migrations/20260730_team_feed_activity.sql');
const tiktokMigration = read('supabase/migrations/20260731_team_feed_tiktok.sql');
const desktopNav = read('src/components/WorkspaceSwitcher.jsx');
const mobileNav = read('src/components/MobileBottomNav.jsx');
const deployment = read('vercel.json');

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
    expect(cloud).toContain("table: 'team_feed_reactions'");
    expect(cloud).toContain("table: 'team_feed_mentions'");
    expect(home).toContain('Post to the team');
    expect(home).toContain('Tag a teammate');
    expect(home).toContain('Pin for team');
  });

  it('uses resumable mobile uploads and permits private Supabase video playback', () => {
    expect(cloud).toContain("import('tus-js-client')");
    expect(cloud).toContain('chunkSize: RESUMABLE_CHUNK_BYTES');
    expect(cloud).toContain('findPreviousUploads()');
    expect(cloud).toContain('previousUploads[0].metadata?.objectName');
    expect(home).toContain('Media upload progress');
    expect(home).toContain('Open in native player');
    expect(deployment).toContain("media-src 'self' blob: https://*.supabase.co");
  });

  it('treats official results and social posts as deduplicated feed activity', () => {
    expect(activityMigration).toContain('source_key text');
    expect(activityMigration).toContain('team_feed_posts_source_key_unique_idx');
    expect(activityMigration).toContain('public.goonsquad_feed_upsert');
    expect(activityMigration).toContain("'result',");
    expect(activityMigration).toContain("'instagram',");
    expect(activityMigration).toContain("'youtube',");
    expect(activityMigration).toContain('team_feed_reactions');
    expect(home).toContain('<OfficialResultCard post={post} />');
    expect(home).toContain('feedGameDetailsHref(details.gameId || sourceGameId)');
    expect(home).toContain('Open game details');
    expect(home).toContain('<SocialVideoCard post={post} />');
    expect(home).toContain('FEED_REACTIONS.map');
  });

  it('supports direct social playback without widening trusted origins', () => {
    expect(tiktokMigration).toContain("'tiktok',");
    expect(tiktokMigration).toContain('public.goonsquad_feed_upsert');
    expect(home).toContain("post.sourceType === 'tiktok'");
    expect(deployment).toContain('https://i.ytimg.com');
    expect(deployment).toContain('https://www.youtube-nocookie.com');
    expect(deployment).toContain('https://www.tiktok.com');
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

  it('keeps Game Pulse fixed while feed and attendance scroll independently', () => {
    expect(home).toContain('ref={feedScrollRef}');
    expect(home).toContain('ref={sideScrollRef}');
    expect(home).toContain('Back to top of Squad Live');
    expect(home).toContain('Back to top of attendance');
    expect(styles).toContain('@media (min-width: 761px)');
    expect(styles).toContain('.team-home-scroll-region > .team-feed-column');
    expect(styles).toContain('.team-home-attendance-scroll');
    expect(styles).toContain('grid-template-rows: auto minmax(0, 1fr)');
    expect(styles).toContain('overflow-y: auto');
    expect(styles).toContain('overscroll-behavior: contain');
    expect(styles).toContain('scrollbar-gutter: stable');
  });

  it('preserves one natural page scroll and a return-to-top action on mobile', () => {
    expect(home).toContain('ref={homeScrollRef}');
    expect(home).toContain('variant="page"');
    expect(styles).toContain('.team-home-scroll-top.is-page');
    expect(styles).toContain('bottom: calc(var(--mobile-bottom-nav-height, 62px) + 12px)');
    expect(styles).toContain('.team-home-scroll-top.is-pane');
  });
});
