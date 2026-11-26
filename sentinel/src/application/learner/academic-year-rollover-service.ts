import { sql } from 'drizzle-orm';
import { requireLearnerManager } from '@/application/learner/learner-service';
import { withAuthenticatedLearnerDb } from '@/infrastructure/database/learner-rls-client';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export class AcademicYearRolloverError extends Error {
  readonly status: number;
  constructor(message: string, status = 409) { super(message); this.name = 'AcademicYearRolloverError'; this.status = status; }
}

async function assertRolloverManager(actorUserId: string, organisationId: string) {
  try { await requireLearnerManager(actorUserId, organisationId); }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Academic-year rollover is not authorised';
    throw new AcademicYearRolloverError(message, message.includes('not found') ? 404 : 403);
  }
}

export async function listAcademicYearRollovers(actorUserId: string, organisationId: string) {
  await assertRolloverManager(actorUserId, organisationId);
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const batches = await tx.execute(sql`
      SELECT batch.id, batch.from_academic_year, batch.to_academic_year, batch.effective_at,
        batch.status, batch.requested_by, batch.submitted_at, batch.created_at,
        count(item.id)::integer AS learner_count,
        count(item.id) FILTER (WHERE item.status='unresolved')::integer AS unresolved_count,
        count(item.id) FILTER (WHERE item.status='planned')::integer AS planned_count,
        count(item.id) FILTER (WHERE item.status='request_created')::integer AS submitted_count,
        count(item.id) FILTER (WHERE item.status='excluded')::integer AS excluded_count,
        count(request.id) FILTER (WHERE request.status='approved')::integer AS approved_count,
        count(request.id) FILTER (WHERE request.status='executed')::integer AS executed_count,
        count(request.id) FILTER (WHERE request.status='rejected')::integer AS rejected_count
      FROM public.academic_year_rollover_batches batch
      LEFT JOIN public.academic_year_rollover_items item ON item.batch_id=batch.id
      LEFT JOIN public.learner_progression_requests request ON request.id=item.progression_request_id
      WHERE batch.organisation_id=${organisationId}::uuid
      GROUP BY batch.id
      ORDER BY batch.created_at DESC
    `);
    const items = await tx.execute(sql`
      SELECT item.id, item.batch_id, item.learner_id, item.learner_reference,
        item.source_enrolment_id, item.from_grade, item.outcome, item.to_grade,
        item.target_class_id, item.reason, item.status, item.progression_request_id,
        request.status AS progression_status, request.decided_by, request.executed_at,
        target_class.class_code AS target_class_code
      FROM public.academic_year_rollover_items item
      LEFT JOIN public.learner_progression_requests request ON request.id=item.progression_request_id
      LEFT JOIN public.classes target_class ON target_class.id=item.target_class_id
      WHERE item.organisation_id=${organisationId}::uuid
      ORDER BY item.batch_id, item.learner_reference
    `);
    return { batches: batches.rows, items: items.rows };
  });
}

export async function createAcademicYearRollover(actorUserId: string, organisationId: string, fromAcademicYear: number, effectiveAt: string) {
  await assertRolloverManager(actorUserId, organisationId);
  if (!Number.isInteger(fromAcademicYear) || fromAcademicYear < 2000 || fromAcademicYear > 2099) {
    throw new AcademicYearRolloverError('A valid source academic year is required', 400);
  }
  const parsed = new Date(effectiveAt+'T00:00:00.000Z');
  if (!datePattern.test(effectiveAt) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10)!==effectiveAt) {
    throw new AcademicYearRolloverError('A valid rollover effective date is required', 400);
  }
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.create_academic_year_rollover(
      ${organisationId}::uuid, ${fromAcademicYear}::integer, ${effectiveAt}::date
    ) AS batch_id`);
    const batchId = result.rows[0]?.batch_id;
    if (!batchId) throw new AcademicYearRolloverError('The database did not confirm rollover creation');
    return { batchId, toAcademicYear: fromAcademicYear+1 };
  });
}

export async function setAcademicYearRolloverItemDecision(
  actorUserId: string, organisationId: string, batchId: string, itemId: string,
  outcome: 'promote'|'repeat'|'not_progressing', targetClassId: string|null, reason: string,
) {
  await assertRolloverManager(actorUserId, organisationId);
  if (!uuidPattern.test(batchId) || !uuidPattern.test(itemId) || (targetClassId!==null&&!uuidPattern.test(targetClassId))) {
    throw new AcademicYearRolloverError('Valid rollover and item identifiers are required',400);
  }
  if (!['promote','repeat','not_progressing'].includes(outcome)) throw new AcademicYearRolloverError('A supported learner disposition is required',400);
  const note=reason.trim();
  if(note.length<10||note.length>500)throw new AcademicYearRolloverError('A learner-specific reason of 10 to 500 characters is required',400);
  return withAuthenticatedLearnerDb(actorUserId,async(tx)=>{
    const result=await tx.execute(sql`SELECT sentinel_private.set_academic_year_rollover_item_decision(
      ${batchId}::uuid,${itemId}::uuid,${outcome},${targetClassId}::uuid,${note}
    ) AS item_id`);
    if(!result.rows[0]?.item_id)throw new AcademicYearRolloverError('The database did not confirm the learner decision');
    return {itemId};
  });
}

export async function submitAcademicYearRollover(actorUserId:string,organisationId:string,batchId:string){
  await assertRolloverManager(actorUserId,organisationId);
  if(!uuidPattern.test(batchId))throw new AcademicYearRolloverError('A valid rollover batch ID is required',400);
  return withAuthenticatedLearnerDb(actorUserId,async(tx)=>{
    const result=await tx.execute(sql`SELECT sentinel_private.submit_academic_year_rollover(${batchId}::uuid) AS progression_requests_created`);
    if(result.rows[0]?.progression_requests_created===undefined)throw new AcademicYearRolloverError('The database did not confirm rollover submission');
    return {batchId,progressionRequestsCreated:Number(result.rows[0].progression_requests_created)};
  });
}

export async function cancelAcademicYearRollover(actorUserId:string,organisationId:string,batchId:string){
  await assertRolloverManager(actorUserId,organisationId);
  if(!uuidPattern.test(batchId))throw new AcademicYearRolloverError('A valid rollover batch ID is required',400);
  return withAuthenticatedLearnerDb(actorUserId,async(tx)=>{
    const result=await tx.execute(sql`SELECT sentinel_private.cancel_academic_year_rollover(${batchId}::uuid) AS batch_id`);
    if(!result.rows[0]?.batch_id)throw new AcademicYearRolloverError('The database did not confirm rollover cancellation');
    return {batchId,status:'cancelled' as const};
  });
}
