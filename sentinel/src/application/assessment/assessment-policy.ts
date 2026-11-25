import type { ActorRole } from '@/application/organisation/membership-policy';

const assessmentReaderRoles: readonly ActorRole[] = [
  'platform_admin',
  'organisation_admin',
  'school_admin',
  'assessor',
];

export function canReadAssessmentData(role: ActorRole | null): boolean {
  return role !== null && assessmentReaderRoles.includes(role);
}

