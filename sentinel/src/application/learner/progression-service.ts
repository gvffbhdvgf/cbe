import { sql } from 'drizzle-orm';
import { requireLearnerManager } from '@/application/learner/learner-service';
import { withAuthenticatedLearnerDb } from '@/infrastructure/database/learner-rls-client';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export class LearnerProgressionError extends Error {
  readonly status: number;
  constructor(message: string, status = 409) { super(message); this.name = 'LearnerProgressionError'; this.status = status; }
}

async function assertProgressionManager(actorUserId: string, organisationId: string) {
  try { await requireLearnerManager(actorUserId, organisationId); }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Learner progression management is not authorised';
    throw new LearnerProgressionError(message, message.includes('not found') ? 404 : 403);
  }
}

export async function listLearnerProgressionRequests(actorUserId: string, organisationId: string) {
  await assertProgressionManager(actorUserId, organisationId);
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`
      SELECT request.id, request.enrolment_id, request.learner_id, learner.learner_reference,
        request.from_grade, request.from_academic_year, request.to_grade, request.to_academic_year,
        request.target_class_id, target_class.class_code AS target_class_code,
        request.effective_at, request.reason, request.status, request.requested_by,
        request.decided_by, request.decided_at, request.approved_by, request.approved_at,
        request.decision_note, request.executed_at, request.new_enrolment_id, request.created_at
      FROM public.learner_progression_requests request
      INNER JOIN public.learner_profiles learner ON learner.id=request.learner_id
      LEFT JOIN public.classes target_class ON target_class.id=request.target_class_id
      WHERE request.organisation_id=${organisationId}::uuid
      ORDER BY request.created_at DESC
    `);
    return result.rows;
  });
}

export async function requestLearnerProgression(
  actorUserId: string, organisationId: string, enrolmentId: string,
  input: { toGrade: number; toAcademicYear: number; targetClassId: string | null; effectiveAt: string; reason: string },
) {
  await assertProgressionManager(actorUserId, organisationId);
  if (!uuidPattern.test(enrolmentId) || (input.targetClassId !== null && !uuidPattern.test(input.targetClassId))) {
    throw new LearnerProgressionError('Valid enrolment and optional target-class identifiers are required', 400);
  }
  if (!Number.isInteger(input.toGrade) || input.toGrade < 1 || input.toGrade > 9
    || !Number.isInteger(input.toAcademicYear) || input.toAcademicYear < 2000 || input.toAcademicYear > 2100) {
    throw new LearnerProgressionError('A valid target grade and academic year are required', 400);
  }
  if (!datePattern.test(input.effectiveAt) || Number.isNaN(new Date(input.effectiveAt+'T00:00:00.000Z').getTime())) {
    throw new LearnerProgressionError('A valid progression effective date is required', 400);
  }
  const reason = input.reason.trim();
  if (reason.length < 10 || reason.length > 500) throw new LearnerProgressionError('A progression reason of 10 to 500 characters is required', 400);
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.request_learner_progression(
      ${organisationId}::uuid, ${enrolmentId}::uuid, ${input.toGrade}::integer,
      ${input.toAcademicYear}::integer, ${input.targetClassId}::uuid,
      ${input.effectiveAt}::date, ${reason}::text
    ) AS request_id`);
    const requestId = result.rows[0]?.request_id;
    if (!requestId) throw new LearnerProgressionError('The database did not confirm the progression request');
    return { requestId };
  });
}

export async function approveLearnerProgression(actorUserId: string, organisationId: string, requestId: string, note: string | null = null) {
  await assertProgressionManager(actorUserId, organisationId);
  if (!uuidPattern.test(requestId)) throw new LearnerProgressionError('A valid progression request ID is required', 400);
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.approve_learner_progression_request(
      ${organisationId}::uuid, ${requestId}::uuid, ${note}::text
    ) AS decided_at`);
    if (!result.rows[0]?.decided_at) throw new LearnerProgressionError('The database did not confirm progression approval');
    return { requestId, status: 'approved' as const, decidedAt: result.rows[0].decided_at };
  });
}

export async function rejectLearnerProgression(actorUserId: string, organisationId: string, requestId: string, note: string) {
  await assertProgressionManager(actorUserId, organisationId);
  if (!uuidPattern.test(requestId)) throw new LearnerProgressionError('A valid progression request ID is required', 400);
  const reason = note.trim();
  if (reason.length < 10 || reason.length > 500) throw new LearnerProgressionError('A decision reason of 10 to 500 characters is required', 400);
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.reject_learner_progression_request(
      ${organisationId}::uuid, ${requestId}::uuid, ${reason}::text
    ) AS decided_at`);
    if (!result.rows[0]?.decided_at) throw new LearnerProgressionError('The database did not confirm progression rejection');
    return { requestId, status: 'rejected' as const, decidedAt: result.rows[0].decided_at };
  });
}

export async function executeLearnerProgression(actorUserId: string, organisationId: string, requestId: string) {
  await assertProgressionManager(actorUserId, organisationId);
  if (!uuidPattern.test(requestId)) throw new LearnerProgressionError('A valid progression request ID is required', 400);
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.execute_approved_learner_progression(
      ${organisationId}::uuid, ${requestId}::uuid
    ) AS new_enrolment_id`);
    const newEnrolmentId = result.rows[0]?.new_enrolment_id;
    if (!newEnrolmentId) throw new LearnerProgressionError('The database did not confirm progression execution');
    return { requestId, newEnrolmentId, status: 'executed' as const };
  });
}
