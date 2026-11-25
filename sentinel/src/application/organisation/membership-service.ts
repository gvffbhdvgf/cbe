import { and, count, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { db } from '@/infrastructure/database/client';
import { organisations } from '@/infrastructure/database/schema/organisation';
import { auditEvents, authUsers, organisationMemberships, platformAdministrators } from '@/infrastructure/database/schema/security';
import { canAssignRole, canManageMembers, canRevokeRole, type ActorRole, type OrganisationRole } from './membership-policy';

function isOrganisationRole(value: string): value is OrganisationRole {
  return ['organisation_admin', 'school_admin', 'teacher', 'assessor', 'viewer'].includes(value);
}

export async function getOrganisationActorRole(userId: string, organisationId: string): Promise<ActorRole | null> {
  const [platformAdmin] = await db.select({ userId: platformAdministrators.userId })
    .from(platformAdministrators)
    .where(and(eq(platformAdministrators.userId, userId), eq(platformAdministrators.status, 'active')))
    .limit(1);
  if (platformAdmin) return 'platform_admin';

  const now = new Date();
  const [membership] = await db.select({ role: organisationMemberships.role })
    .from(organisationMemberships)
    .innerJoin(organisations, eq(organisationMemberships.organisationId, organisations.id))
    .where(and(
      eq(organisationMemberships.organisationId, organisationId),
      eq(organisationMemberships.userId, userId),
      eq(organisationMemberships.status, 'active'),
      eq(organisations.status, 'active'),
      lte(organisationMemberships.startsAt, now),
      or(isNull(organisationMemberships.endsAt), gt(organisationMemberships.endsAt, now)),
    ))
    .limit(1);
  return membership && isOrganisationRole(membership.role) ? membership.role : null;
}

async function requireMemberManager(userId: string, organisationId: string): Promise<ActorRole> {
  const role = await getOrganisationActorRole(userId, organisationId);
  if (!role || !canManageMembers(role)) throw new Error('You do not have permission to manage this organisation\'s members');
  return role;
}

export async function listOrganisationMembers(actorUserId: string, organisationId: string) {
  await requireMemberManager(actorUserId, organisationId);
  const now = new Date();
  return db.select({
    id: organisationMemberships.id,
    userId: authUsers.id,
    name: authUsers.name,
    email: authUsers.email,
    role: organisationMemberships.role,
    startsAt: organisationMemberships.startsAt,
    endsAt: organisationMemberships.endsAt,
  })
    .from(organisationMemberships)
    .innerJoin(authUsers, eq(organisationMemberships.userId, authUsers.id))
    .where(and(
      eq(organisationMemberships.organisationId, organisationId),
      eq(organisationMemberships.status, 'active'),
      lte(organisationMemberships.startsAt, now),
      or(isNull(organisationMemberships.endsAt), gt(organisationMemberships.endsAt, now)),
    ));
}

export async function grantOrganisationMembership(
  actorUserId: string,
  organisationId: string,
  email: string,
  role: OrganisationRole,
) {
  const actorRole = await requireMemberManager(actorUserId, organisationId);
  if (!canAssignRole(actorRole, role)) throw new Error('Your role cannot grant the requested organisation role');

  const [organisation] = await db.select({ id: organisations.id, name: organisations.name })
    .from(organisations)
    .where(and(eq(organisations.id, organisationId), eq(organisations.status, 'active')))
    .limit(1);
  if (!organisation) throw new Error('Organisation not found or inactive');

  const normalizedEmail = email.trim().toLowerCase();
  const [user] = await db.select({ id: authUsers.id, email: authUsers.email, name: authUsers.name })
    .from(authUsers)
    .where(and(
      eq(authUsers.email, normalizedEmail),
      eq(authUsers.emailVerified, true),
      or(isNull(authUsers.banned), eq(authUsers.banned, false)),
    ))
    .limit(1);
  if (!user) throw new Error('A verified, active Sentinel account must exist before membership can be granted');
  if (user.id === actorUserId) throw new Error('You cannot change your own organisation role');

  const existing = await db.select({
    id: organisationMemberships.id,
    role: organisationMemberships.role,
    status: organisationMemberships.status,
    startsAt: organisationMemberships.startsAt,
    endsAt: organisationMemberships.endsAt,
  }).from(organisationMemberships)
    .where(and(eq(organisationMemberships.organisationId, organisationId), eq(organisationMemberships.userId, user.id)));

  const now = new Date();
  const current = existing.find((membership) => membership.status === 'active');
  if (current?.role === role && current.startsAt <= now && (!current.endsAt || current.endsAt > now)) {
    throw new Error('This user already has the requested active organisation role');
  }
  const targetRecord = existing.find((membership) => membership.role === role);
  const membershipId = targetRecord?.id ?? crypto.randomUUID();
  const action = current ? 'organisation.membership.role_changed' : 'organisation.membership.granted';

  const statements = [];
  if (current) {
    statements.push(db.update(organisationMemberships).set({ status: 'revoked', endsAt: now, updatedAt: now })
      .where(eq(organisationMemberships.id, current.id)));
  }
  if (targetRecord) {
    statements.push(db.update(organisationMemberships).set({ status: 'active', startsAt: now, endsAt: null, updatedAt: now })
      .where(eq(organisationMemberships.id, targetRecord.id)));
  } else {
    statements.push(db.insert(organisationMemberships).values({
      id: membershipId,
      organisationId,
      userId: user.id,
      role,
      status: 'active',
      startsAt: now,
      createdBy: actorUserId,
    }));
  }
  statements.push(db.insert(auditEvents).values({
    actorUserId,
    organisationId,
    action,
    resourceType: 'organisation_membership',
    resourceId: membershipId,
    metadata: { email: user.email, role, previousRole: current?.role ?? null },
  }));
  await db.batch(statements as [typeof statements[number], ...typeof statements]);
  return { id: membershipId, userId: user.id, name: user.name, email: user.email, role, status: 'active' as const };
}

export async function revokeOrganisationMembership(actorUserId: string, organisationId: string, membershipId: string) {
  const actorRole = await requireMemberManager(actorUserId, organisationId);
  const [target] = await db.select({
    id: organisationMemberships.id,
    userId: organisationMemberships.userId,
    role: organisationMemberships.role,
    status: organisationMemberships.status,
  }).from(organisationMemberships)
    .where(and(eq(organisationMemberships.id, membershipId), eq(organisationMemberships.organisationId, organisationId)))
    .limit(1);
  if (!target) throw new Error('Organisation membership not found');
  if (target.status !== 'active') throw new Error('This organisation membership is not active');
  if (!isOrganisationRole(target.role) || !canRevokeRole(actorRole, target.role)) {
    throw new Error('Your role cannot revoke this organisation membership');
  }

  if (target.role === 'organisation_admin') {
    const now = new Date();
    const [result] = await db.select({ total: count() }).from(organisationMemberships)
      .where(and(
        eq(organisationMemberships.organisationId, organisationId),
        eq(organisationMemberships.role, 'organisation_admin'),
        eq(organisationMemberships.status, 'active'),
        lte(organisationMemberships.startsAt, now),
        or(isNull(organisationMemberships.endsAt), gt(organisationMemberships.endsAt, now)),
      ));
    if ((result?.total ?? 0) <= 1) throw new Error('The last active organisation administrator cannot be revoked');
  }

  const now = new Date();
  await db.batch([
    db.update(organisationMemberships).set({ status: 'revoked', endsAt: now, updatedAt: now })
      .where(eq(organisationMemberships.id, membershipId)),
    db.insert(auditEvents).values({
      actorUserId,
      organisationId,
      action: 'organisation.membership.revoked',
      resourceType: 'organisation_membership',
      resourceId: membershipId,
      metadata: { userId: target.userId, role: target.role },
    }),
  ]);
  return { id: membershipId, status: 'revoked' as const };
}

export async function getOrganisationManagementSummary(actorUserId: string, organisationId: string) {
  const actorRole = await requireMemberManager(actorUserId, organisationId);
  const [organisation] = await db.select({ id: organisations.id, name: organisations.name })
    .from(organisations)
    .where(and(eq(organisations.id, organisationId), eq(organisations.status, 'active')))
    .limit(1);
  if (!organisation) throw new Error('Organisation not found or inactive');
  const members = await listOrganisationMembers(actorUserId, organisationId);
  return { organisation, members, actorRole };
}
