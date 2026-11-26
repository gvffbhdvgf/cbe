import { and, asc, desc, eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db } from '@/infrastructure/database/client';
import { authUsers, auditEvents } from '@/infrastructure/database/schema/security';
import { learnerRecordCorrectionRequests } from '@/infrastructure/database/schema/learner-correction';
import { learnerProfiles, people } from '@/infrastructure/database/schema/learner';
import { requireLearnerManager } from './learner-service';
import { withAuthenticatedLearnerDb } from '@/infrastructure/database/learner-rls-client';

export type LearnerCorrectionField = 'legal_first_name' | 'legal_middle_name' | 'legal_last_name' | 'preferred_name' | 'date_of_birth';

export async function listLearnerRecordCorrections(actorUserId: string, organisationId: string) {
  await requireLearnerManager(actorUserId, organisationId);
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => tx.select({
    id: learnerRecordCorrectionRequests.id,
    learnerId: learnerRecordCorrectionRequests.learnerId,
    fieldKey: learnerRecordCorrectionRequests.fieldKey,
    originalValue: learnerRecordCorrectionRequests.originalValue,
    proposedValue: learnerRecordCorrectionRequests.proposedValue,
    reason: learnerRecordCorrectionRequests.reason,
    evidenceReference: learnerRecordCorrectionRequests.evidenceReference,
    status: learnerRecordCorrectionRequests.status,
    requestedBy: learnerRecordCorrectionRequests.requestedBy,
    requestedAt: learnerRecordCorrectionRequests.requestedAt,
    reviewedBy: learnerRecordCorrectionRequests.reviewedBy,
    reviewedAt: learnerRecordCorrectionRequests.reviewedAt,
    reviewReason: learnerRecordCorrectionRequests.reviewReason,
  }).from(learnerRecordCorrectionRequests)
    .where(eq(learnerRecordCorrectionRequests.tenantOrganisationId, organisationId))
    .orderBy(desc(learnerRecordCorrectionRequests.requestedAt)));
}

export async function submitLearnerRecordCorrection(
  actorUserId: string, organisationId: string, learnerId: string,
  fieldKey: LearnerCorrectionField, proposedValue: string | null,
  reason: string, evidenceReference?: string | null,
) {
  await requireLearnerManager(actorUserId, organisationId);
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.submit_learner_record_correction(
      ${learnerId}::uuid, ${fieldKey}, ${proposedValue}, ${reason}, ${evidenceReference ?? null}
    ) AS request_id`);
    return { id: result.rows[0]?.request_id as string };
  });
}

export async function reviewLearnerRecordCorrection(
  actorUserId: string, organisationId: string, requestId: string,
  decision: 'approved' | 'rejected', reviewReason: string,
) {
  await requireLearnerManager(actorUserId, organisationId);
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.review_learner_record_correction(
      ${requestId}::uuid, ${decision}, ${reviewReason}
    ) AS request_id`);
    return { id: result.rows[0]?.request_id as string };
  });
}
