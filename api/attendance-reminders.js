import { randomUUID } from 'node:crypto';
import webpush from 'web-push';
import {
  attendanceActionUrl,
  attendanceTokenExpiry,
  buildAttendanceEmail,
  signAttendanceToken,
  verifyAttendanceToken,
} from '../server/attendanceReminders.js';
import {
  createServerClients,
  parseJsonBody,
  publicAppUrl,
  requireAccountAdmin,
  requireAccountUser,
  sendApiError,
  setPrivateResponseHeaders,
} from '../server/supabaseAdmin.js';

const SUBSCRIPTION_METADATA_KEY = 'goonsquad_push_subscriptions';
const MAX_RECIPIENTS = 80;
const MAX_SUBSCRIPTIONS_PER_USER = 5;

function channelConfig() {
  const vapidPublicKey = String(process.env.VAPID_PUBLIC_KEY || '').trim();
  const vapidPrivateKey = String(process.env.VAPID_PRIVATE_KEY || '').trim();
  return {
    emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.ATTENDANCE_EMAIL_FROM),
    pushConfigured: Boolean(vapidPublicKey && vapidPrivateKey),
    responseLinksConfigured: Boolean(process.env.ATTENDANCE_ACTION_SECRET),
    vapidPublicKey,
    vapidPrivateKey,
  };
}

function cleanString(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function uniqueIds(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => cleanString(value, 80))
    .filter(Boolean))].slice(0, MAX_RECIPIENTS);
}

function normalizeSubscription(value) {
  const endpoint = cleanString(value?.endpoint, 2048);
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error('This device returned an invalid notification subscription.');
  }
  if (parsed.protocol !== 'https:') throw new Error('Notification subscriptions must use HTTPS.');
  const p256dh = cleanString(value?.keys?.p256dh, 512);
  const auth = cleanString(value?.keys?.auth, 512);
  if (!p256dh || !auth) throw new Error('This device returned an incomplete notification subscription.');
  return {
    endpoint,
    expirationTime: Number.isFinite(Number(value?.expirationTime)) ? Number(value.expirationTime) : null,
    keys: { p256dh, auth },
    device: cleanString(value?.device, 80) || 'Goonsquad device',
    updatedAt: new Date().toISOString(),
  };
}

function subscriptionsFor(user) {
  const values = user?.user_metadata?.[SUBSCRIPTION_METADATA_KEY];
  if (!Array.isArray(values)) return [];
  return values.filter((value) => value?.endpoint && value?.keys?.p256dh && value?.keys?.auth);
}

async function saveSubscriptions(admin, user, subscriptions) {
  const metadata = user.user_metadata || {};
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...metadata,
      [SUBSCRIPTION_METADATA_KEY]: subscriptions.slice(-MAX_SUBSCRIPTIONS_PER_USER),
    },
  });
  if (error) throw error;
}

async function registerSubscription(request, body) {
  const { admin, actor } = await requireAccountUser(request);
  const subscription = normalizeSubscription({
    ...body.subscription,
    device: body.device,
  });
  const { data, error } = await admin.auth.admin.getUserById(actor.id);
  if (error || !data?.user) throw error || new Error('Your account could not be loaded.');
  const existing = subscriptionsFor(data.user).filter((item) => item.endpoint !== subscription.endpoint);
  await saveSubscriptions(admin, data.user, [...existing, subscription]);
  return { enabled: true };
}

async function unregisterSubscription(request, body) {
  const { admin, actor } = await requireAccountUser(request);
  const endpoint = cleanString(body.endpoint, 2048);
  const { data, error } = await admin.auth.admin.getUserById(actor.id);
  if (error || !data?.user) throw error || new Error('Your account could not be loaded.');
  await saveSubscriptions(
    admin,
    data.user,
    subscriptionsFor(data.user).filter((item) => item.endpoint !== endpoint),
  );
  return { enabled: false };
}

