import { describe, expect, it } from 'vitest';
import { createClassDefinition } from './class';

describe('createClassDefinition', () => {
  it('normalises the class code and trims the display name', () => {
    expect(createClassDefinition({ grade: 4, academicYear: 2026, classCode: ' stream-a ', displayName: '  Grade 4 East  ' })).toEqual({
      grade: 4, academicYear: 2026, classCode: 'STREAM-A', displayName: 'Grade 4 East',
    });
  });
  it('rejects grades outside the KICD Grades 1–9 catalogue', () => {
    expect(() => createClassDefinition({ grade: 10, academicYear: 2026, classCode: 'A', displayName: 'Grade 10 A' })).toThrow('Grade must be an integer from 1 to 9');
  });
  it('rejects invalid academic years', () => {
    expect(() => createClassDefinition({ grade: 1, academicYear: 1999, classCode: 'A', displayName: 'Grade 1 A' })).toThrow('Academic year must be between 2000 and 2100');
  });
  it('rejects blank or malformed class codes', () => {
    expect(() => createClassDefinition({ grade: 1, academicYear: 2026, classCode: ' ', displayName: 'Grade 1 A' })).toThrow('Class code must use');
    expect(() => createClassDefinition({ grade: 1, academicYear: 2026, classCode: 'A EAST', displayName: 'Grade 1 A' })).toThrow('Class code must use');
  });
  it('requires a non-empty display name within the database limit', () => {
    expect(() => createClassDefinition({ grade: 1, academicYear: 2026, classCode: 'A', displayName: '  ' })).toThrow('Class name is required');
    expect(() => createClassDefinition({ grade: 1, academicYear: 2026, classCode: 'A', displayName: 'x'.repeat(121) })).toThrow('Class name must be 120 characters or fewer');
  });
});
