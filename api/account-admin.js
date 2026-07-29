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

async function loadPlayerClaimRows(admin) {
  const result = await admin
    .from('member_player_claims')
    .select('user_id, player_id, status, is_primary, requested_at, reviewed_at, linked_at')
    .order('requested_at', { ascending: true });
  if (!result.error) return result.data || [];
  if (!/status|requested_at|reviewed_at/iu.test(String(result.error.message || ''))) {
    throw result.error;
  }

  const legacy = await admin
    .from('member_player_claims')
    .select('user_id, player_id, is_primary, linked_at')
    .order('linked_at', { ascending: true });
  if (legacy.error) throw legacy.error;
  return (legacy.data || []).map((claim) => ({ ...claim, status: 'approved' }));
}

async function loadPlayerLinkDirectory(admin, accounts) {
  const claimRows = await loadPlayerClaimRows(admin);
  const [playerResult, membershipResult, teamResult, seasonResult] = await Promise.all([
    admin
      .from('players')
      .select('id, external_id, display_name, jersey_number, primary_position, active, source_url')
      .order('active', { ascending: false })
      .order('display_name', { ascending: true }),
    admin
      .from('roster_memberships')
      .select('player_id, season_team_id, jersey_number, position, active'),
    admin
      .from('season_teams')
      .select('id, season_id, schedule_label'),
    admin
      .from('seasons')
      .select('id, name, is_current'),
  ]);
  if (playerResult.error) throw playerResult.error;
  if (membershipResult.error) throw membershipResult.error;
  if (teamResult.error) throw teamResult.error;
  if (seasonResult.error) throw seasonResult.error;

  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const playerById = new Map((playerResult.data || []).map((player) => [player.id, player]));
  const teamById = new Map((teamResult.data || []).map((team) => [team.id, team]));
  const seasonById = new Map((seasonResult.data || []).map((season) => [season.id, season]));
  const rosterByPlayer = new Map();
  (membershipResult.data || []).forEach((membership) => {
    const team = teamById.get(membership.season_team_id);
    const season = seasonById.get(team?.season_id);
    const roster = rosterByPlayer.get(membership.player_id) || [];
    roster.push({
      jerseyNumber: membership.jersey_number,
      position: membership.position,
      active: Boolean(membership.active),
      current: Boolean(season?.is_current),
      season: season?.name || '',
      schedule: team?.schedule_label || '',
      label: [season?.name, team?.schedule_label].filter(Boolean).join(' · '),
    });
    rosterByPlayer.set(membership.player_id, roster);
  });
  rosterByPlayer.forEach((roster) => roster.sort((left, right) => {
    if (left.current !== right.current) return left.current ? -1 : 1;
    if (left.active !== right.active) return left.active ? -1 : 1;
    return right.label.localeCompare(left.label);
  }));

  const playerSummary = (player) => {
    if (!player) return null;
    const roster = rosterByPlayer.get(player.id) || [];
    const currentRoster = roster[0];
    return {
      id: player.id,
      externalId: player.external_id,
      displayName: player.display_name,
      jerseyNumber: player.jersey_number || currentRoster?.jerseyNumber || null,
      position: player.primary_position || currentRoster?.position || null,
      active: Boolean(player.active),
      sourceUrl: player.source_url,
      roster,
      rosterLabel: currentRoster?.label || '',
    };
  };

  const claims = claimRows.map((claim) => {
    const account = accountById.get(claim.user_id);
    const player = playerById.get(claim.player_id);
    return {
      userId: claim.user_id,
      playerId: claim.player_id,
      status: claim.status || 'approved',
      primary: Boolean(claim.is_primary),
      requestedAt: claim.requested_at || claim.linked_at,
      reviewedAt: claim.reviewed_at || null,
      member: account ? {
        displayName: account.displayName,
        username: account.username,
        email: account.email,
      } : null,
      player: playerSummary(player),
    };
  });
  const linkedPlayerIds = new Set(
    claims.filter((claim) => claim.status === 'approved').map((claim) => claim.playerId),
  );
  const players = (playerResult.data || []).map((player) => ({
    ...playerSummary(player),
    linked: linkedPlayerIds.has(player.id),
  }));

  return { claims, players };
}

async function loadAdminSnapshot(admin, actor) {
  const accounts = await listAccounts(admin, actor);
  const directory = await loadPlayerLinkDirectory(admin, accounts);
  return {
    accounts,
    ...directory,
    permissions: { isOwner: actor.isOwner },
  };
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

async function reviewPlayerClaim(admin, actor, body) {
  if (!['approved', 'rejected'].includes(body.decision)) {
    throw new Error('Choose approve or deny for that player-link request.');
  }
  const target = await loadTargetProfile(admin, body.userId);
  assertCanManage(actor, target);
  const { error } = await admin.rpc('review_member_player_claim', {
    p_actor_id: actor.id,
    p_user_id: body.userId,
    p_player_id: body.playerId,
    p_decision: body.decision,
  });
  if (error) throw error;
}

async function assignPlayer(admin, actor, body) {
  const target = await loadTargetProfile(admin, body.userId);
  assertCanManage(actor, target);
  const { error } = await admin.rpc('assign_member_player_claim', {
    p_actor_id: actor.id,
    p_user_id: body.userId,
    p_player_id: body.playerId,
  });
  if (error) throw error;
}

async function unlinkPlayer(admin, actor, body) {
  const target = await loadTargetProfile(admin, body.userId);
  assertCanManage(actor, target);
  const { error } = await admin.rpc('unassign_member_player_claim', {
    p_actor_id: actor.id,
    p_user_id: body.userId,
    p_player_id: body.playerId,
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
      response.status(200).json(await loadAdminSnapshot(admin, actor));
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
    } else if (body.action === 'review-player-claim') {
      await reviewPlayerClaim(admin, actor, body);
    } else if (body.action === 'assign-player') {
      await assignPlayer(admin, actor, body);
    } else if (body.action === 'unlink-player') {
      await unlinkPlayer(admin, actor, body);
    } else {
      response.status(400).json({ error: 'Unknown admin action.' });
      return;
    }

    response.status(200).json({ ok: true, ...await loadAdminSnapshot(admin, actor) });
  } catch (error) {
    sendApiError(response, error, 'Account administration is temporarily unavailable.');
  }
}
