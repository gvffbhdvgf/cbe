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
