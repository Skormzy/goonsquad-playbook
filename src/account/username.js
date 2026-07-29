export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 24;

export function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .replace(/^@+/u, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .slice(0, USERNAME_MAX_LENGTH);
}

export function usernameValidationMessage(value) {
  const username = normalizeUsername(value);
  if (!username) return 'Choose a username.';
  if (username.length < USERNAME_MIN_LENGTH) return `Use at least ${USERNAME_MIN_LENGTH} characters.`;
  if (username.length > USERNAME_MAX_LENGTH) return `Use no more than ${USERNAME_MAX_LENGTH} characters.`;
  if (!/^[a-z0-9_]+$/u.test(username)) return 'Use letters, numbers, and underscores only.';
  return '';
}

export function isValidUsername(value) {
  return usernameValidationMessage(value) === '';
}
