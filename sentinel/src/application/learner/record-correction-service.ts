import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { requireLearnerManager } from '@/application/learner/learner-service';
import { createLearnerRecordCorrection } from '@/domain/learner/record-correction';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';
import { withAuthenticatedLearnerDb } from '@/infrastructure/database/learner-rls-client';
import { learnerProfiles, people, learnerRecordCorrectionHistory, learnerRecordCorrectionRequests } from '@/infrastructure/database/schema/learner';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class LearnerRecordCorrectionError extends Error {
  readonly status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.name = 'LearnerRecordCorrectionError';
    this.status = status;
  }
}

async function assertCorrectionManager(actorUserId: string, organisationId: string) {
  try {
    await requireLearnerManager(actorUserId, organisationId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Learner correction authority is required';
    throw new LearnerRecordCorrectionError(message, message.toLowerCase().includes('not found') ? 404 : 403);
  }
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export async function listLearnerCorrectionTargets(actorUserId: string, organisationId: string) {
  await assertCorrectionManager(actorUserId, organisationId);
  if (!uuidPattern.test(organisationId)) throw new LearnerRecordCorrectionError('A valid organisation identifier is required', 400);
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => tx.select({
    learnerId: learnerProfiles.id,
    learnerReference: learnerProfiles.learnerReference,
    learnerStatus: learnerProfiles.status,
    firstName: people.legalFirstName,
    middleName: people.legalMiddleName,
    lastName: people.legalLastName,
    preferredName: people.preferredName,
    dateOfBirth: people.dateOfBirth,
  }).from(learnerProfiles)
    .innerJoin(people, and(
      eq(learnerProfiles.personId, people.id),
      eq(learnerProfiles.tenantOrganisationId, people.tenantOrganisationId),
    ))
    .where(eq(learnerProfiles.tenantOrganisationId, organisationId))
    .orderBy(asc(people.legalLastName), asc(people.legalFirstName))
    .limit(1000));
}

export async function getLearnerRecordCorrectionOverview(actorUserId: string, organisationId: string) {
  await assertCorrectionManager(actorUserId, organisationId);
  if (!uuidPattern.test(organisationId)) throw new LearnerRecordCorrectionError('A valid organisation identifier is required', 400);
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const [requests, history] = await Promise.all([
      tx.select({
        id: learnerRecordCorrectionRequests.id,
        learnerId: learnerRecordCorrectionRequests.learnerId,
        learnerReference: learnerProfiles.learnerReference,
        firstName: people.legalFirstName,
        lastName: people.legalLastName,
        originalValues: learnerRecordCorrectionRequests.originalValues,
        proposedValues: learnerRecordCorrectionRequests.proposedValues,
        reason: learnerRecordCorrectionRequests.reason,
        evidenceReference: learnerRecordCorrectionRequests.evidenceReference,
        status: learnerRecordCorrectionRequests.status,
        requestedBy: learnerRecordCorrectionRequests.requestedBy,
        requestedAt: learnerRecordCorrectionRequests.requestedAt,
        reviewedBy: learnerRecordCorrectionRequests.reviewedBy,
        reviewedAt: learnerRecordCorrectionRequests.reviewedAt,
        reviewReason: learnerRecordCorrectionRequests.reviewReason,
        appliedAt: learnerRecordCorrectionRequests.appliedAt,
      }).from(learnerRecordCorrectionRequests)
        .innerJoin(learnerProfiles, and(
          eq(learnerRecordCorrectionRequests.learnerId, learnerProfiles.id),
          eq(learnerRecordCorrectionRequests.tenantOrganisationId, learnerProfiles.tenantOrganisationId),
        ))
        .innerJoin(people, and(
          eq(learnerRecordCorrectionRequests.personId, people.id),
          eq(learnerRecordCorrectionRequests.tenantOrganisationId, people.tenantOrganisationId),
        ))
        .where(eq(learnerRecordCorrectionRequests.organisationId, organisationId))
        .orderBy(desc(learnerRecordCorrectionRequests.requestedAt))
        .limit(100),
      tx.select({
        id: learnerRecordCorrectionHistory.id,
        learnerId: learnerRecordCorrectionHistory.learnerId,
        learnerReference: learnerProfiles.learnerReference,
        firstName: people.legalFirstName,
        lastName: people.legalLastName,
        previousValues: learnerRecordCorrectionHistory.previousValues,
        correctedValues: learnerRecordCorrectionHistory.correctedValues,
        changedFields: learnerRecordCorrectionHistory.changedFields,
        reason: learnerRecordCorrectionHistory.reason,
        evidenceReference: learnerRecordCorrectionHistory.evidenceReference,
        requestedBy: learnerRecordCorrectionHistory.requestedBy,
        reviewedBy: learnerRecordCorrectionHistory.reviewedBy,
        appliedAt: learnerRecordCorrectionHistory.appliedAt,
      }).from(learnerRecordCorrectionHistory)
        .innerJoin(learnerProfiles, and(
          eq(learnerRecordCorrectionHistory.learnerId, learnerProfiles.id),
          eq(learnerRecordCorrectionHistory.tenantOrganisationId, learnerProfiles.tenantOrganisationId),
        ))
        .innerJoin(people, and(
          eq(learnerRecordCorrectionHistory.personId, people.id),
          eq(learnerRecordCorrectionHistory.tenantOrganisationId, people.tenantOrganisationId),
        ))
        .where(eq(learnerRecordCorrectionHistory.organisationId, organisationId))
        .orderBy(desc(learnerRecordCorrectionHistory.appliedAt))
        .limit(50),
    ]);
    return {
      requests: requests.map((request) => ({
        ...request,
        requestedAt: iso(request.requestedAt)!,
        reviewedAt: iso(request.reviewedAt),
        appliedAt: iso(request.appliedAt),
      })),
      history: history.map((entry) => ({ ...entry, appliedAt: iso(entry.appliedAt)! })),
    };
  });
}

