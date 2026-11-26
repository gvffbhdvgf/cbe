import { and, asc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/infrastructure/database/client';
import { organisations } from '@/infrastructure/database/schema/organisation';
import { authUsers } from '@/infrastructure/database/schema/security';
import { guardianProfiles, guardianRelationships, learnerEnrolments, learnerProfiles, people } from '@/infrastructure/database/schema/learner';
import { requireLearnerManager } from '@/application/learner/learner-service';
import { withAuthenticatedLearnerDb } from '@/infrastructure/database/learner-rls-client';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const relationshipTypes = ['mother','father','parent','legal_guardian','foster_parent','grandparent','sibling','relative','other'] as const;
const verificationMethods = ['school_record','official_document','in_person','guardian_otp','other'] as const;

export class GuardianManagementError extends Error {
  readonly status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.name = 'GuardianManagementError';
    this.status = status;
  }
}

async function assertGuardianManager(actorUserId: string, organisationId: string) {
  try {
    await requireLearnerManager(actorUserId, organisationId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Guardian management is not authorised';
    throw new GuardianManagementError(message, message.includes('not found') ? 404 : 403);
  }
}

export async function getGuardianManagementSummary(actorUserId: string, organisationId: string, personSearch = '') {
  await assertGuardianManager(actorUserId, organisationId);
  if (!uuidPattern.test(organisationId)) throw new GuardianManagementError('A valid organisation identifier is required', 400);
  const [organisation] = await db.select({ id: organisations.id, name: organisations.name, timeZone: organisations.timeZone })
    .from(organisations).where(and(eq(organisations.id, organisationId), eq(organisations.status, 'active'))).limit(1);
  if (!organisation) throw new GuardianManagementError('Organisation not found or inactive', 404);

  const [learners, profiles, relationships] = await Promise.all([
    db.select({
      id: learnerProfiles.id, learnerReference: learnerProfiles.learnerReference,
      firstName: people.legalFirstName, lastName: people.legalLastName, preferredName: people.preferredName,
      grade: learnerEnrolments.grade, academicYear: learnerEnrolments.academicYear,
      enrolmentStatus: learnerEnrolments.status,
    }).from(learnerProfiles)
      .innerJoin(people, and(eq(learnerProfiles.personId, people.id), eq(learnerProfiles.tenantOrganisationId, people.tenantOrganisationId)))
      .innerJoin(learnerEnrolments, and(eq(learnerEnrolments.learnerId, learnerProfiles.id), eq(learnerEnrolments.tenantOrganisationId, learnerProfiles.tenantOrganisationId)))
      .where(and(eq(learnerProfiles.tenantOrganisationId, organisationId), eq(learnerProfiles.status, 'active'),
        eq(learnerEnrolments.organisationId, organisationId), eq(learnerEnrolments.status, 'active')))
      .orderBy(asc(people.legalLastName), asc(people.legalFirstName)),
    db.select({
      id: guardianProfiles.id, personId: guardianProfiles.personId, contactEmail: guardianProfiles.contactEmail,
      verificationStatus: guardianProfiles.verificationStatus, status: guardianProfiles.status,
      userId: guardianProfiles.userId, linkedEmail: authUsers.email, verifiedAt: guardianProfiles.verifiedAt,
    }).from(guardianProfiles)
      .innerJoin(people, and(eq(guardianProfiles.personId, people.id), eq(guardianProfiles.tenantOrganisationId, people.tenantOrganisationId)))
      .leftJoin(authUsers, eq(guardianProfiles.userId, authUsers.id))
      .where(eq(guardianProfiles.tenantOrganisationId, organisationId))
      .orderBy(asc(people.legalLastName), asc(people.legalFirstName)),
    db.select({
      id: guardianRelationships.id, learnerId: guardianRelationships.learnerId,
      guardianPersonId: guardianRelationships.guardianPersonId, relationshipType: guardianRelationships.relationshipType,
      verificationStatus: guardianRelationships.verificationStatus, status: guardianRelationships.status,
      canViewProgress: guardianRelationships.canViewProgress, canReceiveMessages: guardianRelationships.canReceiveMessages,
      startsAt: guardianRelationships.startsAt, endsAt: guardianRelationships.endsAt,
      verifiedAt: guardianRelationships.verifiedAt, verifiedBy: guardianRelationships.verifiedBy,
      revokedAt: guardianRelationships.revokedAt,
    }).from(guardianRelationships)
      .where(eq(guardianRelationships.tenantOrganisationId, organisationId))
      .orderBy(asc(guardianRelationships.createdAt)),
  ]);

  const search = personSearch.trim();
  const personMatches = search.length < 2 ? [] : await db.select({
    id: people.id, legalFirstName: people.legalFirstName, legalMiddleName: people.legalMiddleName,
    legalLastName: people.legalLastName, preferredName: people.preferredName,
  }).from(people)
    .where(and(eq(people.tenantOrganisationId, organisationId),
      or(ilike(people.legalFirstName, `%${search}%`), ilike(people.legalLastName, `%${search}%`), ilike(people.preferredName, `%${search}%`))))
    .orderBy(asc(people.legalLastName), asc(people.legalFirstName)).limit(12);

  const normalizedProfiles = profiles.map(profile => ({ ...profile, verifiedAt: profile.verifiedAt?.toISOString() ?? null }));
  const normalizedRelationships = relationships.map(relationship => ({
    ...relationship,
    startsAt: relationship.startsAt.toISOString(),
    endsAt: relationship.endsAt?.toISOString() ?? null,
    verifiedAt: relationship.verifiedAt?.toISOString() ?? null,
    revokedAt: relationship.revokedAt?.toISOString() ?? null,
  }));
  const personIds = [...new Set([...profiles.map(p => p.personId), ...relationships.map(r => r.guardianPersonId)])];
  const guardianPeople = personIds.length ? await db.select({
    id: people.id, firstName: people.legalFirstName, middleName: people.legalMiddleName,
    lastName: people.legalLastName, preferredName: people.preferredName,
  }).from(people).where(and(eq(people.tenantOrganisationId, organisationId), inArray(people.id, personIds))) : [];
  const learnerById = new Map(learners.map(l => [l.id, l]));
  const personById = new Map(guardianPeople.map(p => [p.id, p]));
  const profileByPerson = new Map(normalizedProfiles.map(p => [p.personId, p]));
  return {
    organisation, learners, personMatches,
    guardians: normalizedProfiles.map(profile => ({
      ...profile,
      person: personById.get(profile.personId) ?? null,
      relationships: normalizedRelationships.filter(r => r.guardianPersonId === profile.personId).map(r => ({
        ...r, learner: learnerById.get(r.learnerId) ?? null,
      })),
    })),
  };
}

export async function createGuardianRelationship(actorUserId: string, organisationId: string, input: {
  learnerId: string; personId: string | null; firstName: string | null; middleName: string | null;
  lastName: string | null; preferredName: string | null; contactEmail: string | null;
  relationshipType: string; startsOn: string; endsOn: string | null; confirmDistinctPerson: boolean;
}) {
  await assertGuardianManager(actorUserId, organisationId);
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(input.learnerId) || (input.personId !== null && !uuidPattern.test(input.personId))) {
    throw new GuardianManagementError('Valid organisation, learner and person identifiers are required', 400);
  }
  if (!relationshipTypes.includes(input.relationshipType as typeof relationshipTypes[number])) throw new GuardianManagementError('Choose a valid relationship type', 400);
  if (!datePattern.test(input.startsOn) || (input.endsOn !== null && (!datePattern.test(input.endsOn) || input.endsOn <= input.startsOn))) {
    throw new GuardianManagementError('A valid relationship date range is required', 400);
  }
  const email = input.contactEmail?.trim().toLowerCase() || null;
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new GuardianManagementError('Enter a valid guardian contact email', 400);
  if (input.personId === null && (!input.confirmDistinctPerson || !input.firstName?.trim() || !input.lastName?.trim())) {
    throw new GuardianManagementError('Search for an existing person first; confirm a distinct person before creating a new guardian record', 400);
  }
  return withAuthenticatedLearnerDb(actorUserId, async tx => {
    const result = await tx.execute(sql`SELECT * FROM sentinel_private.create_guardian_relationship(
      ${organisationId}::uuid, ${input.learnerId}::uuid, ${input.personId}::uuid,
      ${input.firstName}::text, ${input.middleName}::text, ${input.lastName}::text, ${input.preferredName}::text,
      ${email}::text, ${input.relationshipType}::text, ${input.startsOn}::date, ${input.endsOn}::date,
      ${input.confirmDistinctPerson}::boolean
    )`);
    const row = result.rows[0];
    if (!row?.guardian_profile_id || !row?.relationship_id) throw new GuardianManagementError('The database did not confirm the guardian relationship');
    return { guardianProfileId: row.guardian_profile_id, relationshipId: row.relationship_id };
  });
}

