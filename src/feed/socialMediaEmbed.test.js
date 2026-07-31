import { describe, expect, it } from 'vitest';
import {
  tiktokEmbedUrl,
  tiktokVideoId,
  youtubeEmbedUrl,
  youtubeFallbackPosterUrl,
  youtubePosterUrl,
  youtubeVideoId,
} from './socialMediaEmbed';

describe('social feed media embeds', () => {
  it('resolves a YouTube player and a durable thumbnail fallback', () => {
    const post = {
      linkUrl: 'https://www.youtube.com/watch?v=JEnVPcwJiFU',
      sourceImageUrl: '',
      sourceKey: 'youtube:JEnVPcwJiFU',
      sourceMetadata: {},
    };
    expect(youtubeVideoId(post)).toBe('JEnVPcwJiFU');
    expect(youtubePosterUrl(post)).toBe(
      'https://i.ytimg.com/vi/JEnVPcwJiFU/hqdefault.jpg',
    );
    expect(youtubeFallbackPosterUrl(post)).toBe(
      'https://i.ytimg.com/vi/JEnVPcwJiFU/hqdefault.jpg',
    );
    expect(youtubeEmbedUrl(post)).toBe(
      'https://www.youtube-nocookie.com/embed/JEnVPcwJiFU?autoplay=1&controls=1&playsinline=1&rel=0',
    );
  });

  it('accepts only the official TikTok video embed supplied by Display API', () => {
    const post = {
      linkUrl: 'https://www.tiktok.com/@goonsquad.bhc/video/7481234567890123456',
      sourceKey: 'tiktok:7481234567890123456',
      sourceMetadata: {
        embedLink: 'https://www.tiktok.com/static/profile-video?id=7481234567890123456&hide_author=1',
      },
    };
    expect(tiktokVideoId(post)).toBe('7481234567890123456');
    expect(tiktokEmbedUrl(post)).toBe(
      'https://www.tiktok.com/static/profile-video?id=7481234567890123456&hide_author=1',
    );
    expect(tiktokEmbedUrl({
      ...post,
      sourceMetadata: {
        embedLink: 'https://example.com/static/profile-video?id=7481234567890123456',
      },
    })).toBe('');
  });
});
