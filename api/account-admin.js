import { normalizeUsername, usernameValidationMessage } from '../src/account/username.js';
import {
  parseJsonBody,
  publicAppUrl,
  requireAccountAdmin,
  sendApiError,
  setPrivateResponseHeaders,
} from '../server/supabaseAdmin.js';

const MANAGED_ROLES = new Set(['member', 'stat_manager', 'admin']);

function isFutureDate(value) {
  const time = Date.parse(value || '');
  return Number.isFinite(time) && time > Date.now();
}

export function assertCanManage(actor, target, nextRole) {
  if (!target) {
    const error = new Error('That member account no longer exists.');
    error.statusCode = 404;
    throw error;
  }
  const requestedRole = nextRole || target.role;
  if (target.id === actor.id && requestedRole !== target.role) {
    throw new Error('You cannot change your own admin role.');
  }
  if (!actor.isOwner && target.role === 'admin' && target.id !== actor.id) {
    const error = new Error('Only the account owner can manage another admin.');
    error.statusCode = 403;
    throw error;
  }
  if (!actor.isOwner && requestedRole === 'admin' && target.role !== 'admin') {
    const error = new Error('Only the account owner can promote another admin.');
    error.statusCode = 403;
    throw error;
  }
}

async function loadTargetProfile(admin, userId) {
  const { data, error } = await admin
    .from('profiles')
    .select('id, username, display_name, role, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function listAccounts(admin, actor) {
  const { data: authData, error: authError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authError) throw authError;
  const users = authData?.users || [];
  const ids = users.map((user) => user.id);
  const { data: profiles, error: profileError } = ids.length
    ? await admin
      .from('profiles')
      .select('id, username, display_name, role, created_at, updated_at')
      .in('id', ids)
    : { data: [], error: null };
  if (profileError) throw profileError;
  const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));

  return users.map((user) => {
    const profile = profileById.get(user.id) || {};
    return {
      id: user.id,
      email: user.email || '',
      username: profile.username || user.user_metadata?.username || '',
      displayName: profile.display_name || user.user_metadata?.full_name || '',
      role: profile.role || 'member',
      createdAt: profile.created_at || user.created_at,
      lastSignInAt: user.last_sign_in_at || null,
      emailConfirmed: Boolean(user.email_confirmed_at),
      suspended: isFutureDate(user.banned_until),
      isOwner: user.id === actor.ownerId,
    };
  }).sort((left, right) => {
    if (left.isOwner !== right.isOwner) return left.isOwner ? -1 : 1;
    if (left.role !== right.role) return left.role === 'admin' ? -1 : 1;
    return left.displayName.localeCompare(right.displayName);
  });
}

async function updateAccount(admin, actor, body) {
  const target = await loadTargetProfile(admin, body.userId);
  const nextRole = MANAGED_ROLES.has(body.role) ? body.role : target?.role;
  assertCanManage(actor, target, nextRole);

  const username = normalizeUsername(body.username);
  const usernameError = usernameValidationMessage(username);
  if (usernameError) throw new Error(usernameError);
  const displayName = String(body.displayName || '').trim().slice(0, 80);
  if (!displayName) throw new Error('Display name is required.');

  const { data, error } = await admin
    .from('profiles')
    .update({
      display_name: displayName,
      username,
      role: nextRole,
      updated_at: new Date().toISOString(),
    })
    .eq('id', target.id)
    .select('id, username, display_name, role, created_at, updated_at')
    .single();
  if (error) {
    if (/username|unique/iu.test(error.message || '')) {
      throw new Error('That username is already taken.');
    }
    throw error;
  }
  return data;
}

async function setSuspension(admin, actor, body) {
  const target = await loadTargetProfile(admin, body.userId);
  assertCanManage(actor, target);
  if (target.id === actor.id) throw new Error('You cannot suspend your own account.');
  const { error } = await admin.auth.admin.updateUserById(target.id, {
    ban_duration: body.suspended ? '876000h' : 'none',
  });
  if (error) throw error;
}

async function deleteAccount(admin, actor, body) {
  const target = await loadTargetProfile(admin, body.userId);
  assertCanManage(actor, target);
  if (target.id === actor.id) throw new Error('You cannot delete your own account here.');
  const { error } = await admin.auth.admin.deleteUser(target.id, false);
  if (error) throw error;
}

async function sendPasswordReset(admin, publicClient, actor, body, request) {
  const target = await loadTargetProfile(admin, body.userId);
  assertCanManage(actor, target);
  const { data: userData, error: userError } = await admin.auth.admin.getUserById(target.id);
  if (userError || !userData?.user?.email) throw userError || new Error('Account email is unavailable.');
  const redirectTo = new URL(publicAppUrl(request));
  redirectTo.searchParams.set('content', 'account');
  redirectTo.searchParams.set('recovery', 'true');
  const { error } = await publicClient.auth.resetPasswordForEmail(userData.user.email, {
    redirectTo: redirectTo.toString(),
  });
  if (error) throw error;
}

export default async function handler(request, response) {
  setPrivateResponseHeaders(response);
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const body = parseJsonBody(request);
    const context = await requireAccountAdmin(request);
    const { admin, publicClient, actor } = context;

    if (body.action === 'list') {
      response.status(200).json({
        accounts: await listAccounts(admin, actor),
        permissions: { isOwner: actor.isOwner },
      });
      return;
    }
    if (body.action === 'update') {
      await updateAccount(admin, actor, body);
    } else if (body.action === 'suspend') {
      await setSuspension(admin, actor, body);
    } else if (body.action === 'delete') {
      await deleteAccount(admin, actor, body);
    } else if (body.action === 'reset-password') {
      await sendPasswordReset(admin, publicClient, actor, body, request);
    } else {
      response.status(400).json({ error: 'Unknown admin action.' });
      return;
    }

    response.status(200).json({
      ok: true,
      accounts: await listAccounts(admin, actor),
      permissions: { isOwner: actor.isOwner },
    });
  } catch (error) {
    sendApiError(response, error, 'Account administration is temporarily unavailable.');
  }
}
