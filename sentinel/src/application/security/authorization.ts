export type AccessGrant = {
  subjectId: string;
  capability: string;
  resourceId: string;
  scopeIds: string[];
  expiresAt?: Date;
};

export type AccessRequest = {
  subjectId: string;
  capability: string;
  resourceId: string;
  scopeId: string;
};

export function can(request: AccessRequest, grants: AccessGrant[], now = new Date()): boolean {
  return grants.some((grant) =>
    grant.subjectId === request.subjectId &&
    grant.capability === request.capability &&
    grant.resourceId === request.resourceId &&
    grant.scopeIds.includes(request.scopeId) &&
    (!grant.expiresAt || grant.expiresAt.getTime() > now.getTime()),
  );
}
