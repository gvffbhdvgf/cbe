import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/infrastructure/database/client';
import { organisations } from '@/infrastructure/database/schema/organisation';
import { auditEvents } from '@/infrastructure/database/schema/security';
import { classes, learnerEnrolments, learnerProfiles, learnerProgressionEvents, people } from '@/infrastructure/database/schema/learner';
import { canManageMembers } from '@/application/organisation/membership-policy';
import { getOrganisationActorRole } from '@/application/organisation/membership-service';
import { createLearnerRegistration, type LearnerRegistrationInput } from '@/domain/learner/learner';

export async function requireLearnerManager(actorUserId: string, organisationId: string) {
  const [organisation] = await db.select({ id: organisations.id }).from(organisations)
    .where(and(eq(organisations.id, organisationId), eq(organisations.status, 'active'))).limit(1);
  if (!organisation) throw new Error('Organisation not found or inactive');
  const role = await getOrganisationActorRole(actorUserId, organisationId);
  if (!role || !canManageMembers(role)) throw new Error('You do not have permission to manage learner records for this organisation');
  return role;
}

export async function listLearners(actorUserId: string, organisationId: string) {
  await requireLearnerManager(actorUserId, organisationId);
  return db.select({
    id: learnerProfiles.id,
    learnerReference: learnerProfiles.learnerReference,
    firstName: people.legalFirstName,
    middleName: people.legalMiddleName,
    lastName: people.legalLastName,
    preferredName: people.preferredName,
    grade: learnerEnrolments.grade,
    academicYear: learnerEnrolments.academicYear,
    enrolmentStatus: learnerEnrolments.status,
    startsAt: learnerEnrolments.startsAt,
    className: classes.displayName,
  }).from(learnerProfiles)
    .innerJoin(people, eq(learnerProfiles.personId, people.id))
    .innerJoin(learnerEnrolments, and(
      eq(learnerEnrolments.learnerId, learnerProfiles.id),
      eq(learnerEnrolments.tenantOrganisationId, learnerProfiles.tenantOrganisationId),
    ))
    .leftJoin(classes, eq(learnerEnrolments.classId, classes.id))
    .where(and(
      eq(learnerProfiles.tenantOrganisationId, organisationId),
      eq(learnerProfiles.status, 'active'),
      eq(learnerEnrolments.organisationId, organisationId),
      eq(learnerEnrolments.status, 'active'),
    ))
    .orderBy(asc(people.legalLastName), asc(people.legalFirstName));
}

export async function registerLearner(actorUserId: string, organisationId: string, input: LearnerRegistrationInput) {
  await requireLearnerManager(actorUserId, organisationId);
  const learner = createLearnerRegistration(input);
  const personId = crypto.randomUUID();
  const learnerId = crypto.randomUUID();
  const enrolmentId = crypto.randomUUID();
  const learnerReference = `LRN-${crypto.randomUUID().toUpperCase()}`;
  const now = new Date();
  const effectiveDate = now.toISOString().slice(0, 10);

  await db.batch([
    db.insert(people).values({ id: personId, tenantOrganisationId: organisationId, legalFirstName: learner.firstName, legalMiddleName: learner.middleName, legalLastName: learner.lastName, preferredName: learner.preferredName, dateOfBirth: learner.dateOfBirth, createdBy: actorUserId }),
    db.insert(learnerProfiles).values({ id: learnerId, tenantOrganisationId: organisationId, personId, learnerReference, status: 'active', createdBy: actorUserId }),
    db.insert(learnerEnrolments).values({ id: enrolmentId, tenantOrganisationId: organisationId, learnerId, organisationId, grade: learner.grade, academicYear: learner.academicYear, status: 'active', startsAt: effectiveDate, createdBy: actorUserId }),
    db.insert(learnerProgressionEvents).values({ tenantOrganisationId: organisationId, learnerId, eventType: 'admitted', toGrade: learner.grade, effectiveAt: effectiveDate, actorUserId }),
    db.insert(auditEvents).values({ actorUserId, organisationId, action: 'learner.admitted', resourceType: 'learner_profile', resourceId: learnerId, metadata: { learnerReference, grade: learner.grade, academicYear: learner.academicYear } }),
  ]);

  return { id: learnerId, learnerReference, firstName: learner.firstName, lastName: learner.lastName, grade: learner.grade, academicYear: learner.academicYear, status: 'active' as const };
}

export async function getLearnerManagementSummary(actorUserId: string, organisationId: string) {
  await requireLearnerManager(actorUserId, organisationId);
  const [organisation] = await db.select({ id: organisations.id, name: organisations.name }).from(organisations)
    .where(and(eq(organisations.id, organisationId), eq(organisations.status, 'active'))).limit(1);
  if (!organisation) throw new Error('Organisation not found or inactive');
  const learners = await listLearners(actorUserId, organisationId);
  return { organisation, learners };
}
