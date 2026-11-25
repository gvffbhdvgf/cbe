import { describe, expect, it } from 'vitest';
import { can } from './authorization';

const grant = { subjectId: 'user_1', capability: 'organisation.read', resourceId: 'org_1', scopeIds: ['tenant_1'], expiresAt: new Date('2027-01-01T00:00:00.000Z') };

describe('can', () => {
  it('denies access when no grant is supplied', () => expect(can({ subjectId: 'user_1', capability: 'organisation.read', resourceId: 'org_1', scopeId: 'tenant_1' }, [], new Date('2026-01-01'))).toBe(false));
  it('allows a matching capability, resource and scope', () => expect(can({ subjectId: 'user_1', capability: 'organisation.read', resourceId: 'org_1', scopeId: 'tenant_1' }, [grant], new Date('2026-01-01'))).toBe(true));
  it('denies a different scope', () => expect(can({ subjectId: 'user_1', capability: 'organisation.read', resourceId: 'org_1', scopeId: 'tenant_2' }, [grant], new Date('2026-01-01'))).toBe(false));
  it('denies an expired assignment', () => expect(can({ subjectId: 'user_1', capability: 'organisation.read', resourceId: 'org_1', scopeId: 'tenant_1' }, [{ ...grant, expiresAt: new Date('2025-01-01') }], new Date('2026-01-01'))).toBe(false));
  it('denies a different subject', () => expect(can({ subjectId: 'user_2', capability: 'organisation.read', resourceId: 'org_1', scopeId: 'tenant_1' }, [grant], new Date('2026-01-01'))).toBe(false));
  it('denies a different capability', () => expect(can({ subjectId: 'user_1', capability: 'organisation.delete', resourceId: 'org_1', scopeId: 'tenant_1' }, [grant], new Date('2026-01-01'))).toBe(false));
});
