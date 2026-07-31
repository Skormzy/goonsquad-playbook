import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';
import snapshot from '../src/stats/yorkCentralSnapshot.json' with { type: 'json' };

const DEFAULT_BACKFILL_SINCE = '2026-01-01T00:00:00.000Z';
const TORONTO_TIME_ZONE = 'America/Toronto';
const MAX_BODY_LENGTH = 3000;
const MAX_SOURCE_TITLE_LENGTH = 240;
const YOUTUBE_PUBLIC_RECENT_LIMIT = 12;
const YOUTUBE_PUBLIC_MAX_REQUESTS = 12;
const YOUTUBE_ACTIVITY_STATE_URL = new URL(
  '../src/feed/officialYoutubeActivity.json',
  import.meta.url,
);

async function loadLocalEnvironment() {
  try {
    const contents = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
    for (const line of contents.split(/\r?\n/u)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/u);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/u, '$2');
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function clean(value) {
  return String(value ?? '').replace(/\s+/gu, ' ').trim();
}

function truncate(value, limit) {
  const text = clean(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function extractAssignedJson(text, marker) {
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return null;
  const startIndex = text.indexOf('{', markerIndex + marker.length);
  if (startIndex < 0) return null;
  let depth = 0;
  let escaped = false;
  let insideString = false;
  for (let index = startIndex; index < text.length; index += 1) {
    const character = text[index];
    if (insideString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') insideString = false;
      continue;
    }
    if (character === '"') {
      insideString = true;
      continue;
    }
    if (character === '{') depth += 1;
    if (character !== '}') continue;
    depth -= 1;
    if (depth !== 0) continue;
    return JSON.parse(text.slice(startIndex, index + 1));
  }
  return null;
}

function collectByKey(node, key, output = []) {
  if (!node || typeof node !== 'object') return output;
  if (Object.hasOwn(node, key)) output.push(node[key]);
  Object.values(node).forEach((value) => collectByKey(value, key, output));
  return output;
}

function normalizeYoutubeHandle(value) {
  const input = clean(value);
  if (!input) return '';
  try {
    const url = new URL(input);
    return url.pathname.split('/').find((part) => part.startsWith('@')) || '';
  } catch {
    return input.startsWith('@') ? input : `@${input}`;
  }
}

async function mapInBatches(items, batchSize, mapper) {
  const mapped = [];
  for (let index = 0; index < items.length; index += batchSize) {
    mapped.push(...await Promise.all(items.slice(index, index + batchSize).map(mapper)));
  }
  return mapped;
}

function textFromYoutubeRuns(value) {
  if (value?.simpleText) return clean(value.simpleText);
  return clean(value?.runs?.map((run) => run.text).join(' '));
}

async function loadYoutubeActivityState() {
  try {
    const state = JSON.parse(await readFile(YOUTUBE_ACTIVITY_STATE_URL, 'utf8'));
    return Array.isArray(state.items) ? state.items : [];
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

async function saveYoutubeActivityState(items, { channelHandle, channelId }) {
  const sortedItems = dedupeFeedItems(items).filter(
    (item) => item.sourceType === 'youtube',
  );
  await writeFile(YOUTUBE_ACTIVITY_STATE_URL, `${JSON.stringify({
    channelId,
    channelHandle: normalizeYoutubeHandle(channelHandle),
    items: sortedItems,
  }, null, 2)}\n`, 'utf8');
}

function scheduleName(team) {
  const label = clean(team?.scheduleLabel || team?.name);
  if (/MON|THU/iu.test(label)) return 'Monday League';
  if (/SUN/iu.test(label)) return 'Sunday League';
  return label || 'Goon Squad';
}

function localDateTimeToUtc(value, timeZone = TORONTO_TIME_ZONE) {
  if (!value) return null;
  const localMatch = String(value).match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/u,
  );
  if (!localMatch) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const [, year, month, day, hour, minute, second = '00'] = localMatch;
  const localAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(localAsUtc))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  const represented = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return new Date(localAsUtc - (represented - localAsUtc)).toISOString();
}

function gameOutcome(game) {
  if (game.goalsFor > game.goalsAgainst) return 'win';
  if (game.goalsFor < game.goalsAgainst) return 'loss';
  return 'tie';
}

function playerGameLeaders(dataset, gameId) {
  const playerById = new Map(dataset.players.map((player) => [player.id, player]));
  return dataset.playerGameStats
    .filter((line) => line.gameId === gameId)
    .map((line) => ({
      ...line,
      displayName: playerById.get(line.playerId)?.displayName || '',
      points: Number(line.goals || 0) + Number(line.assists || 0),
    }))
    .filter((line) => line.displayName && line.points > 0)
    .sort((left, right) => (
      right.points - left.points
      || right.goals - left.goals
      || left.displayName.localeCompare(right.displayName)
    ))
    .slice(0, 3);
}

function leaderLine(leaders) {
  if (!leaders.length) return '';
  const stat = (leader) => [
    leader.goals ? `${leader.goals}G` : '',
    leader.assists ? `${leader.assists}A` : '',
  ].filter(Boolean).join(' · ');
  return `Leaders: ${leaders.map((leader) => `${leader.displayName} ${stat(leader)}`).join('  |  ')}`;
}

export function buildResultFeedItems(
  dataset,
  { since = DEFAULT_BACKFILL_SINCE } = {},
) {
  const sinceTime = new Date(since).getTime();
  const teamById = new Map(dataset.teams.map((team) => [team.id, team]));
  const teamStatsByGame = new Map(
    dataset.teamGameStats.map((line) => [line.gameId, line]),
  );

  return dataset.games
    .filter((game) => {
      if (game.status !== 'final' || !game.sourceUrl) return false;
      const scheduledAt = localDateTimeToUtc(game.scheduledAt);
      return scheduledAt && new Date(scheduledAt).getTime() >= sinceTime;
    })
    .map((game) => {
      const team = teamById.get(game.seasonTeamId);
      const stats = teamStatsByGame.get(game.id);
      const outcome = gameOutcome(game);
      const scheduledAt = localDateTimeToUtc(game.scheduledAt);
      const publishedAt = new Date(new Date(scheduledAt).getTime() + 2 * 60 * 60 * 1000)
        .toISOString();
      const details = [];
      if (Number.isFinite(stats?.shotsFor) && Number.isFinite(stats?.shotsAgainst)) {
        details.push(`Shots: ${stats.shotsFor}–${stats.shotsAgainst}`);
      }
      const leaders = playerGameLeaders(dataset, game.id);
      const leadersText = leaderLine(leaders);
      if (leadersText) details.push(leadersText);
      if (game.location) details.push(game.location);

      return {
        sourceKey: `result:${game.id}`,
        sourceType: 'result',
        sourceLabel: `Official result · ${scheduleName(team)}`,
        sourceTitle: `Goon Squad ${game.goalsFor}–${game.goalsAgainst} ${game.opponent}`,
        body: details.join('\n'),
        linkUrl: game.sourceUrl,
        sourceImageUrl: '',
        sourcePublishedAt: publishedAt,
        sourceMetadata: {
          gameId: game.id,
          externalId: game.externalId,
          seasonTeamId: game.seasonTeamId,
          league: scheduleName(team),
          opponent: game.opponent,
          outcome,
          goalsFor: game.goalsFor,
          goalsAgainst: game.goalsAgainst,
          shotsFor: stats?.shotsFor ?? null,
          shotsAgainst: stats?.shotsAgainst ?? null,
          scheduledAt,
          venue: game.venue,
          stage: game.stage,
        },
      };
    });
}

function youtubeFeedItem({
  description = '',
  publishedAt,
  thumbnailUrl = '',
  title,
  videoId,
}) {
  return {
    sourceKey: `youtube:${videoId}`,
    sourceType: 'youtube',
    sourceLabel: 'Goon Squad YouTube',
    sourceTitle: truncate(title, MAX_SOURCE_TITLE_LENGTH),
    body: truncate(description, MAX_BODY_LENGTH),
    linkUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    sourceImageUrl: thumbnailUrl,
    sourcePublishedAt: new Date(publishedAt).toISOString(),
    sourceMetadata: { videoId },
  };
}

export function youtubeItemsFromApiResponse(items = []) {
  return items
    .map((item) => {
      const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
      const snippet = item.snippet || {};
      if (!videoId || !snippet.publishedAt) return null;
      const thumbnails = snippet.thumbnails || {};
      return youtubeFeedItem({
        videoId,
        title: snippet.title,
        description: snippet.description,
        publishedAt: snippet.publishedAt,
        thumbnailUrl: (
          thumbnails.maxres
          || thumbnails.standard
          || thumbnails.high
          || thumbnails.medium
          || thumbnails.default
          || {}
        ).url || '',
      });
    })
    .filter(Boolean);
}

export function youtubeItemFromPlayerResponse(
  response,
  { expectedChannelId = '' } = {},
) {
  const details = response?.videoDetails;
  const microformat = response?.microformat?.playerMicroformatRenderer;
  const publishedAt = microformat?.uploadDate || microformat?.publishDate;
  if (
    !details?.videoId
    || !details?.title
    || !publishedAt
    || (expectedChannelId && details.channelId !== expectedChannelId)
  ) {
    return null;
  }
  const thumbnails = details.thumbnail?.thumbnails || [];
  return youtubeFeedItem({
    videoId: details.videoId,
    title: details.title,
    description: details.shortDescription,
    publishedAt,
    thumbnailUrl: thumbnails.at(-1)?.url || '',
  });
}

export function youtubeItemFromRenderer(
  renderer,
  { publishedAt = new Date().toISOString() } = {},
) {
  if (!renderer?.videoId) return null;
  const title = textFromYoutubeRuns(renderer.title);
  if (!title) return null;
  const thumbnails = renderer.thumbnail?.thumbnails || [];
  return youtubeFeedItem({
    videoId: renderer.videoId,
    title,
    description: textFromYoutubeRuns(renderer.descriptionSnippet),
    publishedAt,
    thumbnailUrl: thumbnails.at(-1)?.url || '',
  });
}

export function youtubeRendererFromLockup(lockup) {
  const thumbnails = lockup?.contentImage?.thumbnailViewModel?.image?.sources || [];
  const thumbnailVideoId = thumbnails
    .map((thumbnail) => thumbnail.url?.match(/\/vi\/([A-Za-z0-9_-]{11})\//u)?.[1])
    .find(Boolean);
  const endpointVideoId = collectByKey(lockup, 'videoId')
    .find((value) => /^[A-Za-z0-9_-]{11}$/u.test(value));
  const videoId = thumbnailVideoId || endpointVideoId;
  const title = clean(lockup?.metadata?.lockupMetadataViewModel?.title?.content);
  if (!videoId || !title) return null;
  return {
    videoId,
    title: { simpleText: title },
    descriptionSnippet: { simpleText: '' },
    thumbnail: { thumbnails },
  };
}

async function youtubeItemsFromPublicChannel({
  channelHandle,
  channelId,
  fullScan,
  persistState,
  recentLimit = YOUTUBE_PUBLIC_RECENT_LIMIT,
  since,
}) {
  const normalizedHandle = normalizeYoutubeHandle(channelHandle);
  if (!normalizedHandle) throw new Error('The YouTube channel handle is invalid.');
  const headers = {
    'accept-language': 'en-CA,en;q=0.9',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36',
  };
  const channelUrls = [
    `https://www.youtube.com/${encodeURI(normalizedHandle)}/videos?hl=en&gl=CA`,
    channelId
      ? `https://www.youtube.com/channel/${encodeURIComponent(channelId)}/videos?hl=en&gl=CA`
      : '',
    `https://m.youtube.com/${encodeURI(normalizedHandle)}/videos?hl=en&gl=CA`,
  ].filter(Boolean);
  let channelHtml = '';
  let initialData = null;
  for (const channelUrl of channelUrls) {
    let response;
    try {
      response = await fetch(channelUrl, { headers });
    } catch {
      continue;
    }
    if (!response.ok) continue;
    const html = await response.text();
    const data = (
      extractAssignedJson(html, 'var ytInitialData =')
      || extractAssignedJson(html, 'window["ytInitialData"] =')
    );
    if (!data) continue;
    channelHtml = html;
    initialData = data;
    if (collectByKey(data, 'videoId').length) break;
  }
  if (!initialData) throw new Error('YouTube channel catalogue was not found.');

  const rendererByVideoId = new Map();
  const rememberRenderers = (payload) => {
    collectByKey(payload, 'videoRenderer').forEach((renderer) => {
      if (renderer?.videoId) rendererByVideoId.set(renderer.videoId, renderer);
    });
    collectByKey(payload, 'lockupViewModel')
      .map(youtubeRendererFromLockup)
      .filter(Boolean)
      .forEach((renderer) => rendererByVideoId.set(renderer.videoId, renderer));
  };
  rememberRenderers(initialData);
  const videoIds = new Set(
    [...rendererByVideoId.keys(), ...collectByKey(initialData, 'videoId')]
      .filter((value) => /^[A-Za-z0-9_-]{11}$/u.test(value)),
  );
  if (!videoIds.size) {
    throw new Error('YouTube returned a channel page without any public uploads.');
  }

  if (fullScan) {
    const apiKey = channelHtml.match(/"INNERTUBE_API_KEY":"([^"]+)"/u)?.[1];
    const clientVersion = channelHtml.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/u)?.[1];
    const visitorData = channelHtml.match(/"VISITOR_DATA":"([^"]+)"/u)?.[1];
    const pendingTokens = collectByKey(initialData, 'continuationItemRenderer')
      .map((item) => item?.continuationEndpoint?.continuationCommand?.token)
      .filter(Boolean);
    const visitedTokens = new Set();
    let requestCount = 0;
    while (
      apiKey
      && clientVersion
      && visitorData
      && pendingTokens.length
      && requestCount < YOUTUBE_PUBLIC_MAX_REQUESTS
      && videoIds.size < 250
    ) {
      const token = pendingTokens.shift();
      if (!token || visitedTokens.has(token)) continue;
      visitedTokens.add(token);
      const response = await fetch(
        `https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: {
            ...headers,
            'content-type': 'application/json',
            'x-goog-visitor-id': decodeURIComponent(visitorData),
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: 'WEB',
                clientVersion,
                visitorData: decodeURIComponent(visitorData),
              },
            },
            continuation: token,
          }),
        },
      );
      requestCount += 1;
      if (!response.ok) continue;
      const payload = await response.json();
      rememberRenderers(payload);
      collectByKey(payload, 'videoId')
        .filter((value) => /^[A-Za-z0-9_-]{11}$/u.test(value))
        .forEach((value) => videoIds.add(value));
      collectByKey(payload, 'continuationItemRenderer')
        .map((item) => item?.continuationEndpoint?.continuationCommand?.token)
        .filter(Boolean)
        .forEach((value) => pendingTokens.push(value));
    }
  }

  const selectedIds = fullScan
    ? [...videoIds]
    : [...videoIds].slice(0, recentLimit);
  const stateItems = await loadYoutubeActivityState();
  const stateByVideoId = new Map(
    stateItems.map((item) => [
      item.sourceMetadata?.videoId || item.sourceKey?.replace(/^youtube:/u, ''),
      item,
    ]),
  );
  const items = await mapInBatches(selectedIds, 6, async (videoId) => {
    const savedItem = stateByVideoId.get(videoId);
    if (!fullScan && savedItem) return savedItem;
    const response = await fetch(
      `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      { headers },
    );
    if (response.ok) {
      const html = await response.text();
      const playerResponse = (
        extractAssignedJson(html, 'var ytInitialPlayerResponse =')
        || extractAssignedJson(html, 'ytInitialPlayerResponse =')
      );
      const exactItem = youtubeItemFromPlayerResponse(playerResponse, {
        expectedChannelId: channelId,
      });
      if (exactItem) return exactItem;
    }
    return savedItem || youtubeItemFromRenderer(
      rendererByVideoId.get(videoId),
    );
  });
  const resolvedItems = items.filter(Boolean);
  if (!resolvedItems.length) {
    throw new Error(
      `YouTube exposed ${selectedIds.length} uploads without usable metadata.`,
    );
  }
  const nextStateItems = dedupeFeedItems([...stateItems, ...resolvedItems]);
  const stateChanged = JSON.stringify(nextStateItems) !== JSON.stringify(
    dedupeFeedItems(stateItems),
  );
  if (persistState && stateChanged) {
    await saveYoutubeActivityState(nextStateItems, {
      channelHandle,
      channelId,
    });
  }
  return resolvedItems.filter(
    (item) => item && new Date(item.sourcePublishedAt).getTime() >= since,
  );
}

async function youtubeItemsFromDataApi({ apiKey, channelId, playlistId, since }) {
  let uploadsPlaylistId = playlistId;
  if (!uploadsPlaylistId) {
    const channelUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
    channelUrl.searchParams.set('part', 'contentDetails');
    channelUrl.searchParams.set('id', channelId);
    channelUrl.searchParams.set('key', apiKey);
    const response = await fetch(channelUrl);
    if (!response.ok) throw new Error(`YouTube channel lookup failed (${response.status}).`);
    const payload = await response.json();
    uploadsPlaylistId = payload.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  }
  if (!uploadsPlaylistId) throw new Error('YouTube uploads playlist was not found.');

  const collected = [];
  let pageToken = '';
  let keepPaging = true;
  while (keepPaging) {
    const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    playlistUrl.searchParams.set('part', 'snippet,contentDetails');
    playlistUrl.searchParams.set('playlistId', uploadsPlaylistId);
    playlistUrl.searchParams.set('maxResults', '50');
    playlistUrl.searchParams.set('key', apiKey);
    if (pageToken) playlistUrl.searchParams.set('pageToken', pageToken);
    const response = await fetch(playlistUrl);
    if (!response.ok) throw new Error(`YouTube uploads lookup failed (${response.status}).`);
    const payload = await response.json();
    const items = youtubeItemsFromApiResponse(payload.items);
    collected.push(...items.filter(
      (item) => new Date(item.sourcePublishedAt).getTime() >= since,
    ));
    const oldest = items.at(-1)?.sourcePublishedAt;
    pageToken = payload.nextPageToken || '';
    keepPaging = Boolean(pageToken && (!oldest || new Date(oldest).getTime() >= since));
  }
  return collected;
}

async function youtubeItemsFromRss({ channelId, since }) {
  const response = await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
  );
  if (!response.ok) throw new Error(`YouTube feed lookup failed (${response.status}).`);
  const $ = cheerio.load(await response.text(), { xmlMode: true });
  const items = [];
  $('entry').each((_, entry) => {
    const videoId = clean($(entry).find('yt\\:videoId').first().text());
    const publishedAt = clean($(entry).find('published').first().text());
    if (!videoId || !publishedAt || new Date(publishedAt).getTime() < since) return;
    items.push(youtubeFeedItem({
      videoId,
      title: $(entry).find('title').first().text(),
      description: $(entry).find('media\\:description').first().text(),
      publishedAt,
      thumbnailUrl: $(entry).find('media\\:thumbnail').first().attr('url') || '',
    }));
  });
  return items;
}

export function instagramItemsFromApiResponse(
  items = [],
  { accountLabel = 'Goon Squad Instagram' } = {},
) {
  return items
    .map((item) => {
      if (!item.id || !item.permalink || !item.timestamp) return null;
      const caption = clean(item.caption);
      return {
        sourceKey: `instagram:${item.id}`,
        sourceType: 'instagram',
        sourceLabel: accountLabel,
        sourceTitle: caption
          ? truncate(caption, MAX_SOURCE_TITLE_LENGTH)
          : 'New from Goon Squad on Instagram',
        body: caption,
        linkUrl: item.permalink,
        sourceImageUrl: item.thumbnail_url || item.media_url || '',
        sourcePublishedAt: new Date(item.timestamp).toISOString(),
        sourceMetadata: {
          mediaId: item.id,
          mediaType: item.media_type || '',
        },
      };
    })
    .filter(Boolean);
}

async function instagramItemsFromGraph({
  accessToken,
  accountLabel,
  instagramUserId,
  since,
}) {
  const firstUrl = new URL(`https://graph.facebook.com/${instagramUserId}/media`);
  firstUrl.searchParams.set(
    'fields',
    'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp',
  );
  firstUrl.searchParams.set('limit', '100');
  firstUrl.searchParams.set('access_token', accessToken);
  const collected = [];
  let nextUrl = firstUrl.toString();
  let pages = 0;
  while (nextUrl && pages < 20) {
    const response = await fetch(nextUrl);
    if (!response.ok) throw new Error(`Instagram media lookup failed (${response.status}).`);
    const payload = await response.json();
    const items = instagramItemsFromApiResponse(payload.data, { accountLabel });
    collected.push(...items.filter(
      (item) => new Date(item.sourcePublishedAt).getTime() >= since,
    ));
    const oldest = items.at(-1)?.sourcePublishedAt;
    nextUrl = payload.paging?.next || '';
    if (oldest && new Date(oldest).getTime() < since) nextUrl = '';
    pages += 1;
  }
  return collected;
}

function dedupeFeedItems(items) {
  return [...new Map(items.map((item) => [item.sourceKey, item])).values()]
    .sort((left, right) => (
      new Date(left.sourcePublishedAt) - new Date(right.sourcePublishedAt)
    ));
}

async function collectConfiguredSocialItems(
  since,
  {
    fullYoutubeScan = false,
    persistYoutubeState = false,
  } = {},
) {
  const items = [];
  const warnings = [];
  const youtubeChannelId = process.env.TEAM_YOUTUBE_CHANNEL_ID;
  const youtubeChannelHandle = process.env.TEAM_YOUTUBE_CHANNEL_HANDLE;
  if (youtubeChannelId || youtubeChannelHandle) {
    try {
      if (process.env.YOUTUBE_API_KEY && youtubeChannelId) {
        items.push(...await youtubeItemsFromDataApi({
          apiKey: process.env.YOUTUBE_API_KEY,
          channelId: youtubeChannelId,
          playlistId: process.env.TEAM_YOUTUBE_PLAYLIST_ID,
          since,
        }));
      } else {
        let rssItems = [];
        if (youtubeChannelId) {
          try {
            rssItems = await youtubeItemsFromRss({
              channelId: youtubeChannelId,
              since,
            });
          } catch {
            // Some public channels do not expose an RSS feed. The channel-page
            // fallback below uses the same public videos that viewers see.
          }
        }
        items.push(...(
          rssItems.length
            ? rssItems
            : await youtubeItemsFromPublicChannel({
              channelHandle: youtubeChannelHandle,
              channelId: youtubeChannelId,
              fullScan: fullYoutubeScan,
              persistState: persistYoutubeState,
              recentLimit: Number(process.env.TEAM_YOUTUBE_RECENT_LIMIT)
                || YOUTUBE_PUBLIC_RECENT_LIMIT,
              since,
            })
        ));
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }
  }

  const instagramUserId = process.env.TEAM_INSTAGRAM_USER_ID;
  const instagramAccessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (instagramUserId && instagramAccessToken) {
    try {
      items.push(...await instagramItemsFromGraph({
        accessToken: instagramAccessToken,
        accountLabel: process.env.TEAM_INSTAGRAM_LABEL || 'Goon Squad Instagram',
        instagramUserId,
        since,
      }));
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { items, warnings };
}

async function readIngestToken() {
  if (process.env.TEAM_FEED_INGEST_TOKEN) {
    return process.env.TEAM_FEED_INGEST_TOKEN.trim();
  }
  try {
    return (await readFile(
      new URL('../.goonsquad-feed-ingest.local', import.meta.url),
      'utf8',
    )).trim();
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return '';
  }
}

async function upsertFeedItems(items) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const publishableKey = (
    process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
  );
  const token = await readIngestToken();
  if (!supabaseUrl || !publishableKey || !token) {
    throw new Error(
      'Configure the Supabase URL, publishable key, and TEAM_FEED_INGEST_TOKEN.',
    );
  }
  const cloud = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let affected = 0;
  for (let index = 0; index < items.length; index += 100) {
    const chunk = items.slice(index, index + 100);
    const { data, error } = await cloud.rpc('goonsquad_feed_upsert', {
      p_token: token,
      p_items: chunk,
    });
    if (error) throw new Error(`Squad Live import failed: ${error.message}`);
    if (data?.processed !== chunk.length) {
      throw new Error(`Squad Live import processed ${data?.processed ?? 0} of ${chunk.length} items.`);
    }
    affected += Number(data?.affected || 0);
  }
  return affected;
}

export async function main() {
  await loadLocalEnvironment();
  const dryRun = process.argv.includes('--dry-run');
  const sinceText = process.env.TEAM_FEED_BACKFILL_SINCE || DEFAULT_BACKFILL_SINCE;
  const since = new Date(sinceText).getTime();
  if (!Number.isFinite(since)) throw new Error('TEAM_FEED_BACKFILL_SINCE is invalid.');
  const resultItems = buildResultFeedItems(snapshot, { since: sinceText });
  const social = await collectConfiguredSocialItems(since, {
    fullYoutubeScan: (
      process.env.TEAM_YOUTUBE_PUBLIC_FULL_SCAN === '1'
      || process.argv.includes('--full-social-backfill')
    ),
    persistYoutubeState: !dryRun,
  });
  const items = dedupeFeedItems([...resultItems, ...social.items]);

  if (dryRun) {
    process.stdout.write(JSON.stringify({
      results: resultItems.length,
      social: social.items.length,
      total: items.length,
      warnings: social.warnings,
      newest: items.at(-1)?.sourceTitle || null,
    }, null, 2));
    process.stdout.write('\n');
    return;
  }

  const affected = await upsertFeedItems(items);
  process.stdout.write(
    `Squad Live synchronized ${items.length} items (${resultItems.length} results, ${social.items.length} social; ${affected} inserted or refreshed).\n`,
  );
  social.warnings.forEach((warning) => process.stderr.write(`Social source warning: ${warning}\n`));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  });
}
