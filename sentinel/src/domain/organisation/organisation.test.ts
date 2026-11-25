import { describe, expect, it } from 'vitest';
import { createOrganisation } from './organisation';

describe('createOrganisation', () => {
  it('creates an active organisation with a trimmed name and opaque id', () => {
    const organisation = createOrganisation({ name: '  Example School  ' });
    expect(organisation.name).toBe('Example School');
    expect(organisation.status).toBe('active');
    expect(organisation.id).toMatch(/^[0-9a-f-]{36}$/);
  });
  it('rejects a blank or oversized organisation name', () => {
    expect(() => createOrganisation({ name: '   ' })).toThrow('Organisation name is required');
    expect(() => createOrganisation({ name: 'x'.repeat(241) })).toThrow('Organisation name must be 240 characters or fewer');
  });
  it('normalises and validates issuer-namespaced identifiers', () => {
    const organisation = createOrganisation({ name: 'Example School', externalIdentifier: { issuer: '  KNEC  ', value: '  ABC-001  ' } });
    expect(organisation.externalIdentifier).toEqual({ issuer: 'KNEC', value: 'ABC-001' });
    expect(() => createOrganisation({ name: 'Example', externalIdentifier: { issuer: '', value: 'x' } })).toThrow('Identifier issuer and value are required');
    expect(() => createOrganisation({ name: 'Example', externalIdentifier: { issuer: 'x'.repeat(121), value: 'y' } })).toThrow('Identifier issuer must be 120 characters or fewer');
    expect(() => createOrganisation({ name: 'Example', externalIdentifier: { issuer: 'x', value: 'y'.repeat(181) } })).toThrow('Identifier value must be 180 characters or fewer');
  });
});