async function eligibleWaitingIds(admin, fixtureId, requestedIds) {
  const { data: answered, error: answerError } = await admin
    .from('team_game_availability')
    .select('user_id')
    .eq('fixture_id', fixtureId)
    .in('user_id', requestedIds);
  if (answerError) throw answerError;
  const answeredIds = new Set((answered || []).map((row) => row.user_id));
  const waiting = requestedIds.filter((id) => !answeredIds.has(id));
  const access = await Promise.all(waiting.map(async (userId) => {
    const { data, error } = await admin.rpc('can_access_game_attendance', {
      p_fixture_id: fixtureId,
      p_user_id: userId,
    });
    if (error) throw error;
    return data ? userId : null;
  }));
  return access.filter(Boolean);
}

function actionUrlsFor({ appUrl, fixture, userId }) {
  const exp = attendanceTokenExpiry(fixture.scheduledAt);
  return Object.fromEntries(['in', 'maybe', 'out'].map((response) => {
    const token = signAttendanceToken({
      competitionLabel: fixture.competitionLabel,
      exp,
      fixtureId: fixture.id,
      opponent: fixture.opponent,
      response,
      scheduledAt: fixture.scheduledAt,
      userId,
    }, process.env.ATTENDANCE_ACTION_SECRET);
    return [response, attendanceActionUrl(appUrl, token)];
  }));
}

async function sendEmail({ actionUrls, fixture, idempotencyKey, message, to }) {
  const content = buildAttendanceEmail({
    actionUrls,
    competitionLabel: fixture.competitionLabel,
    message,
    opponent: fixture.opponent,
    scheduledAt: fixture.scheduledAt,
  });
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      from: process.env.ATTENDANCE_EMAIL_FROM,
      to: [to],
      subject: `Attendance: are you in vs ${fixture.opponent}?`,
      html: content.html,
      text: content.text,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || 'Email delivery failed.');
  return payload.id || '';
}

async function removeStaleSubscriptions(admin, user, staleEndpoints) {
  if (!staleEndpoints.size) return;
  await saveSubscriptions(
    admin,
    user,
    subscriptionsFor(user).filter((item) => !staleEndpoints.has(item.endpoint)),
  );
}

async function sendPushes({ actionUrls, admin, appUrl, fixture, message, user }) {
  const subscriptions = subscriptionsFor(user);
  if (!subscriptions.length) return { delivered: 0, attempted: 0 };
  const destination = new URL(appUrl);
  destination.search = '';
  destination.hash = '';
  destination.searchParams.set('content', 'home');
  destination.searchParams.set('attendanceFixture', fixture.id);
  const payload = JSON.stringify({
    title: `Attendance: vs ${fixture.opponent}`,
    body: message || 'Coach is checking the lineup. Tap to answer.',
    tag: `attendance-${fixture.id}`.slice(0, 120),
    url: destination.toString(),
    actions: [
      { action: 'in', title: "I'm in" },
      { action: 'out', title: "I'm out" },
    ],
    actionUrls: {
      in: actionUrls.in,
      out: actionUrls.out,
    },
  });
  const stale = new Set();
  const results = await Promise.allSettled(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(subscription, payload, { TTL: 172800, urgency: 'high' });
      return true;
    } catch (error) {
      if ([404, 410].includes(Number(error?.statusCode))) stale.add(subscription.endpoint);
      throw error;
    }
  }));
  await removeStaleSubscriptions(admin, user, stale);
  return {
    attempted: subscriptions.length,
    delivered: results.filter((result) => result.status === 'fulfilled').length,
  };
}

