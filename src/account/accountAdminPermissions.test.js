import { describe, expect, it } from 'vitest';
import { assertCanManage } from '../../api/account-admin';

const coachAdmin = { id: 'andy', isOwner: false };

describe('account administration permissions', () => {
  it('lets a coach admin manage and link an ordinary member account', () => {
    expect(() => assertCanManage(
      coachAdmin,
      { id: 'member-1', role: 'member' },
    )).not.toThrow();
  });

  it('keeps admin promotion and another admin account owner-only', () => {
    expect(() => assertCanManage(
      coachAdmin,
      { id: 'member-1', role: 'member' },
      'admin',
    )).toThrow('Only the account owner can promote another admin.');
    expect(() => assertCanManage(
      coachAdmin,
      { id: 'admin-2', role: 'admin' },
    )).toThrow('Only the account owner can manage another admin.');
  });
});
