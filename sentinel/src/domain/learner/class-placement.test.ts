import { describe, expect, it } from 'vitest';
import { createClassPlacement } from './class-placement';

describe('createClassPlacement', () => {
  it('accepts a UUID class and valid ISO calendar date', () => {
    expect(createClassPlacement({ classId: '11111111-1111-4111-8111-111111111111', effectiveAt: '2026-01-15' })).toEqual({
      classId: '11111111-1111-4111-8111-111111111111', effectiveAt: '2026-01-15',
    });
  });
  it('rejects an invalid class identifier', () => {
    expect(() => createClassPlacement({ classId: 'class-a', effectiveAt: '2026-01-15' })).toThrow('A valid class ID is required');
  });
  it('rejects malformed or impossible dates', () => {
    expect(() => createClassPlacement({ classId: '11111111-1111-4111-8111-111111111111', effectiveAt: '15/01/2026' })).toThrow('YYYY-MM-DD');
    expect(() => createClassPlacement({ classId: '11111111-1111-4111-8111-111111111111', effectiveAt: '2026-02-30' })).toThrow('real calendar date');
  });
});
