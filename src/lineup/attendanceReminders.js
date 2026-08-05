import { playmakerCloudSession } from '../playmaker/playmakerCloud';

let configPromise = null;

async function apiRequest(body, { authenticated = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authenticated) {
    const session = await playmakerCloudSession();
    if (!session?.access_token) throw new Error('Sign in again to continue.');
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  const response = await fetch('/api/attendance-reminders', {
    method: 'POST',
    credentials: 'same-origin',
    headers,
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Attendance reminders are unavailable.');
  return payload;
}

export function loadAttendanceReminderConfig({ refresh = false } = {}) {
  if (!configPromise || refresh) {
    configPromise = fetch('/api/attendance-reminders', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Reminder settings could not load.');
      return payload;
    }).catch((error) => {
      configPromise = null;
      throw error;
    });
  }
  return configPromise;
}

function applicationServerKey(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replaceAll('-', '+').replaceAll('_', '/');
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

async function attendanceServiceWorker({ create = false } = {}) {
  let registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration && create) {
    registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
  }
  return registration;
}

export function attendancePushCapability() {
  const supported = typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
  const installed = typeof window !== 'undefined' && Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone,
  );
  return {
    installed,
    permission: supported ? Notification.permission : 'unsupported',
    supported,
  };
}

export async function currentAttendancePushSubscription() {
  if (!attendancePushCapability().supported) return null;
  const registration = await attendanceServiceWorker();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export async function enableAttendancePush() {
  const capability = attendancePushCapability();
  if (!capability.supported) {
    throw new Error(capability.installed
      ? 'Push notifications are not supported on this device.'
      : 'On iPhone, add Goonsquad to your Home Screen before enabling push reminders.');
  }
  const config = await loadAttendanceReminderConfig({ refresh: true });
  if (!config.pushConfigured || !config.vapidPublicKey) {
    throw new Error('Push reminders are finishing setup.');
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(permission === 'denied'
      ? 'Notifications are blocked. Enable them in your device settings.'
      : 'Notification permission was not granted.');
  }
  const registration = await attendanceServiceWorker({ create: true });
  if (!registration) throw new Error('Goonsquad could not prepare notifications on this device.');
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: applicationServerKey(config.vapidPublicKey),
  });
  await apiRequest({
    action: 'subscribe',
    device: [navigator.platform, capability.installed ? 'Home Screen' : 'Browser']
      .filter(Boolean)
      .join(' - '),
    subscription: subscription.toJSON(),
  });
  return subscription;
}

export async function disableAttendancePush() {
  const subscription = await currentAttendancePushSubscription();
  if (!subscription) return false;
  await apiRequest({ action: 'unsubscribe', endpoint: subscription.endpoint });
  await subscription.unsubscribe();
  return true;
}

export function sendAttendanceReminder(payload) {
  return apiRequest({ action: 'send', ...payload });
}

export function confirmAttendanceResponse(token) {
  return apiRequest({ action: 'respond', token }, { authenticated: false });
}

export function attendanceTokenPreview(token) {
  try {
    const [encoded] = String(token || '').split('.');
    const padding = '='.repeat((4 - (encoded.length % 4)) % 4);
    const json = window.atob((encoded + padding).replaceAll('-', '+').replaceAll('_', '/'));
    const bytes = Uint8Array.from(json, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}
