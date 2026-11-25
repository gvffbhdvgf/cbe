import { and, eq, isNull, lte, or, gt } from 'drizzle-orm';
import { createOrganisation, type ExternalIdentifier } from '@/domain/organisation';
import { db } from '@/infrastructure/database/client';
import { organisations } from '@/infrastructure/database/schema/organisation';
import { auditEvents, organisationMemberships, platformAdministrators } from '@/infrastructure/database/schema/security';

export type RegisterOrganisationInput = {
  name: string;
  externalIdentifier?: ExternalIdentifier;
};

export async function isPlatformAdministrator(userId: string): Promise<boolean> {
  const [admin] = await db.select({ userId: platformAdministrators.userId })
    .from(platformAdministrators)
    .where(and(eq(platformAdministrators.userId, userId), eq(platformAdministrators.status, 'active')))
    .limit(1);
  return Boolean(admin);
}

export async function listAccessibleOrganisations(userId: string) {
  const now = new Date();
  return db.select({
    id: organisations.id,
    name: organisations.name,
    status: organisations.status,
    role: organisationMemberships.role,
  }).from(organisationMemberships)
    .innerJoin(organisations, eq(organisationMemberships.organisationId, organisations.id))
    .where(and(
      eq(organisationMemberships.userId, userId),
      eq(organisationMemberships.status, 'active'),
      eq(organisations.status, 'active'),
      lte(organisationMemberships.startsAt, now),
      or(isNull(organisationMemberships.endsAt), gt(organisationMemberships.endsAt, now)),
    ));
}

export async function registerOrganisation(userId: string, input: RegisterOrganisationInput) {
  if (!await isPlatformAdministrator(userId)) throw new Error('Platform administrator access is required');
  const candidate = createOrganisation(input);
  const id = crypto.randomUUID();
  // Neon HTTP's batch API executes these dependent writes as one database transaction.
  await db.batch([
    db.insert(organisations).values({
      id,
      name: candidate.name,
      status: 'active',
      identifierIssuer: candidate.externalIdentifier?.issuer ?? null,
      identifierValue: candidate.externalIdentifier?.value ?? null,
    }),
    db.insert(organisationMemberships).values({
      organisationId: id,
      userId,
      role: 'organisation_admin',
      status: 'active',
      createdBy: userId,
    }),
    db.insert(auditEvents).values({
      actorUserId: userId,
      organisationId: id,
      action: 'organisation.created',
      resourceType: 'organisation',
      resourceId: id,
      metadata: { name: candidate.name, source: 'platform_admin_onboarding' },
    }),
  ]);
  return { id, name: candidate.name, status: 'active', role: 'organisation_admin' as const };
}
