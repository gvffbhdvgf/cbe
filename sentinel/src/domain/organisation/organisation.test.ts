import { describe, expect, it } from 'vitest';
import { createOrganisation } from './organisation';

describe('createOrganisation', () => {
  it('creates an active organisation with a trimmed name and opaque id', () => {
    const organisation = createOrganisation({ name: '  Example School  ' });
    expect(organisation.name).toBe('Example School');
    expect(organisation.status).toBe('active');
    expect(organisation.id).toMatch(/^org_[0-9a-f-]{36}$/);
  });
  it('rejects a blank organisation name', () => {
    expect(() => createOrganisation({ name: '   ' })).toThrow('Organisation name is required');
  });
  it('normalises and validates issuer-namespaced identifiers', () => {
    const organisation = createOrganisation({ name: 'Example School', externalIdentifier: { issuer: '  KNEC  ', value: '  ABC-001  ' } });
    expect(organisation.externalIdentifier).toEqual({ issuer: 'KNEC', value: 'ABC-001' });
    expect(() => createOrganisation({ name: 'Example', externalIdentifier: { issuer: '', value: 'x' } })).toThrow('Identifier issuer and value are required');
  });
});
