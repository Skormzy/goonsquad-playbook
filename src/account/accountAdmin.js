import { playmakerCloudSession } from '../playmaker/playmakerCloud';

async function adminRequest(action, payload = {}) {
  const session = await playmakerCloudSession();
  if (!session?.access_token) throw new Error('Sign in to continue.');
  const response = await fetch('/api/account-admin', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Account administration is temporarily unavailable.');
  return data;
}

export function loadManagedAccounts() {
  return adminRequest('list');
}

export function updateManagedAccount(account) {
  return adminRequest('update', {
    userId: account.id,
    displayName: account.displayName,
    username: account.username,
    role: account.role,
  });
}

export function setManagedAccountSuspension(userId, suspended) {
  return adminRequest('suspend', { userId, suspended });
}

export function deleteManagedAccount(userId) {
  return adminRequest('delete', { userId });
}

export function sendManagedAccountPasswordReset(userId) {
  return adminRequest('reset-password', { userId });
}

export function reviewManagedPlayerClaim(userId, playerId, decision) {
  return adminRequest('review-player-claim', { userId, playerId, decision });
}

export function assignManagedPlayer(userId, playerId) {
  return adminRequest('assign-player', { userId, playerId });
}

export function unlinkManagedPlayer(userId, playerId) {
  return adminRequest('unlink-player', { userId, playerId });
}
