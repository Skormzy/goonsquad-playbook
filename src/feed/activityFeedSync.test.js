import { describe, expect, it } from 'vitest';
import {
  buildResultFeedItems,
  instagramItemsFromApiResponse,
  tiktokItemsFromApiResponse,
  youtubeItemFromPlayerResponse,
  youtubeItemFromRenderer,
  youtubeItemsFromApiResponse,
  youtubeRendererFromLockup,
} from '../../scripts/sync-team-feed-activity.mjs';

const dataset = {
  teams: [{
    id: 'summer-2026-mon-thu',
    scheduleLabel: 'MON/THU',
  }],
  players: [{
    id: 'p1',
    displayName: 'Alex Example',
  }],
  games: [{
    id: 'ycbhl-game-123',
    externalId: '123',
    seasonTeamId: 'summer-2026-mon-thu',
    stage: 'regular',
    scheduledAt: '2026-07-30T19:00:00',
    opponent: 'VIPERZ',
    venue: 'home',
    location: 'Stephen Leacock',
    status: 'final',
    goalsFor: 4,
    goalsAgainst: 2,
    sourceUrl: 'https://www.yorkcentralbhl.com/game/123-goonsquad-viperz',
  }],
  teamGameStats: [{
    gameId: 'ycbhl-game-123',
    shotsFor: 21,
    shotsAgainst: 14,
  }],
  playerGameStats: [{
    gameId: 'ycbhl-game-123',
    playerId: 'p1',
    goals: 2,
    assists: 1,
  }],
};

