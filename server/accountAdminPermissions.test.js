import { describe, expect, it } from 'vitest';
import { assertCanManage } from '../api/account-admin.js';

const owner = { id: 'owner', role: 'admin', isOwner: true };
const admin = { id: 'coach', role: 'admin', isOwner: false };
const member = { id: 'member', role: 'member' };
const otherAdmin = { id: 'other-admin', role: 'admin' };

describe('account administration permissions', () => {
  it('lets the owner promote a member to admin', () => {
    expect(() => assertCanManage(owner, member, 'admin')).not.toThrow();
  });

  it('prevents a delegated admin from promoting or managing another admin', () => {
    expect(() => assertCanManage(admin, member, 'admin')).toThrow(
      'Only the account owner can promote another admin.',
    );
    expect(() => assertCanManage(admin, otherAdmin, 'member')).toThrow(
      'Only the account owner can manage another admin.',
    );
  });

  it('prevents admins from changing their own role', () => {
    expect(() => assertCanManage(admin, admin, 'member')).toThrow(
      'You cannot change your own admin role.',
    );
  });
});
