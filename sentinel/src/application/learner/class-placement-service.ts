import { sql } from 'drizzle-orm';
import { createClassPlacement, type ClassPlacementInput } from '@/domain/learner/class-placement';
import { withAuthenticatedLearnerDb } from '@/infrastructure/database/learner-rls-client';
import { requireLearnerManager } from './learner-service';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function placeLearnerInClass(
  actorUserId: string,
  organisationId: string,
  enrolmentId: string,
  input: ClassPlacementInput,
) {
  await requireLearnerManager(actorUserId, organisationId);
  if (!uuidPattern.test(enrolmentId)) throw new Error('A valid enrolment ID is required');
  const placement = createClassPlacement(input);

  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.assign_learner_to_class(${enrolmentId}::uuid, ${placement.classId}::uuid, ${placement.effectiveAt}::date) AS enrolment_id`);
    const assignedId = result.rows[0]?.enrolment_id;
    if (assignedId !== enrolmentId) throw new Error('The database did not confirm the learner placement');
    return { enrolmentId: assignedId, classId: placement.classId, effectiveAt: placement.effectiveAt };
  });
}


export async function reassignLearnerToClass(
  actorUserId: string, organisationId: string, enrolmentId: string,
  input: ClassPlacementInput & { reason: string },
) {
  await requireLearnerManager(actorUserId, organisationId);
  if (!uuidPattern.test(enrolmentId)) throw new Error('A valid enrolment ID is required');
  const placement = createClassPlacement(input);
  const reason = input.reason.trim();
  if (reason.length < 10 || reason.length > 500) throw new Error('A reassignment reason of 10 to 500 characters is required');
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.reassign_learner_to_class(
      ${organisationId}::uuid, ${enrolmentId}::uuid, ${placement.classId}::uuid,
      ${placement.effectiveAt}::date, ${reason}::text
    ) AS enrolment_id`);
    const reassignedId = result.rows[0]?.enrolment_id;
    if (reassignedId !== enrolmentId) throw new Error('The database did not confirm the class reassignment');
    return { enrolmentId: reassignedId, classId: placement.classId, effectiveAt: placement.effectiveAt };
  });
}

export async function withdrawLearnerEnrolment(
  actorUserId: string, organisationId: string, enrolmentId: string, withdrawalDate: string, reason: string,
) {
  await requireLearnerManager(actorUserId, organisationId);
  if (!uuidPattern.test(enrolmentId)) throw new Error('A valid enrolment ID is required');
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(withdrawalDate)) throw new Error('Withdrawal date must use YYYY-MM-DD');
  const parsed = new Date(`${withdrawalDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10)!==withdrawalDate) throw new Error('Withdrawal date must be a real calendar date');
  const cleanReason = reason.trim();
  if (cleanReason.length < 10 || cleanReason.length > 500) throw new Error('A withdrawal reason of 10 to 500 characters is required');
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.withdraw_learner_enrolment(
      ${organisationId}::uuid, ${enrolmentId}::uuid, ${withdrawalDate}::date, ${cleanReason}::text
    ) AS enrolment_id`);
    const withdrawnId = result.rows[0]?.enrolment_id;
    if (withdrawnId !== enrolmentId) throw new Error('The database did not confirm learner withdrawal');
    return { enrolmentId: withdrawnId, withdrawalDate };
  });
}
