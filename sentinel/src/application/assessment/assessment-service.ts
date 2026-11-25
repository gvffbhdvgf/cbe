import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/infrastructure/database/client';
import { organisations } from '@/infrastructure/database/schema/organisation';
import { assessmentEvents, assessmentInstrumentVersions, assessmentProgrammes } from '@/infrastructure/database/schema/assessment';
import { curriculumLearningAreas } from '@/infrastructure/database/schema/curriculum';
import { getOrganisationActorRole } from '@/application/organisation/membership-service';
import { canReadAssessmentData } from './assessment-policy';
import { withAuthenticatedLearnerDb } from '@/infrastructure/database/learner-rls-client';

export class AssessmentAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssessmentAccessError';
  }
}

export async function listAssessmentEvents(actorUserId: string, organisationId: string) {
  const [organisation] = await db.select({ id: organisations.id })
    .from(organisations)
    .where(and(eq(organisations.id, organisationId), eq(organisations.status, 'active')))
    .limit(1);
  if (!organisation) throw new AssessmentAccessError('Organisation not found or inactive');

  const role = await getOrganisationActorRole(actorUserId, organisationId);
  if (!canReadAssessmentData(role)) {
    throw new AssessmentAccessError('You do not have permission to view assessment records for this organisation');
  }

  return withAuthenticatedLearnerDb(actorUserId, async (tx) => tx.select({
    id: assessmentEvents.id,
    title: assessmentEvents.title,
    grade: assessmentEvents.grade,
    academicYear: assessmentEvents.academicYear,
    learningAreaId: curriculumLearningAreas.id,
    learningArea: curriculumLearningAreas.name,
    programme: assessmentProgrammes.title,
    instrumentCode: assessmentInstrumentVersions.instrumentCode,
    instrumentVersion: assessmentInstrumentVersions.versionNumber,
    status: assessmentEvents.status,
    moderationRequired: assessmentEvents.moderationRequired,
    startsAt: assessmentEvents.startsAt,
    endsAt: assessmentEvents.endsAt,
    createdAt: assessmentEvents.createdAt,
  })
    .from(assessmentEvents)
    .innerJoin(assessmentProgrammes, and(
      eq(assessmentEvents.programmeId, assessmentProgrammes.id),
      eq(assessmentEvents.organisationId, assessmentProgrammes.organisationId),
    ))
    .innerJoin(assessmentInstrumentVersions, and(
      eq(assessmentEvents.instrumentVersionId, assessmentInstrumentVersions.id),
      eq(assessmentEvents.organisationId, assessmentInstrumentVersions.organisationId),
    ))
    .innerJoin(curriculumLearningAreas, eq(assessmentEvents.learningAreaId, curriculumLearningAreas.id))
    .where(eq(assessmentEvents.organisationId, organisationId))
    .orderBy(desc(assessmentEvents.startsAt), desc(assessmentEvents.createdAt)));
}

