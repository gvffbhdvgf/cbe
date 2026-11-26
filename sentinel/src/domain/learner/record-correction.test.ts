import { describe, expect, it } from 'vitest';
import { createLearnerRecordCorrection } from './record-correction';

describe('governed learner record correction input', () => {
  const now = new Date('2026-11-26T00:00:00.000Z');

  it('normalises a partial identity correction without changing unsubmitted fields', () => {
    expect(createLearnerRecordCorrection({
      firstName: '  Amina  ',
      middleName: ' ',
      preferredName: ' Ami ',
      reason: 'Corrected from the original admission register',
      evidenceReference: 'REG-2026-014',
    }, now)).toEqual({
      changes: { firstName: 'Amina', middleName: null, preferredName: 'Ami' },
      reason: 'Corrected from the original admission register',
      evidenceReference: 'REG-2026-014',
    });
  });

  it('accepts an explicit null date of birth correction', () => {
    expect(createLearnerRecordCorrection({
      dateOfBirth: null,
      reason: 'Remove a date entered against the wrong learner',
    }, now).changes).toEqual({ dateOfBirth: null });
  });

  it('requires at least one supported identity field', () => {
    expect(() => createLearnerRecordCorrection({ reason: 'No fields selected' }, now))
      .toThrow('At least one supported identity field must be supplied');
  });

  it('rejects fields owned by enrolment and class lifecycle workflows', () => {
    expect(() => createLearnerRecordCorrection({ grade: 7, reason: 'Change the learner grade to seven' }, now))
      .toThrow('Unsupported learner correction field: grade');
    expect(() => createLearnerRecordCorrection({ learnerReference: 'LRN-123', reason: 'Change the internal learner reference' }, now))
      .toThrow('Unsupported learner correction field: learnerReference');
  });

  it('rejects blank required names and overlong names', () => {
    expect(() => createLearnerRecordCorrection({ firstName: ' ', reason: 'Correct the first name' }, now))
      .toThrow('First name cannot be blank');
    expect(() => createLearnerRecordCorrection({ lastName: 'L'.repeat(121), reason: 'Correct the last name' }, now))
      .toThrow('Last name must be 120 characters or fewer');
  });

  it('validates date of birth and rejects future dates', () => {
    expect(() => createLearnerRecordCorrection({ dateOfBirth: '2015-02-30', reason: 'Correct date of birth' }, now))
      .toThrow('Date of birth must be a valid YYYY-MM-DD date');
    expect(() => createLearnerRecordCorrection({ dateOfBirth: '2027-01-01', reason: 'Correct date of birth' }, now))
      .toThrow('Date of birth cannot be in the future');
  });

  it('requires a reason and bounds the evidence reference', () => {
    expect(() => createLearnerRecordCorrection({ firstName: 'Amina', reason: 'short' }, now))
      .toThrow('A correction reason of 10 to 500 characters is required');
    expect(() => createLearnerRecordCorrection({ firstName: 'Amina', reason: 'Corrected from a verified source register', evidenceReference: 'x' }, now))
      .toThrow('Evidence reference must be between 3 and 180 characters');
  });
});
