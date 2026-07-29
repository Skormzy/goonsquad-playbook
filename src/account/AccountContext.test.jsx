import { describe, expect, it } from 'vitest';
import { accountMessageForError } from './AccountContext';

describe('account error copy', () => {
  it.each([
    ['Invalid login credentials', 'Email, username, or password is incorrect.'],
    ['Email, username, or password is incorrect.', 'Email, username, or password is incorrect.'],
    ['Email not confirmed', 'Confirm your email before signing in.'],
    ['User already registered', 'An account already exists for that email. Try signing in.'],
    ['over_email_send_rate_limit', 'Too many attempts. Wait a moment, then try again.'],
    ['Failed to fetch', 'Could not reach the account service. Check your connection and try again.'],
    ['Cloud accounts are not configured.', 'Accounts are temporarily unavailable. Your local plays remain safe.'],
    ['duplicate key value violates unique constraint username', 'That username is already taken.'],
    ['That player profile is already linked to another account.', 'That player profile is already linked to another account.'],
    ['You already have a player-link request awaiting review.', 'You already have a player-link request awaiting review.'],
    ['That squad player could not be found.', 'That squad player could not be found. Ask an admin to check the roster.'],
  ])('maps "%s" to player-facing guidance', (rawMessage, expected) => {
    expect(accountMessageForError(new Error(rawMessage))).toBe(expected);
  });

  it('does not expose an unknown backend message', () => {
    expect(accountMessageForError(new Error('relation member_profiles does not exist')))
      .toBe('We could not complete that account request. Please try again.');
  });
});
