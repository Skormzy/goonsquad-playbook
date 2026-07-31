import {
  getPlaymakerCloudClient,
  playmakerCloudResumableStorageUrl,
} from '../playmaker/playmakerCloud';
import {
  extractFirstUrl,
  extractMentionUsernames,
  FEED_COMMENT_MAX_LENGTH,
  FEED_POST_MAX_LENGTH,
  FEED_REACTION_IDS,
  feedMediaContentType,
  normalizeExternalUrl,
  validateFeedMedia,
} from './feedModel';

const MEDIA_BUCKET = 'team-feed-media';
const RESUMABLE_CHUNK_BYTES = 6 * 1024 * 1024;

function requireCloud() {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) throw new Error('Team accounts are not configured.');
  return cloud;
}

function requireUserId(userId) {
  if (!userId) throw new Error('Sign in to use the team feed.');
  return userId;
}

function throwIfError(error) {
  if (error) throw error;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sortPosts(posts) {
  return [...posts].sort((left, right) => {
    const pinned = Number(Boolean(right.pinnedAt)) - Number(Boolean(left.pinnedAt));
    if (pinned) return pinned;
    return new Date(right.pinnedAt || right.sourcePublishedAt || right.createdAt)
      - new Date(left.pinnedAt || left.sourcePublishedAt || left.createdAt);
  });
}

function mediaExtension(file) {
  const fromName = String(file?.name || '').split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/u.test(fromName)) return fromName;
  return ({
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  })[file?.type] || 'bin';
}

async function signedMediaUrls(cloud, paths) {
  const uniquePaths = unique(paths);
  if (!uniquePaths.length) return new Map();
  const { data, error } = await cloud.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(uniquePaths, 60 * 60);
  if (error) return new Map();
  return new Map((data || []).map((item) => [item.path, item.signedUrl]));
}

export async function loadFeedMembers() {
  const cloud = requireCloud();
  const [
    { data: profiles, error: profilesError },
    { data: claims, error: claimsError },
  ] = await Promise.all([
    cloud
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .order('display_name', { ascending: true }),
    cloud
      .from('member_player_claims')
      .select('user_id, player_id, is_primary, status')
      .eq('status', 'approved'),
  ]);
  throwIfError(profilesError);
  throwIfError(claimsError);
  const primaryPlayerByUser = new Map(
    (claims || [])
      .filter((claim) => claim.is_primary)
      .map((claim) => [claim.user_id, claim.player_id]),
  );
  return (profiles || []).map((profile) => ({
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name || profile.username,
    avatarUrl: profile.avatar_url || '',
    role: profile.role,
    playerId: primaryPlayerByUser.get(profile.id) || '',
  }));
}

