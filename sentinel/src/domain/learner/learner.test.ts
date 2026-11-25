import { describe, expect, it } from 'vitest';
import { createLearnerRegistration } from './learner';

describe('learner registration invariants', () => {
  it('normalises names and accepts optional date of birth', () => {
    expect(createLearnerRegistration({ firstName: '  Amina ', middleName: ' ', lastName: ' Otieno ', preferredName: ' Ami ', dateOfBirth: '2015-04-10', grade: 6, academicYear: 2026 }, new Date('2026-01-01T00:00:00Z'))).toEqual({ firstName: 'Amina', middleName: null, lastName: 'Otieno', preferredName: 'Ami', dateOfBirth: '2015-04-10', grade: 6, academicYear: 2026 });
  });
  it('requires first and last names', () => {
    expect(() => createLearnerRegistration({ firstName: ' ', lastName: 'Otieno', grade: 6, academicYear: 2026 })).toThrow('Learner first and last names are required');
  });
  it('rejects invalid grade and academic year', () => {
    expect(() => createLearnerRegistration({ firstName: 'Amina', lastName: 'Otieno', grade: 10, academicYear: 2026 })).toThrow('Grade must be an integer from 1 to 9');
    expect(() => createLearnerRegistration({ firstName: 'Amina', lastName: 'Otieno', grade: 6, academicYear: 1890 })).toThrow('Academic year must be between 2000 and 2100');
  });
  it('rejects malformed and future dates of birth', () => {
    expect(() => createLearnerRegistration({ firstName: 'Amina', lastName: 'Otieno', grade: 6, academicYear: 2026, dateOfBirth: '2015-02-30' })).toThrow('Date of birth must be a valid YYYY-MM-DD date');
    expect(() => createLearnerRegistration({ firstName: 'Amina', lastName: 'Otieno', grade: 6, academicYear: 2026, dateOfBirth: '2030-01-01' }, new Date('2026-01-01T00:00:00Z'))).toThrow('Date of birth cannot be in the future');
  });
  it('limits name lengths', () => {
    expect(() => createLearnerRegistration({ firstName: 'A'.repeat(121), lastName: 'Otieno', grade: 6, academicYear: 2026 })).toThrow('First name must be 120 characters or fewer');
  });
});
