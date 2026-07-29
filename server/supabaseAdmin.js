import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://efupudunfkdykvqystdc.supabase.co';
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_NYkCHXiYM-eA0BSTCdxaOQ_D_vAFsw8';

function requiredServerConfig() {
  const url = process.env.SUPABASE_URL
    || process.env.VITE_SUPABASE_URL
    || DEFAULT_SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || DEFAULT_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('Server account management is not configured.');
  }
  return { url, publishableKey, serviceRoleKey };
}

export function createServerClients() {
  const { url, publishableKey, serviceRoleKey } = requiredServerConfig();
  const authOptions = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
  return {
    admin: createClient(url, serviceRoleKey, { auth: authOptions }),
    publicClient: createClient(url, publishableKey, { auth: authOptions }),
  };
}

export function configuredAccountOwnerEmail() {
  return String(process.env.ACCOUNT_OWNER_EMAIL || '').trim().toLowerCase();
}

export function parseJsonBody(request) {
  if (!request?.body) return {};
  if (typeof request.body === 'object') return request.body;
  try {
    return JSON.parse(request.body);
  } catch {
    return {};
  }
}

export function setPrivateResponseHeaders(response) {
  response.setHeader('Cache-Control', 'no-store, max-age=0');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('X-Content-Type-Options', 'nosniff');
}

export function bearerToken(request) {
  const header = String(request?.headers?.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

export function publicAppUrl(request) {
  const configured = process.env.PUBLIC_APP_URL;
  if (configured) return String(configured).replace(/\/$/u, '');
  const protocol = request?.headers?.['x-forwarded-proto'] || 'https';
  const host = request?.headers?.['x-forwarded-host'] || request?.headers?.host;
  if (host) return `${protocol}://${host}`;
  return process.env.VITE_PUBLIC_APP_URL || 'https://goonsquad-playbook.vercel.app';
}

export async function requireAccountAdmin(request) {
  const token = bearerToken(request);
  if (!token) {
    const error = new Error('Sign in to continue.');
    error.statusCode = 401;
    throw error;
  }

  const clients = createServerClients();
  const { data: userData, error: userError } = await clients.admin.auth.getUser(token);
  if (userError || !userData?.user) {
    const error = new Error('Your session has expired. Sign in again.');
    error.statusCode = 401;
    throw error;
  }

  const { data: profile, error: profileError } = await clients.admin
    .from('profiles')
    .select('id, username, display_name, role, created_at')
    .eq('id', userData.user.id)
    .single();
  if (profileError || profile?.role !== 'admin') {
    const error = new Error('Admin access is required.');
    error.statusCode = 403;
    throw error;
  }

  const ownerEmail = configuredAccountOwnerEmail();
  const actorEmail = String(userData.user.email || '').trim().toLowerCase();
  const isConfiguredOwner = Boolean(ownerEmail && actorEmail === ownerEmail);
  let ownerId = null;

  if (ownerEmail) {
    if (isConfiguredOwner) {
      ownerId = profile.id;
    } else {
      const { data: authUsers } = await clients.admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      ownerId = authUsers?.users?.find(
        (user) => String(user.email || '').trim().toLowerCase() === ownerEmail,
      )?.id || null;
    }
  } else {
    const { data: firstAdmin } = await clients.admin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    ownerId = firstAdmin?.id || null;
  }

  return {
    ...clients,
    actor: {
      ...profile,
      email: userData.user.email,
      isOwner: ownerId === profile.id,
      ownerId,
    },
  };
}

export function sendApiError(response, error, fallback = 'We could not complete that request.') {
  const status = Number(error?.statusCode) || (
    String(error?.message || '').includes('not configured') ? 503 : 400
  );
  response.status(status).json({ error: status >= 500 ? fallback : error.message || fallback });
}