export async function reviewGuardianProfile(actorUserId: string, organisationId: string, profileId: string, input: {
  decision: string; method: string; evidenceReference: string; rejectionReason: string | null;
}) {
  await assertGuardianManager(actorUserId, organisationId);
  if (![organisationId, profileId].every(v => uuidPattern.test(v))) throw new GuardianManagementError('Valid organisation and guardian profile identifiers are required', 400);
  if (!['verified','rejected'].includes(input.decision) || !verificationMethods.includes(input.method as typeof verificationMethods[number])
    || input.evidenceReference.trim().length < 3 || input.evidenceReference.trim().length > 160
    || (input.decision === 'rejected' && (!input.rejectionReason?.trim() || input.rejectionReason.trim().length > 300))) {
    throw new GuardianManagementError('A decision, verification method and evidence reference are required; rejected profiles also need a reason', 400);
  }
  return withAuthenticatedLearnerDb(actorUserId, async tx => {
    await tx.execute(sql`SELECT sentinel_private.review_guardian_profile(
      ${organisationId}::uuid, ${profileId}::uuid, ${input.decision}::text, ${input.method}::text,
      ${input.evidenceReference.trim()}::text, ${input.rejectionReason?.trim() || null}::text
    )`);
    return { guardianProfileId: profileId, decision: input.decision };
  });
}