export async function loadTeamFeed({ limit = 140, userId = '' } = {}) {
  const cloud = requireCloud();
  const [{ data: postRows, error: postsError }, members] = await Promise.all([
    cloud
      .from('team_feed_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit),
    loadFeedMembers(),
  ]);
  throwIfError(postsError);

  const postIds = (postRows || []).map((post) => post.id);
  if (!postIds.length) {
    return { posts: [], members, unreadMentionCount: 0 };
  }

  const [
    { data: comments, error: commentsError },
    { data: reactions, error: reactionsError },
    { data: mentions, error: mentionsError },
  ] = await Promise.all([
    cloud
      .from('team_feed_comments')
      .select('*')
      .in('post_id', postIds)
      .order('created_at', { ascending: true }),
    cloud
      .from('team_feed_reactions')
      .select('*')
      .in('post_id', postIds),
    cloud
      .from('team_feed_mentions')
      .select('*')
      .in('post_id', postIds),
  ]);
  throwIfError(commentsError);
  throwIfError(reactionsError);
  throwIfError(mentionsError);

  const memberById = new Map(members.map((member) => [member.id, member]));
  const mediaUrls = await signedMediaUrls(
    cloud,
    (postRows || []).map((post) => post.media_path),
  );
  const commentsByPost = new Map();
  (comments || []).forEach((comment) => {
    const existing = commentsByPost.get(comment.post_id) || [];
    existing.push({
      id: comment.id,
      postId: comment.post_id,
      body: comment.body,
      authorId: comment.author_id,
      author: memberById.get(comment.author_id) || null,
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
    });
    commentsByPost.set(comment.post_id, existing);
  });
  const reactionsByPost = new Map();
  (reactions || []).forEach((reaction) => {
    const existing = reactionsByPost.get(reaction.post_id) || [];
    existing.push({
      userId: reaction.user_id,
      reaction: reaction.reaction,
      createdAt: reaction.created_at,
    });
    reactionsByPost.set(reaction.post_id, existing);
  });
  const mentionsByPost = new Map();
  (mentions || []).forEach((mention) => {
    const existing = mentionsByPost.get(mention.post_id) || [];
    existing.push({
      id: mention.id,
      commentId: mention.comment_id,
      mentionedUserId: mention.mentioned_user_id,
      createdBy: mention.created_by,
      readAt: mention.read_at,
    });
    mentionsByPost.set(mention.post_id, existing);
  });

  const posts = sortPosts((postRows || []).map((post) => ({
    id: post.id,
    body: post.body,
    linkUrl: post.link_url || '',
    mediaPath: post.media_path || '',
    mediaKind: post.media_kind || '',
    mediaUrl: mediaUrls.get(post.media_path) || '',
    sourceType: post.source_type || 'member',
    sourceKey: post.source_key || '',
    sourceLabel: post.source_label || '',
    sourceTitle: post.source_title || '',
    sourceImageUrl: post.source_image_url || '',
    sourcePublishedAt: post.source_published_at || '',
    sourceMetadata: post.source_metadata || {},
    authorId: post.author_id,
    author: memberById.get(post.author_id) || null,
    pinnedAt: post.pinned_at,
    pinnedBy: post.pinned_by,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
    comments: commentsByPost.get(post.id) || [],
    reactions: reactionsByPost.get(post.id) || [],
    mentions: mentionsByPost.get(post.id) || [],
  })));

  return {
    posts,
    members,
    unreadMentionCount: (mentions || []).filter(
      (mention) => mention.mentioned_user_id === userId && !mention.read_at,
    ).length,
  };
}

function resumableStorageEndpoint() {
  const endpoint = playmakerCloudResumableStorageUrl();
  if (!endpoint) {
    throw new Error('Video storage is not configured correctly.');
  }
  return endpoint;
}

async function resumableUpload(cloud, path, file, onProgress) {
  const { Upload } = await import('tus-js-client');
  const { data, error } = await cloud.auth.getSession();
  throwIfError(error);
  if (!data.session?.access_token) throw new Error('Sign in again before uploading this video.');

  return new Promise((resolve, reject) => {
    let uploadedPath = path;
    const upload = new Upload(file, {
      endpoint: resumableStorageEndpoint(),
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${data.session.access_token}`,
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: RESUMABLE_CHUNK_BYTES,
      metadata: {
        bucketName: MEDIA_BUCKET,
        objectName: path,
        contentType: feedMediaContentType(file),
        cacheControl: '3600',
      },
      onError: reject,
      onProgress(bytesUploaded, bytesTotal) {
        const progress = bytesTotal > 0
          ? Math.min(100, Math.round((bytesUploaded / bytesTotal) * 100))
          : 0;
        onProgress?.(progress);
      },
      onSuccess() {
        onProgress?.(100);
        resolve(uploadedPath);
      },
    });

    upload.findPreviousUploads()
      .then((previousUploads) => {
        if (previousUploads.length) {
          uploadedPath = previousUploads[0].metadata?.objectName || path;
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      })
      .catch(() => upload.start());
  });
}

async function uploadFeedMedia(cloud, userId, file, onProgress) {
  const validation = validateFeedMedia(file);
  if (!validation.valid) throw new Error(validation.message);
  if (!file) return { mediaPath: null, mediaKind: null };
  const path = `${userId}/${crypto.randomUUID()}.${mediaExtension(file)}`;
  const contentType = feedMediaContentType(file);
  onProgress?.(0);
  if (validation.kind === 'video' || file.size > RESUMABLE_CHUNK_BYTES) {
    const uploadedPath = await resumableUpload(cloud, path, file, onProgress);
    return { mediaPath: uploadedPath, mediaKind: validation.kind };
  }
  const { error } = await cloud.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType,
      upsert: false,
    });
  throwIfError(error);
  onProgress?.(100);
  return { mediaPath: path, mediaKind: validation.kind };
}

async function createMentions(cloud, {
  body,
  members,
  postId,
  commentId = null,
  userId,
}) {
  const mentioned = new Set(extractMentionUsernames(body));
  const rows = members
    .filter((member) => mentioned.has(String(member.username || '').toLowerCase()))
    .map((member) => ({
      post_id: postId,
      comment_id: commentId,
      mentioned_user_id: member.id,
      created_by: userId,
    }));
  if (!rows.length) return;
  const { error } = await cloud.from('team_feed_mentions').insert(rows);
  throwIfError(error);
}

export async function createTeamFeedPost({
  body,
  file = null,
  linkUrl = '',
  members = [],
  onUploadProgress,
  userId,
}) {
  const cloud = requireCloud();
  requireUserId(userId);
  const cleanBody = String(body || '').trim().slice(0, FEED_POST_MAX_LENGTH);
  const normalizedLink = normalizeExternalUrl(linkUrl || extractFirstUrl(cleanBody)) || null;
  const media = await uploadFeedMedia(cloud, userId, file, onUploadProgress);
  let postId = '';
  try {
    const { data, error } = await cloud
      .from('team_feed_posts')
      .insert({
        author_id: userId,
        body: cleanBody,
        link_url: normalizedLink,
        media_path: media.mediaPath,
        media_kind: media.mediaKind,
      })
      .select('id')
      .single();
    throwIfError(error);
    postId = data.id;
    await createMentions(cloud, {
      body: cleanBody,
      members,
      postId,
      userId,
    });
    return postId;
  } catch (error) {
    if (postId) {
      await cloud.from('team_feed_posts').delete().eq('id', postId);
    }
    if (media.mediaPath) {
      await cloud.storage.from(MEDIA_BUCKET).remove([media.mediaPath]);
    }
    throw error;
  }
}

export async function createTeamFeedComment({
  body,
  members = [],
  postId,
  userId,
}) {
  const cloud = requireCloud();
  requireUserId(userId);
  const cleanBody = String(body || '').trim().slice(0, FEED_COMMENT_MAX_LENGTH);
  if (!cleanBody) throw new Error('Write a comment first.');
  let commentId = '';
  try {
    const { data, error } = await cloud
      .from('team_feed_comments')
      .insert({
        post_id: postId,
        author_id: userId,
        body: cleanBody,
      })
      .select('id')
      .single();
    throwIfError(error);
    commentId = data.id;
    await createMentions(cloud, {
      body: cleanBody,
      members,
      postId,
      commentId,
      userId,
    });
    return commentId;
  } catch (error) {
    if (commentId) {
      await cloud.from('team_feed_comments').delete().eq('id', commentId);
    }
    throw error;
  }
}

export async function setTeamFeedReaction({
  currentReaction = '',
  postId,
  reaction,
  userId,
}) {
  const cloud = requireCloud();
  requireUserId(userId);
  if (!FEED_REACTION_IDS.includes(reaction)) {
    throw new Error('Choose a supported reaction.');
  }
  const query = cloud.from('team_feed_reactions');
  const { error } = currentReaction === reaction
    ? await query.delete().eq('post_id', postId).eq('user_id', userId)
    : await query.upsert(
      { post_id: postId, user_id: userId, reaction },
      { onConflict: 'post_id,user_id' },
    );
  throwIfError(error);
}

export async function deleteTeamFeedPost({ mediaPath = '', postId }) {
  const cloud = requireCloud();
  const { error } = await cloud.from('team_feed_posts').delete().eq('id', postId);
  throwIfError(error);
  if (mediaPath) await cloud.storage.from(MEDIA_BUCKET).remove([mediaPath]);
}

export async function deleteTeamFeedComment(commentId) {
  const cloud = requireCloud();
  const { error } = await cloud.from('team_feed_comments').delete().eq('id', commentId);
  throwIfError(error);
}

export async function setTeamFeedPostPinned({ pinned, postId, userId }) {
  const cloud = requireCloud();
  requireUserId(userId);
  const { error } = await cloud
    .from('team_feed_posts')
    .update({
      pinned_at: pinned ? null : new Date().toISOString(),
      pinned_by: pinned ? null : userId,
    })
    .eq('id', postId);
  throwIfError(error);
}

export async function markTeamFeedMentionsRead(userId) {
  const cloud = requireCloud();
  requireUserId(userId);
  const { error } = await cloud
    .from('team_feed_mentions')
    .update({ read_at: new Date().toISOString() })
    .eq('mentioned_user_id', userId)
    .is('read_at', null);
  throwIfError(error);
}

export function subscribeTeamFeed(onChange) {
  const cloud = requireCloud();
  const channel = cloud
    .channel(`team-feed-${crypto.randomUUID()}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'team_feed_posts',
    }, onChange)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'team_feed_comments',
    }, onChange)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'team_feed_reactions',
    }, onChange)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'team_feed_mentions',
    }, onChange)
    .subscribe();
  return () => {
    cloud.removeChannel(channel);
  };
}
