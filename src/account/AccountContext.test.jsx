import { describe, expect, it } from 'vitest';
import { accountMessageForError } from './AccountContext';

describe('account error copy', () => {
  it.each([
    ['Invalid login credentials', 'Email or password is incorrect.'],
    ['Email not confirmed', 'Confirm your email before signing in.'],
    ['User already registered', 'An account already exists for that email. Try signing in.'],
    ['over_email_send_rate_limit', 'Too many attempts. Wait a moment, then try again.'],
    ['Failed to fetch', 'Could not reach the account service. Check your connection and try again.'],
    ['OAuth callback failed', 'Google sign-in could not be completed. Please try again.'],
    ['Cloud accounts are not configured.', 'Accounts are temporarily unavailable. Your local plays remain safe.'],
    ['duplicate key value violates unique constraint username', 'That username is already taken.'],
  ])('maps "%s" to player-facing guidance', (rawMessage, expected) => {
    expect(accountMessageForError(new Error(rawMessage))).toBe(expected);
  });

  it('does not expose an unknown backend message', () => {
    expect(accountMessageForError(new Error('relation member_profiles does not exist')))
      .toBe('We could not complete that account request. Please try again.');
  });
});
