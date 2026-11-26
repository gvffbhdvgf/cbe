import { and, asc, eq, gt, ilike, isNull, lte, notExists, or, sql } from 'drizzle-orm';
import { db } from '@/infrastructure/database/client';
import { organisations } from '@/infrastructure/database/schema/organisation';
import { authUsers, organisationMemberships } from '@/infrastructure/database/schema/security';
import { people } from '@/infrastructure/database/schema/learner';
import { staffEngagements, staffProfiles } from '@/infrastructure/database/schema/staff';
import { requireLearnerManager } from '@/application/learner/learner-service';
import { withAuthenticatedLearnerDb } from '@/infrastructure/database/learner-rls-client';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\\d{4}-\\d{2}-\\d{2}$/;
const staffCategories = ['teacher', 'school_leader', 'administrator', 'support_staff', 'specialist', 'other'] as const;
const engagementTypes = ['permanent', 'contract', 'casual', 'volunteer', 'internship', 'other'] as const;

export class StaffProfileError extends Error {
  readonly status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.name = 'StaffProfileError';
    this.status = status;
  }
}

async function assertStaffManager(actorUserId: string, organisationId: string) {
  try {
    await requireLearnerManager(actorUserId, organisationId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Staff management is not authorised';
    throw new StaffProfileError(message, message.includes('not found') ? 404 : 403);
  }
}

export async function getStaffManagementSummary(actorUserId: string, organisationId: string, personSearch = '') {
  await assertStaffManager(actorUserId, organisationId);
  if (!uuidPattern.test(organisationId)) throw new StaffProfileError('A valid organisation identifier is required', 400);

  const [organisation] = await db.select({ id: organisations.id, name: organisations.name, timeZone: organisations.timeZone })
    .from(organisations)
    .where(and(eq(organisations.id, organisationId), eq(organisations.status, 'active')))
    .limit(1);
  if (!organisation) throw new StaffProfileError('Organisation not found or inactive', 404);

  const now = new Date();
  const [staffRows, engagementRows, eligibleTeacherAccounts] = await Promise.all([
    db.select({
      id: staffProfiles.id,
      personId: staffProfiles.personId,
      staffReference: staffProfiles.staffReference,
      staffCategory: staffProfiles.staffCategory,
      status: staffProfiles.status,
      userId: staffProfiles.userId,
      linkedEmail: authUsers.email,
      legalFirstName: people.legalFirstName,
      legalMiddleName: people.legalMiddleName,
      legalLastName: people.legalLastName,
      preferredName: people.preferredName,
    })
      .from(staffProfiles)
      .innerJoin(people, and(eq(staffProfiles.personId, people.id), eq(staffProfiles.tenantOrganisationId, people.tenantOrganisationId)))
      .leftJoin(authUsers, eq(staffProfiles.userId, authUsers.id))
      .where(eq(staffProfiles.organisationId, organisationId))
      .orderBy(asc(staffProfiles.staffReference)),
    db.select({
      id: staffEngagements.id,
      staffProfileId: staffEngagements.staffProfileId,
      engagementType: staffEngagements.engagementType,
      jobTitle: staffEngagements.jobTitle,
      startsOn: staffEngagements.startsOn,
      endsOn: staffEngagements.endsOn,
      status: staffEngagements.status,
    })
      .from(staffEngagements)
      .where(eq(staffEngagements.organisationId, organisationId))
      .orderBy(asc(staffEngagements.startsOn)),
    db.select({ userId: authUsers.id, name: authUsers.name, email: authUsers.email })
      .from(organisationMemberships)
      .innerJoin(authUsers, eq(organisationMemberships.userId, authUsers.id))
      .leftJoin(staffProfiles, and(eq(staffProfiles.organisationId, organisationId), eq(staffProfiles.userId, authUsers.id)))
      .where(and(
        eq(organisationMemberships.organisationId, organisationId),
        eq(organisationMemberships.role, 'teacher'),
        eq(organisationMemberships.status, 'active'),
        lte(organisationMemberships.startsAt, now),
        or(isNull(organisationMemberships.endsAt), gt(organisationMemberships.endsAt, now)),
        eq(authUsers.emailVerified, true),
        or(eq(authUsers.banned, false), isNull(authUsers.banned)),
        isNull(staffProfiles.id),
      ))
      .orderBy(asc(authUsers.name)),
  ]);

  const search = personSearch.trim();
  const personMatches = search.length < 2 ? [] : await db.select({
    id: people.id,
    legalFirstName: people.legalFirstName,
    legalMiddleName: people.legalMiddleName,
    legalLastName: people.legalLastName,
    preferredName: people.preferredName,
  })
    .from(people)
    .where(and(
      eq(people.tenantOrganisationId, organisationId),
      or(ilike(people.legalFirstName, `%${search}%`), ilike(people.legalLastName, `%${search}%`), ilike(people.preferredName, `%${search}%`)),
      notExists(db.select({ id: staffProfiles.id }).from(staffProfiles).where(and(
        eq(staffProfiles.organisationId, organisationId),
        eq(staffProfiles.personId, people.id),
      ))),
    ))
    .limit(12)
    .orderBy(asc(people.legalLastName), asc(people.legalFirstName));

  const staff = staffRows.map(profile => ({
    ...profile,
    engagements: engagementRows.filter(engagement => engagement.staffProfileId === profile.id),
  }));

  return { organisation, staff, eligibleTeacherAccounts, personMatches };
}

export async function createStaffProfile(
  actorUserId: string,
  organisationId: string,
  input: {
    personId: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
    preferredName: string | null;
    staffReference: string;
    staffCategory: string;
    jobTitle: string;
    engagementType: string;
    startsOn: string;
    endsOn: string | null;
    confirmDistinctPerson: boolean;
  },
) {
  await assertStaffManager(actorUserId, organisationId);
  if (!uuidPattern.test(organisationId) || (input.personId !== null && !uuidPattern.test(input.personId))) {
    throw new StaffProfileError('A valid organisation or person identifier is required', 400);
  }
  const staffReference = input.staffReference.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._/-]{1,47}$/.test(staffReference)) throw new StaffProfileError('Staff reference must be 2–48 letters, numbers or . _ / - characters', 400);
  if (!staffCategories.includes(input.staffCategory as typeof staffCategories[number])) throw new StaffProfileError('Choose a valid staff category', 400);
  if (!input.jobTitle.trim() || input.jobTitle.trim().length > 120) throw new StaffProfileError('Job title is required and must be 120 characters or fewer', 400);
  if (!engagementTypes.includes(input.engagementType as typeof engagementTypes[number])) throw new StaffProfileError('Choose a valid engagement type', 400);
  if (!datePattern.test(input.startsOn) || (input.endsOn !== null && (!datePattern.test(input.endsOn) || input.endsOn <= input.startsOn))) {
    throw new StaffProfileError('A valid engagement date range is required', 400);
  }

  if (input.personId === null) {
    if (!input.confirmDistinctPerson) throw new StaffProfileError('Confirm that you checked for an existing person record before creating a new person', 400);
    if (!input.firstName?.trim() || !input.lastName?.trim()) throw new StaffProfileError('Legal first and last names are required for a new person', 400);
    const matches = await db.select({ id: people.id, legalFirstName: people.legalFirstName, legalLastName: people.legalLastName })
      .from(people)
      .where(and(
        eq(people.tenantOrganisationId, organisationId),
        sql`lower(btrim(${people.legalFirstName})) = lower(btrim(${input.firstName.trim()}))`,
        sql`lower(btrim(${people.legalLastName})) = lower(btrim(${input.lastName.trim()}))`,
      ))
      .limit(5);
    if (matches.length > 0 && !input.confirmDistinctPerson) {
      throw new StaffProfileError('A person with these legal names already exists. Select the existing person or confirm this is a different person.', 409);
    }
  }

  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.create_staff_profile(
      ${organisationId}::uuid, ${input.personId}::uuid, ${input.firstName}::text,
      ${input.middleName}::text, ${input.lastName}::text, ${input.preferredName}::text,
      ${staffReference}::text, ${input.staffCategory}::text, ${input.jobTitle.trim()}::text,
      ${input.engagementType}::text, ${input.startsOn}::date, ${input.endsOn}::date
    ) AS staff_profile_id`);
    const staffProfileId = result.rows[0]?.staff_profile_id;
    if (!staffProfileId) throw new StaffProfileError('The database did not confirm the staff profile');
    return { staffProfileId };
  });
}

export async function linkStaffAccount(actorUserId: string, organisationId: string, staffProfileId: string, userId: string) {
  await assertStaffManager(actorUserId, organisationId);
  if (![organisationId, staffProfileId, userId].every(value => uuidPattern.test(value))) throw new StaffProfileError('Valid organisation, staff profile and user identifiers are required', 400);
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.link_staff_account(
      ${organisationId}::uuid, ${staffProfileId}::uuid, ${userId}::uuid
    ) AS staff_profile_id`);
    if (!result.rows[0]?.staff_profile_id) throw new StaffProfileError('The database did not confirm the staff account link');
    return { staffProfileId };
  });
}

export async function endStaffEngagement(actorUserId: string, organisationId: string, engagementId: string, endsOn: string) {
  await assertStaffManager(actorUserId, organisationId);
  if (![organisationId, engagementId].every(value => uuidPattern.test(value)) || !datePattern.test(endsOn)) {
    throw new StaffProfileError('Valid organisation, engagement and end-date values are required', 400);
  }
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.end_staff_engagement(
      ${organisationId}::uuid, ${engagementId}::uuid, ${endsOn}::date
    ) AS ends_on`);
    if (!result.rows[0]?.ends_on) throw new StaffProfileError('The database did not confirm the engagement end date');
    return { engagementId, endsOn: result.rows[0].ends_on };
  });
}
