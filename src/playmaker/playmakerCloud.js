import { createClient } from '@supabase/supabase-js';
import { normalizeUsername, usernameValidationMessage } from '../account/username';
import { normalizePlaymakerDraft } from './playmakerModel';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  || 'https://efupudunfkdykvqystdc.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'sb_publishable_NYkCHXiYM-eA0BSTCdxaOQ_D_vAFsw8';
const publicAppUrl = import.meta.env.VITE_PUBLIC_APP_URL
  || 'https://goonsquad.app';

export const playmakerCloudConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let client = null;

export function getPlaymakerCloudClient() {
  if (!playmakerCloudConfigured) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

export async function playmakerCloudSession() {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) return null;
  const { data, error } = await cloud.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function watchPlaymakerCloudSession(callback) {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) return () => {};
  const { data } = cloud.auth.onAuthStateChange((event, session) => callback(session, event));
  return () => data.subscription.unsubscribe();
}

function appRedirectUrl(params = {}) {
  const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const origin = String(runtimeOrigin || publicAppUrl).replace(/\/$/u, '');
  const url = new URL(`${origin}/`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

export async function createPlaymakerAccount(email, password, displayName = '', username = '') {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) throw new Error('Cloud accounts are not configured.');
  const normalizedUsername = normalizeUsername(username);
  const usernameError = usernameValidationMessage(normalizedUsername);
  if (usernameError) throw new Error(usernameError);
  const { data, error } = await cloud.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: appRedirectUrl({ content: 'account', auth: 'complete' }),
      data: {
        full_name: String(displayName || '').trim().slice(0, 80),
        username: normalizedUsername,
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signInPlaymakerAccount(email, password) {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) throw new Error('Cloud accounts are not configured.');
  const { data, error } = await cloud.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signInPlaymakerWithGoogle() {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) throw new Error('Cloud accounts are not configured.');
  const { data, error } = await cloud.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: appRedirectUrl({ content: 'account', auth: 'complete' }),
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
  return data;
}

export async function sendPlaymakerPasswordReset(email) {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) throw new Error('Cloud accounts are not configured.');
  const { data, error } = await cloud.auth.resetPasswordForEmail(email, {
    redirectTo: appRedirectUrl({ content: 'account', recovery: 'true' }),
  });
  if (error) throw error;
  return data;
}

export async function updatePlaymakerPassword(password) {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) throw new Error('Cloud accounts are not configured.');
  const { data, error } = await cloud.auth.updateUser({ password });
  if (error) throw error;
  return data;
}

export async function signOutPlaymakerAccount() {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) return;
  const { error } = await cloud.auth.signOut();
  if (error) throw error;
}

export async function savePlaymakerDraftToCloud(value) {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) throw new Error('Cloud accounts are not configured.');
  const session = await playmakerCloudSession();
  if (!session?.user) throw new Error('Sign in before syncing this play.');
  const draft = normalizePlaymakerDraft(value);
  const { data, error } = await cloud.from('playmaker_plays').upsert({
    id: draft.id.replace(/^play-/u, ''),
    user_id: session.user.id,
    title: draft.title,
    description: draft.description,
    visibility: draft.visibility,
    payload: draft,
    published_at: draft.visibility === 'public' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).select('id, title, description, visibility, share_slug, revision, created_at, updated_at, payload').single();
  if (error) throw error;
  return normalizeCloudPlaymakerRecord(data);
}

export async function loadPlaymakerDraftsFromCloud() {
  const records = await loadPlaymakerDraftRecordsFromCloud();
  return records.map((record) => record.draft);
}

export function normalizeCloudPlaymakerRecord(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    visibility: row.visibility === 'public' ? 'public' : 'private',
    shareSlug: row.share_slug,
    revision: Number(row.revision || 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    draft: normalizePlaymakerDraft(row.payload),
  };
}

export async function loadPlaymakerDraftRecordsFromCloud() {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) return [];
  const session = await playmakerCloudSession();
  if (!session?.user) return [];
  const { data, error } = await cloud
    .from('playmaker_plays')
    .select('id, title, description, visibility, share_slug, revision, created_at, updated_at, payload')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeCloudPlaymakerRecord);
}

export async function updatePlaymakerDraftVisibility(recordId, visibility) {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) throw new Error('Cloud accounts are not configured.');
  const nextVisibility = visibility === 'public' ? 'public' : 'private';
  const { data, error } = await cloud
    .from('playmaker_plays')
    .update({
      visibility: nextVisibility,
      published_at: nextVisibility === 'public' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recordId)
    .select('id, title, description, visibility, share_slug, revision, created_at, updated_at, payload')
    .single();
  if (error) throw error;
  return normalizeCloudPlaymakerRecord(data);
}

export async function deletePlaymakerDraftFromCloud(recordId) {
  const cloud = getPlaymakerCloudClient();
  if (!cloud) throw new Error('Cloud accounts are not configured.');
  const { error } = await cloud.from('playmaker_plays').delete().eq('id', recordId);
  if (error) throw error;
}

export async function loadPublishedPlaymakerDraft(shareSlug) {
  const cloud = getPlaymakerCloudClient();
  if (!cloud || !shareSlug) return null;
  const { data, error } = await cloud
    .from('playmaker_plays')
    .select('id, title, description, visibility, share_slug, revision, created_at, updated_at, payload')
    .eq('share_slug', shareSlug)
    .eq('visibility', 'public')
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeCloudPlaymakerRecord(data) : null;
}

export function createCloudPlaymakerShareUrl(href, shareSlug) {
  const url = new URL(href || 'http://localhost/');
  url.search = '';
  url.hash = '';
  url.searchParams.set('content', 'playmaker');
  url.searchParams.set('cloudPlay', shareSlug);
  return url.toString();
}