async function sendReminder(request, body) {
  const { admin, actor } = await requireAccountAdmin(request);
  const config = channelConfig();
  const fixture = {
    id: cleanString(body.fixture?.id, 160),
    opponent: cleanString(body.fixture?.opponent, 100) || 'Opponent',
    scheduledAt: cleanString(body.fixture?.scheduledAt, 80),
    competitionLabel: cleanString(body.fixture?.competitionLabel, 120) || 'Goonsquad',
  };
  if (!fixture.id) throw new Error('Choose a game before sending a reminder.');
  const requestedIds = uniqueIds(body.recipientIds);
  if (!requestedIds.length) throw new Error('Choose at least one waiting player.');
  const channels = {
    email: Boolean(body.channels?.email && config.emailConfigured),
    push: Boolean(body.channels?.push && config.pushConfigured),
  };
  if (!channels.email && !channels.push) throw new Error('Choose an available reminder channel.');
  if (!config.responseLinksConfigured) throw new Error('Attendance response links are not configured.');

  const recipientIds = await eligibleWaitingIds(admin, fixture.id, requestedIds);
  if (!recipientIds.length) throw new Error('Those players have already answered or no longer have access to this game.');
  const { data: authData, error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authError) throw authError;
  const usersById = new Map((authData?.users || []).map((user) => [user.id, user]));
  const message = cleanString(body.message, 180) || 'Please confirm whether you are in for this game.';
  const reminderId = randomUUID();
  const appUrl = publicAppUrl(request);

  if (channels.push) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:attendance@goonsquad.app',
      config.vapidPublicKey,
      config.vapidPrivateKey,
    );
  }

  const deliveries = await Promise.all(recipientIds.map(async (userId) => {
    const user = usersById.get(userId);
    if (!user) return { userId, email: false, push: 0, failures: 1 };
    const actionUrls = actionUrlsFor({ appUrl, fixture, userId });
    const result = { userId, email: false, push: 0, failures: 0 };
    if (channels.push) {
      try {
        const push = await sendPushes({ actionUrls, admin, appUrl, fixture, message, user });
        result.push = push.delivered;
        if (push.attempted > push.delivered) result.failures += push.attempted - push.delivered;
      } catch {
        result.failures += 1;
      }
    }
    if (channels.email && user.email && user.email_confirmed_at) {
      try {
        await sendEmail({
          actionUrls,
          fixture,
          idempotencyKey: `attendance-${reminderId}-${userId}`,
          message,
          to: user.email,
        });
        result.email = true;
      } catch {
        result.failures += 1;
      }
    }
    return result;
  }));

  return {
    actorId: actor.id,
    emailRecipients: deliveries.filter((item) => item.email).length,
    failedDeliveries: deliveries.reduce((total, item) => total + item.failures, 0),
    noDeliveryRecipients: deliveries.filter((item) => !item.email && item.push === 0).length,
    pushDevices: deliveries.reduce((total, item) => total + item.push, 0),
    recipientCount: deliveries.length,
    reminderId,
  };
}

async function confirmResponse(body) {
  const payload = verifyAttendanceToken(
    cleanString(body.token, 4096),
    process.env.ATTENDANCE_ACTION_SECRET,
  );
  // Response links are authorized by their signature, so use the server client directly.
  const serverAdmin = createServerClients().admin;
  const { data: canAccess, error: accessError } = await serverAdmin.rpc('can_access_game_attendance', {
    p_fixture_id: payload.fixtureId,
    p_user_id: payload.userId,
  });
  if (accessError) throw accessError;
  if (!canAccess) {
    const error = new Error('This player no longer has access to this game.');
    error.statusCode = 403;
    throw error;
  }
  const { error } = await serverAdmin.from('team_game_availability').upsert({
    fixture_id: payload.fixtureId,
    user_id: payload.userId,
    response: payload.response,
    note: null,
  }, { onConflict: 'fixture_id,user_id' });
  if (error) throw error;
  return {
    competitionLabel: payload.competitionLabel || 'Goonsquad',
    fixtureId: payload.fixtureId,
    opponent: payload.opponent || 'Opponent',
    response: payload.response,
    scheduledAt: payload.scheduledAt || '',
  };
}

export default async function handler(request, response) {
  setPrivateResponseHeaders(response);
  if (request.method === 'GET') {
    const config = channelConfig();
    response.status(200).json({
      emailConfigured: config.emailConfigured,
      pushConfigured: config.pushConfigured,
      responseLinksConfigured: config.responseLinksConfigured,
      vapidPublicKey: config.pushConfigured ? config.vapidPublicKey : '',
    });
    return;
  }
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    response.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  try {
    const body = parseJsonBody(request);
    if (body.action === 'subscribe') {
      response.status(200).json(await registerSubscription(request, body));
    } else if (body.action === 'unsubscribe') {
      response.status(200).json(await unregisterSubscription(request, body));
    } else if (body.action === 'send') {
      response.status(200).json(await sendReminder(request, body));
    } else if (body.action === 'respond') {
      response.status(200).json(await confirmResponse(body));
    } else {
      response.status(400).json({ error: 'Unknown attendance reminder action.' });
    }
  } catch (error) {
    sendApiError(response, error, 'Attendance reminders are temporarily unavailable.');
  }
}
