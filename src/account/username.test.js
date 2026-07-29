import { describe, expect, it } from 'vitest';
import {
  isValidUsername,
  normalizeUsername,
  usernameValidationMessage,
} from './username';

describe('member usernames', () => {
  it('normalizes a readable public handle', () => {
    expect(normalizeUsername('  @Seymour Goon-Squad!  ')).toBe('seymour_goon_squad');
    expect(normalizeUsername('__LD__')).toBe('ld');
  });

  it('requires a compact handle without rejecting valid team names', () => {
    expect(isValidUsername('winger_19')).toBe(true);
    expect(isValidUsername('ab')).toBe(false);
    expect(usernameValidationMessage('ab')).toContain('at least 3');
  });
});