export async function createLearnerRecordCorrectionRequest(
  actorUserId: string, organisationId: string, learnerId: string, input: unknown,
) {
  await assertCorrectionManager(actorUserId, organisationId);
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(learnerId)) {
    throw new LearnerRecordCorrectionError('Valid organisation and learner identifiers are required', 400);
  }
  const correction = createLearnerRecordCorrection(input);
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.create_learner_record_correction_request(
      ${organisationId}::uuid, ${learnerId}::uuid, ${JSON.stringify(correction.changes)}::jsonb,
      ${correction.reason}::text, ${correction.evidenceReference}::text
    ) AS request_id`);
    const requestId = result.rows[0]?.request_id;
    if (!requestId) throw new LearnerRecordCorrectionError('The database did not confirm the correction request', 500);
    return { requestId: String(requestId), status: 'pending' as const };
  });
}

export async function reviewLearnerRecordCorrection(
  actorUserId: string, organisationId: string, requestId: string, decision: string, reviewReason: string,
) {
  await assertCorrectionManager(actorUserId, organisationId);
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(requestId)) {
    throw new LearnerRecordCorrectionError('Valid organisation and correction-request identifiers are required', 400);
  }
  if (decision !== 'approve' && decision !== 'reject') {
    throw new LearnerRecordCorrectionError('Correction decision must be approve or reject', 400);
  }
  const reason = reviewReason.trim();
  if (reason.length < 10 || reason.length > 500) {
    throw new LearnerRecordCorrectionError('A review reason of 10 to 500 characters is required', 400);
  }
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.review_learner_record_correction(
      ${organisationId}::uuid, ${requestId}::uuid, ${decision}::text, ${reason}::text
    ) AS status`);
    const status = result.rows[0]?.status;
    if (typeof status !== 'string') throw new LearnerRecordCorrectionError('The database did not confirm the correction decision', 500);
    return { requestId, status };
  });
}

export function mapLearnerRecordCorrectionApiError(error: unknown): { message: string; status: number } {
  if (error instanceof LearnerRecordCorrectionError) return { message: error.message, status: error.status };
  if (error instanceof LearnerRlsUnavailableError) return { message: 'Learner data service is temporarily unavailable', status: 503 };
  if (error instanceof LearnerAuthenticationError) return { message: 'Authentication required', status: 401 };
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === '42501') return { message: 'You do not have permission to perform this correction action', status: 403 };
  if (code === '23505') return { message: 'A correction request is already awaiting review for this learner', status: 409 };
  if (code === '23514') return { message: error instanceof Error ? error.message : 'This correction request can no longer be reviewed', status: 409 };
  if (code === '22023') return { message: error instanceof Error ? error.message : 'Correction details are invalid', status: 400 };
  if (code === 'P0002') return { message: 'Learner or correction request not found', status: 404 };
  return { message: 'Unable to process learner record correction', status: 500 };
}