export async function reviewGuardianRelationship(actorUserId: string, organisationId: string, relationshipId: string, input: {
  decision: string; method: string; evidenceReference: string; rejectionReason: string | null;
  canViewProgress: boolean; canReceiveMessages: boolean;
}) {
  await assertGuardianManager(actorUserId, organisationId);
  if (![organisationId, relationshipId].every(v => uuidPattern.test(v))) throw new GuardianManagementError('Valid organisation and relationship identifiers are required', 400);
  if (!['verified','rejected'].includes(input.decision) || !verificationMethods.includes(input.method as typeof verificationMethods[number])
    || input.evidenceReference.trim().length < 3 || input.evidenceReference.trim().length > 160
    || (input.decision === 'rejected' && (!input.rejectionReason?.trim() || input.rejectionReason.trim().length > 300))) {
    throw new GuardianManagementError('A decision, verification method and evidence reference are required; rejected relationships also need a reason', 400);
  }
  return withAuthenticatedLearnerDb(actorUserId, async tx => {
    await tx.execute(sql`SELECT sentinel_private.review_guardian_relationship(
      ${organisationId}::uuid, ${relationshipId}::uuid, ${input.decision}::text, ${input.method}::text,
      ${input.evidenceReference.trim()}::text, ${input.rejectionReason?.trim() || null}::text,
      ${input.canViewProgress}::boolean, ${input.canReceiveMessages}::boolean
    )`);
    return { relationshipId, decision: input.decision };
  });
}

export async function linkGuardianAccount(actorUserId: string, organisationId: string, profileId: string, email: string) {
  await assertGuardianManager(actorUserId, organisationId);
  if (![organisationId, profileId].every(v => uuidPattern.test(v)) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new GuardianManagementError('Valid organisation, guardian profile and account email are required', 400);
  }
  return withAuthenticatedLearnerDb(actorUserId, async tx => {
    await tx.execute(sql`SELECT sentinel_private.link_guardian_account(${organisationId}::uuid, ${profileId}::uuid, ${email.trim().toLowerCase()}::text)`);
    return { guardianProfileId: profileId };
  });
}

export async function revokeGuardianRelationship(actorUserId: string, organisationId: string, relationshipId: string, reason: string) {
  await assertGuardianManager(actorUserId, organisationId);
  if (![organisationId, relationshipId].every(v => uuidPattern.test(v)) || reason.trim().length < 3 || reason.trim().length > 300) {
    throw new GuardianManagementError('A valid relationship and revocation reason are required', 400);
  }
  return withAuthenticatedLearnerDb(actorUserId, async tx => {
    await tx.execute(sql`SELECT sentinel_private.revoke_guardian_relationship(
      ${organisationId}::uuid, ${relationshipId}::uuid, ${reason.trim()}::text
    )`);
    return { relationshipId, revoked: true };
  });
}
