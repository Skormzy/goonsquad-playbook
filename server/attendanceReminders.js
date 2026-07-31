import { createHmac, timingSafeEqual } from 'node:crypto';

export const ATTENDANCE_RESPONSE_IDS = Object.freeze(['in', 'maybe', 'out']);

const RESPONSE_LABELS = Object.freeze({
  in: "I'm in",
  maybe: 'Maybe',
  out: "I'm out",
});

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function signatureFor(encodedPayload, secret) {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

export function attendanceResponseLabel(response) {
  return RESPONSE_LABELS[response] || 'Attendance response';
}

export function attendanceTokenExpiry(scheduledAt, now = Date.now()) {
  const gameTime = Date.parse(scheduledAt || '');
  const fallback = now + (7 * 24 * 60 * 60 * 1000);
  const desired = Number.isFinite(gameTime)
    ? Math.max(now + (48 * 60 * 60 * 1000), gameTime + (12 * 60 * 60 * 1000))
    : fallback;
  return Math.floor(Math.min(desired, now + (30 * 24 * 60 * 60 * 1000)) / 1000);
}

export function signAttendanceToken(payload, secret) {
  if (!secret) throw new Error('Attendance response links are not configured.');
  if (!ATTENDANCE_RESPONSE_IDS.includes(payload?.response)) {
    throw new Error('Attendance response is invalid.');
  }
  const encodedPayload = base64Url(JSON.stringify({ v: 1, ...payload }));
  return `${encodedPayload}.${signatureFor(encodedPayload, secret)}`;
}

export function verifyAttendanceToken(token, secret, now = Date.now()) {
  if (!secret) throw new Error('Attendance response links are not configured.');
  const [encodedPayload, suppliedSignature, extra] = String(token || '').split('.');
  if (!encodedPayload || !suppliedSignature || extra) throw new Error('This attendance link is invalid.');
  const expectedSignature = signatureFor(encodedPayload, secret);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error('This attendance link is invalid.');
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('This attendance link is invalid.');
  }
  if (
    payload?.v !== 1
    || !payload.userId
    || !payload.fixtureId
    || !ATTENDANCE_RESPONSE_IDS.includes(payload.response)
  ) {
    throw new Error('This attendance link is invalid.');
  }
  if (!Number.isFinite(Number(payload.exp)) || Number(payload.exp) * 1000 < now) {
    const error = new Error('This attendance link has expired. Open Goonsquad to answer.');
    error.statusCode = 410;
    throw error;
  }
  return payload;
}

export function attendanceActionUrl(appUrl, token) {
  const url = new URL(appUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set('attendanceToken', token);
  return url.toString();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatGameTime(value) {
  const date = new Date(value || '');
  if (!Number.isFinite(date.getTime())) return 'Upcoming game';
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Toronto',
  }).format(date);
}

export function buildAttendanceEmail({
  actionUrls,
  competitionLabel,
  message,
  opponent,
  scheduledAt,
}) {
  const safeOpponent = escapeHtml(opponent || 'the next opponent');
  const safeCompetition = escapeHtml(competitionLabel || 'Goonsquad');
  const safeMessage = escapeHtml(message || 'Please confirm your attendance.');
  const safeTime = escapeHtml(formatGameTime(scheduledAt));
  const button = (response, background) => `
    <a href="${escapeHtml(actionUrls[response])}" style="display:inline-block;min-width:108px;margin:5px;padding:13px 16px;border-radius:6px;background:${background};color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:800;text-align:center;text-decoration:none;">${escapeHtml(RESPONSE_LABELS[response])}</a>`;

  const html = `<!doctype html>
  <html><body style="margin:0;background:#eef1f3;color:#111317;font-family:Arial,sans-serif;">
    <div style="max-width:620px;margin:0 auto;padding:24px 14px;">
      <div style="overflow:hidden;border:1px solid #cfd5da;border-top:5px solid #e3263f;border-radius:8px;background:#ffffff;">
        <div style="padding:22px 22px 16px;border-bottom:1px solid #dfe3e6;">
          <div style="color:#0088a6;font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;">Goonsquad attendance</div>
          <h1 style="margin:8px 0 4px;font-size:28px;line-height:1.05;">Are you in vs ${safeOpponent}?</h1>
          <p style="margin:0;color:#5b6570;font-size:14px;">${safeTime} &middot; ${safeCompetition}</p>
        </div>
        <div style="padding:20px 22px;">
          <p style="margin:0 0 15px;font-size:16px;line-height:1.5;">${safeMessage}</p>
          <div style="margin:0 -5px 12px;">${button('in', '#16854a')}${button('maybe', '#b65f05')}${button('out', '#b91c1c')}</div>
          <p style="margin:12px 0 0;color:#6b7280;font-size:12px;line-height:1.45;">Your choice opens a secure confirmation screen. No sign-in is required, and you can still change your answer in the app.</p>
        </div>
      </div>
      <p style="margin:12px 4px 0;color:#7a838c;font-size:11px;text-align:center;">Goon with the squad.</p>
    </div>
  </body></html>`;

  return {
    html,
    text: [
      `Goonsquad attendance: vs ${opponent || 'opponent'}`,
      `${formatGameTime(scheduledAt)} - ${competitionLabel || 'Goonsquad'}`,
      message || 'Please confirm your attendance.',
      `I'm in: ${actionUrls.in}`,
      `Maybe: ${actionUrls.maybe}`,
      `I'm out: ${actionUrls.out}`,
    ].join('\n\n'),
  };
}
