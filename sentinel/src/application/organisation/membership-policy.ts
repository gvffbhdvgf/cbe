export type OrganisationRole = 'organisation_admin' | 'school_admin' | 'teacher' | 'assessor' | 'viewer';
export type ActorRole = OrganisationRole | 'platform_admin';

const grants: Record<ActorRole, OrganisationRole[]> = {
  platform_admin: ['organisation_admin', 'school_admin', 'teacher', 'assessor', 'viewer'],
  organisation_admin: ['school_admin', 'teacher', 'assessor', 'viewer'],
  school_admin: ['teacher', 'assessor', 'viewer'],
  teacher: [],
  assessor: [],
  viewer: [],
};

export function canManageMembers(role: ActorRole | null): boolean {
  return role === 'platform_admin' || role === 'organisation_admin' || role === 'school_admin';
}

export function canAssignRole(actorRole: ActorRole, targetRole: OrganisationRole): boolean {
  return grants[actorRole].includes(targetRole);
}

export function canRevokeRole(actorRole: ActorRole, targetRole: OrganisationRole): boolean {
  return canAssignRole(actorRole, targetRole);
}
