import { describe, expect, it } from 'vitest';
import { canReadAssessmentData } from './assessment-policy';

describe('assessment data access policy', () => {
  it('permits platform administrators, organisation administrators, school administrators and assessors', () => {
    for (const role of ['platform_admin', 'organisation_admin', 'school_admin', 'assessor'] as const) {
      expect(canReadAssessmentData(role)).toBe(true);
    }
  });

  it('denies teachers, viewers and users without an active role', () => {
    for (const role of ['teacher', 'viewer', null] as const) {
      expect(canReadAssessmentData(role)).toBe(false);
    }
  });
});