describe('automated Squad Live activity', () => {
  it('turns a verified final into one stable, source-linked result post', () => {
    const [item] = buildResultFeedItems(dataset);
    expect(item).toMatchObject({
      sourceKey: 'result:ycbhl-game-123',
      sourceType: 'result',
      sourceLabel: 'Official result · Monday League',
      sourceTitle: 'Goon Squad 4–2 VIPERZ',
      linkUrl: 'https://www.yorkcentralbhl.com/game/123-goonsquad-viperz',
      sourceMetadata: {
        outcome: 'win',
        goalsFor: 4,
        goalsAgainst: 2,
        shotsFor: 21,
        shotsAgainst: 14,
      },
    });
    expect(item.body).toContain('Shots: 21–14');
    expect(item.body).toContain('Alex Example 2G · 1A');
  });

  it('filters out scheduled games and finals before the backfill window', () => {
    const scheduled = {
      ...dataset,
      games: [{ ...dataset.games[0], status: 'scheduled' }],
    };
    expect(buildResultFeedItems(scheduled)).toEqual([]);
    expect(buildResultFeedItems(dataset, {
      since: '2026-08-01T00:00:00.000Z',
    })).toEqual([]);
  });

  it('normalizes YouTube uploads into playable source cards', () => {
    const [item] = youtubeItemsFromApiResponse([{
      contentDetails: { videoId: 'video-1' },
      snippet: {
        title: 'Game night',
        description: 'Highlights from the win.',
        publishedAt: '2026-06-01T12:00:00Z',
        thumbnails: { high: { url: 'https://i.ytimg.com/video-1.jpg' } },
      },
    }]);
    expect(item).toMatchObject({
      sourceKey: 'youtube:video-1',
      sourceType: 'youtube',
      sourceTitle: 'Game night',
      linkUrl: 'https://www.youtube.com/watch?v=video-1',
      sourceImageUrl: 'https://i.ytimg.com/video-1.jpg',
    });
  });

  it('normalizes public YouTube watch metadata from the official channel', () => {
    const item = youtubeItemFromPlayerResponse({
      videoDetails: {
        videoId: 'JEnVPcwJiFU',
        title: 'Goon Squad game night',
        shortDescription: 'Full game replay.',
        channelId: 'UCtNyBYGsEMv_puzlZn_yntg',
        thumbnail: {
          thumbnails: [
            { url: 'https://i.ytimg.com/vi/JEnVPcwJiFU/default.jpg' },
            { url: 'https://i.ytimg.com/vi/JEnVPcwJiFU/hqdefault.jpg' },
          ],
        },
      },
      microformat: {
        playerMicroformatRenderer: {
          uploadDate: '2026-07-29T20:59:10-07:00',
        },
      },
    }, {
      expectedChannelId: 'UCtNyBYGsEMv_puzlZn_yntg',
    });

    expect(item).toMatchObject({
      sourceKey: 'youtube:JEnVPcwJiFU',
      sourceType: 'youtube',
      sourceLabel: 'Goon Squad YouTube',
      sourceTitle: 'Goon Squad game night',
      body: 'Full game replay.',
      linkUrl: 'https://www.youtube.com/watch?v=JEnVPcwJiFU',
      sourceImageUrl: 'https://i.ytimg.com/vi/JEnVPcwJiFU/hqdefault.jpg',
      sourceMetadata: { videoId: 'JEnVPcwJiFU' },
    });
  });

  it('rejects public YouTube watch metadata from another channel', () => {
    expect(youtubeItemFromPlayerResponse({
      videoDetails: {
        videoId: 'other-video',
        title: 'Not our upload',
        channelId: 'another-channel',
      },
      microformat: {
        playerMicroformatRenderer: {
          uploadDate: '2026-07-29',
        },
      },
    }, {
      expectedChannelId: 'UCtNyBYGsEMv_puzlZn_yntg',
    })).toBeNull();
  });

  it('uses public channel-card metadata when a runner cannot open watch metadata', () => {
    const item = youtubeItemFromRenderer({
      videoId: 'JEnVPcwJiFU',
      title: {
        runs: [{ text: 'Goon Squad game night' }],
      },
      descriptionSnippet: {
        runs: [{ text: 'Full ' }, { text: 'game replay.' }],
      },
      thumbnail: {
        thumbnails: [
          { url: 'https://i.ytimg.com/vi/JEnVPcwJiFU/mqdefault.jpg' },
        ],
      },
    }, {
      publishedAt: '2026-07-30T03:59:10Z',
    });

    expect(item).toMatchObject({
      sourceKey: 'youtube:JEnVPcwJiFU',
      sourceTitle: 'Goon Squad game night',
      body: 'Full game replay.',
      sourceImageUrl: 'https://i.ytimg.com/vi/JEnVPcwJiFU/mqdefault.jpg',
      sourcePublishedAt: '2026-07-30T03:59:10.000Z',
    });
  });

  it('reads YouTube’s current lockup card format on headless runners', () => {
    expect(youtubeRendererFromLockup({
      contentImage: {
        thumbnailViewModel: {
          image: {
            sources: [{
              url: 'https://i.ytimg.com/vi/JEnVPcwJiFU/hqdefault.jpg',
              width: 336,
              height: 188,
            }],
          },
        },
      },
      metadata: {
        lockupMetadataViewModel: {
          title: {
            content: 'Goon Squad game night',
          },
        },
      },
    })).toMatchObject({
      videoId: 'JEnVPcwJiFU',
      title: { simpleText: 'Goon Squad game night' },
    });
  });

  it('normalizes official Instagram media without inventing account data', () => {
    const [item] = instagramItemsFromApiResponse([{
      id: 'media-1',
      caption: 'Big team win',
      media_type: 'IMAGE',
      media_url: 'https://cdn.example.com/media-1.jpg',
      permalink: 'https://www.instagram.com/p/media-1/',
      timestamp: '2026-05-01T12:00:00Z',
    }], { accountLabel: '@goonsquad' });
    expect(item).toMatchObject({
      sourceKey: 'instagram:media-1',
      sourceType: 'instagram',
      sourceLabel: '@goonsquad',
      sourceTitle: 'Big team win',
      linkUrl: 'https://www.instagram.com/p/media-1/',
    });
  });

  it('normalizes authorized TikTok videos into playable source posts', () => {
    const [item] = tiktokItemsFromApiResponse([{
      id: '7481234567890123456',
      create_time: 1785502800,
      title: 'Game night run',
      video_description: 'A quick look at the latest Goon Squad run.',
      cover_image_url: 'https://p16-sign.tiktokcdn-us.com/team-video.jpg',
      share_url: 'https://www.tiktok.com/@goonsquad.bhc/video/7481234567890123456',
      embed_link: 'https://www.tiktok.com/static/profile-video?id=7481234567890123456&hide_author=1',
      duration: 24,
      width: 1080,
      height: 1920,
    }], {
      accountLabel: '@goonsquad.bhc',
      profileUrl: 'https://www.tiktok.com/@goonsquad.bhc',
    });
    expect(item).toMatchObject({
      sourceKey: 'tiktok:7481234567890123456',
      sourceType: 'tiktok',
      sourceLabel: '@goonsquad.bhc',
      sourceTitle: 'Game night run',
      body: 'A quick look at the latest Goon Squad run.',
      linkUrl: 'https://www.tiktok.com/@goonsquad.bhc/video/7481234567890123456',
      sourceImageUrl: 'https://p16-sign.tiktokcdn-us.com/team-video.jpg',
      sourceMetadata: {
        videoId: '7481234567890123456',
        embedLink: 'https://www.tiktok.com/static/profile-video?id=7481234567890123456&hide_author=1',
        duration: 24,
        width: 1080,
        height: 1920,
      },
    });
  });
});
