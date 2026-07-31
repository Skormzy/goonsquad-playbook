const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/u;
const TIKTOK_VIDEO_ID = /^\d{10,30}$/u;

function safeUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export function youtubeVideoId(post) {
  const candidates = [
    post?.sourceMetadata?.videoId,
    String(post?.sourceKey || '').replace(/^youtube:/u, ''),
  ];
  const link = safeUrl(post?.linkUrl);
  if (link) {
    if (link.hostname === 'youtu.be') {
      candidates.push(link.pathname.split('/').filter(Boolean)[0]);
    }
    if (link.hostname === 'youtube.com' || link.hostname.endsWith('.youtube.com')) {
      candidates.push(
        link.searchParams.get('v'),
        link.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/u)?.[1],
      );
    }
  }
  return candidates
    .map((candidate) => String(candidate || '').trim())
    .find((candidate) => YOUTUBE_VIDEO_ID.test(candidate)) || '';
}

export function youtubePosterUrl(post) {
  const videoId = youtubeVideoId(post);
  return post?.sourceImageUrl || (
    videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ''
  );
}

export function youtubeFallbackPosterUrl(post) {
  const videoId = youtubeVideoId(post);
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';
}

export function youtubeEmbedUrl(post) {
  const videoId = youtubeVideoId(post);
  if (!videoId) return '';
  const params = new URLSearchParams({
    autoplay: '1',
    controls: '1',
    playsinline: '1',
    rel: '0',
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
}

export function tiktokVideoId(post) {
  const candidates = [
    post?.sourceMetadata?.videoId,
    String(post?.sourceKey || '').replace(/^tiktok:/u, ''),
  ];
  const link = safeUrl(post?.linkUrl);
  if (link && (link.hostname === 'tiktok.com' || link.hostname.endsWith('.tiktok.com'))) {
    candidates.push(link.pathname.match(/\/video\/(\d+)/u)?.[1]);
  }
  return candidates
    .map((candidate) => String(candidate || '').trim())
    .find((candidate) => TIKTOK_VIDEO_ID.test(candidate)) || '';
}

export function tiktokEmbedUrl(post) {
  const rawEmbed = (
    post?.sourceMetadata?.embedLink
    || post?.sourceMetadata?.embed_link
    || ''
  );
  const embed = safeUrl(rawEmbed);
  if (
    embed?.protocol === 'https:'
    && (embed.hostname === 'tiktok.com' || embed.hostname.endsWith('.tiktok.com'))
    && embed.pathname === '/static/profile-video'
    && TIKTOK_VIDEO_ID.test(embed.searchParams.get('id') || '')
  ) {
    return embed.toString();
  }
  return '';
}
