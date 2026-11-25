import { describe, expect, it } from 'vitest';
import { canAssignRole, canManageMembers, canRevokeRole } from './membership-policy';

describe('organisation membership policy', () => {
  it('allows platform administrators to assign every organisation role', () => {
    for (const role of ['organisation_admin', 'school_admin', 'teacher', 'assessor', 'viewer'] as const) expect(canAssignRole('platform_admin', role)).toBe(true);
  });
  it('prevents organisation administrators from promoting another organisation administrator', () => {
    expect(canAssignRole('organisation_admin', 'organisation_admin')).toBe(false);
    expect(canAssignRole('organisation_admin', 'school_admin')).toBe(true);
  });
  it('limits school administrators to operational roles', () => {
    expect(canAssignRole('school_admin', 'organisation_admin')).toBe(false);
    expect(canAssignRole('school_admin', 'school_admin')).toBe(false);
    expect(canAssignRole('school_admin', 'teacher')).toBe(true);
  });
  it('does not let teaching or read-only roles manage memberships', () => {
    expect(canManageMembers('teacher')).toBe(false);
    expect(canManageMembers('assessor')).toBe(false);
    expect(canManageMembers('viewer')).toBe(false);
  });
  it('applies the same role boundary to revocation', () => {
    expect(canRevokeRole('organisation_admin', 'organisation_admin')).toBe(false);
    expect(canRevokeRole('school_admin', 'teacher')).toBe(true);
  });
});
