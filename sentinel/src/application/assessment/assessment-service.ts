import { and, desc, eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
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

export class AssessmentTransitionError extends Error {
  readonly status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.name = 'AssessmentTransitionError';
    this.status = status;
  }
}

async function assertAssessmentWriteAuthority(actorUserId: string, organisationId: string) {
  const [organisation] = await db.select({ id: organisations.id })
    .from(organisations)
    .where(and(eq(organisations.id, organisationId), eq(organisations.status, 'active')))
    .limit(1);
  if (!organisation) throw new AssessmentAccessError('Organisation not found or inactive');
  const role = await getOrganisationActorRole(actorUserId, organisationId);
  if (!canReadAssessmentData(role)) {
    throw new AssessmentAccessError('You do not have permission to perform assessment operations for this organisation');
  }
}

async function runAssessmentOperation<T>(actorUserId: string, organisationId: string, operation: (tx: Parameters<Parameters<typeof withAuthenticatedLearnerDb>[1]>[0]) => Promise<T>): Promise<T> {
  await assertAssessmentWriteAuthority(actorUserId, organisationId);
  try {
    return await withAuthenticatedLearnerDb(actorUserId, operation);
  } catch (error) {
    if (error instanceof AssessmentAccessError || error instanceof AssessmentTransitionError) throw error;
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    const message = error instanceof Error ? error.message : 'Assessment operation failed';
    if (code === '42501') throw new AssessmentAccessError('Authentication or assessment authority is required');
    if (code === 'P0002') throw new AssessmentTransitionError('Assessment record not found or access denied', 404);
    if (code === '23514' || code === '55000' || code === '23505' || code === '22023' || code === '23503') {
      throw new AssessmentTransitionError(message, 409);
    }
    throw error;
  }
}

export async function openAssessmentEvent(actorUserId: string, organisationId: string, eventId: string) {
  return runAssessmentOperation(actorUserId, organisationId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.open_assessment_event(${eventId}::uuid) AS opened_at`);
    return result.rows[0]?.opened_at;
  });
}

export async function createAssessmentAttempt(actorUserId: string, organisationId: string, eventId: string, enrolmentId: string) {
  return runAssessmentOperation(actorUserId, organisationId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.create_assessment_attempt(${eventId}::uuid, ${enrolmentId}::uuid) AS attempt_id`);
    return result.rows[0]?.attempt_id;
  });
}

export async function captureAssessmentResponse(actorUserId: string, organisationId: string, attemptId: string, taskId: string, responsePayload: Record<string, unknown>) {
  return runAssessmentOperation(actorUserId, organisationId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.capture_assessment_response(${attemptId}::uuid, ${taskId}::uuid, ${JSON.stringify(responsePayload)}::jsonb) AS response_id`);
    return result.rows[0]?.response_id;
  });
}

export async function submitAssessmentAttempt(actorUserId: string, organisationId: string, attemptId: string) {
  return runAssessmentOperation(actorUserId, organisationId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.submit_assessment_attempt(${attemptId}::uuid) AS submitted_at`);
    return result.rows[0]?.submitted_at;
  });
}

export async function voidAssessmentAttempt(actorUserId: string, organisationId: string, attemptId: string, reason: string) {
  return runAssessmentOperation(actorUserId, organisationId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.void_assessment_attempt(${attemptId}::uuid, ${reason}::text) AS voided_at`);
    return result.rows[0]?.voided_at;
  });
}

export async function closeAssessmentEvent(actorUserId: string, organisationId: string, eventId: string) {
  return runAssessmentOperation(actorUserId, organisationId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.close_assessment_event(${eventId}::uuid) AS closed_at`);
    return result.rows[0]?.closed_at;
  });
}

export async function recordAssessmentMark(
  actorUserId: string,
  organisationId: string,
  attemptId: string,
  taskId: string,
  awardedScore: number,
  markerNote: string | null,
  supersedesMarkId: string | null,
) {
  return runAssessmentOperation(actorUserId, organisationId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.record_assessment_mark(
      ${attemptId}::uuid, ${taskId}::uuid, ${awardedScore}::numeric,
      ${markerNote}::text, ${supersedesMarkId}::uuid
    ) AS mark_id`);
    return result.rows[0]?.mark_id;
  });
}

export async function finalizeAssessmentMarking(actorUserId: string, organisationId: string, attemptId: string) {
  return runAssessmentOperation(actorUserId, organisationId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.finalize_assessment_marking(${attemptId}::uuid) AS result_id`);
    return result.rows[0]?.result_id;
  });
}

export async function recordAssessmentResultDecision(
  actorUserId: string,
  organisationId: string,
  resultId: string,
  decisionType: 'moderation_approved' | 'moderation_rejected' | 'correction_requested' | 'result_approved' | 'result_published',
  reason: string,
) {
  return runAssessmentOperation(actorUserId, organisationId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.record_assessment_result_decision(
      ${resultId}::uuid, ${decisionType}::text, ${reason}::text
    ) AS decision_id`);
    return result.rows[0]?.decision_id;
  });
}

export async function recordAssessmentMarkCorrection(
  actorUserId: string,
  organisationId: string,
  attemptId: string,
  taskId: string,
  awardedScore: number,
  markerNote: string,
  supersedesMarkId: string,
) {
  return runAssessmentOperation(actorUserId, organisationId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.record_assessment_mark_correction(
      ${attemptId}::uuid, ${taskId}::uuid, ${awardedScore}::numeric,
      ${markerNote}::text, ${supersedesMarkId}::uuid
    ) AS mark_id`);
    const markId = result.rows[0]?.mark_id as string | undefined;
    if (!markId) return null;
    const mark = await tx.execute(sql`SELECT id AS mark_id, mark_version, awarded_score, marked_at
      FROM public.assessment_response_marks
      WHERE id = ${markId}::uuid AND organisation_id = ${organisationId}::uuid`);
    return mark.rows[0] ?? null;
  });
}

export async function finalizeAssessmentMarkCorrection(actorUserId: string, organisationId: string, attemptId: string) {
  return runAssessmentOperation(actorUserId, organisationId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.finalize_assessment_mark_correction(${attemptId}::uuid) AS result_id`);
    return result.rows[0]?.result_id;
  });
}


export async function createAssessmentProgramme(actorUserId: string, organisationId: string, programmeCode: string, title: string, programmeType: 'formative' | 'summative' | 'diagnostic') {
  return runAssessmentOperation(actorUserId, organisationId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.create_assessment_programme(
      ${organisationId}::uuid, ${programmeCode}::text, ${title}::text, ${programmeType}::text
    ) AS programme_id`);
    return result.rows[0]?.programme_id;
  });
}

export async function createAssessmentInstrumentVersion(
  actorUserId: string, organisationId: string, learningAreaId: string, grade: number,
  instrumentCode: string, title: string,
  tasks: Array<{ taskCode: string; title: string; responseType: 'text' | 'numeric' | 'boolean' | 'choice' | 'observation' | 'evidence'; maximumScore: number; required: boolean; displayOrder: number }>,
) {
  return runAssessmentOperation(actorUserId, organisationId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.create_assessment_instrument_version(
      ${organisationId}::uuid, ${learningAreaId}::uuid, ${grade}::integer,
      ${instrumentCode}::text, ${title}::text, ${JSON.stringify(tasks)}::jsonb
    ) AS instrument_version_id`);
    return result.rows[0]?.instrument_version_id;
  });
}

export async function approveAssessmentInstrumentVersion(actorUserId: string, organisationId: string, instrumentVersionId: string) {
  return runAssessmentOperation(actorUserId, organisationId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.approve_assessment_instrument_version(${instrumentVersionId}::uuid) AS approved_at`);
    return result.rows[0]?.approved_at;
  });
}

export async function createAssessmentEventLocal(
  actorUserId: string, organisationId: string, programmeId: string, instrumentVersionId: string,
  title: string, startsAtLocal: string, endsAtLocal: string, academicYear: number, moderationRequired: boolean,
) {
  return runAssessmentOperation(actorUserId, organisationId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.create_assessment_event_local(
      ${organisationId}::uuid, ${programmeId}::uuid, ${instrumentVersionId}::uuid,
      ${title}::text, ${startsAtLocal}::timestamp, ${endsAtLocal}::timestamp,
      ${academicYear}::integer, ${moderationRequired}::boolean
    ) AS event_id`);
    return result.rows[0]?.event_id;
  });
}

export async function createAssessmentEvent(
  actorUserId: string, organisationId: string, programmeId: string, instrumentVersionId: string,
  title: string, startsAt: string, endsAt: string, academicYear: number, moderationRequired: boolean,
) {
  return runAssessmentOperation(actorUserId, organisationId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.create_assessment_event(
      ${organisationId}::uuid, ${programmeId}::uuid, ${instrumentVersionId}::uuid,
      ${title}::text, ${startsAt}::timestamptz, ${endsAt}::timestamptz,
      ${academicYear}::integer, ${moderationRequired}::boolean
    ) AS event_id`);
    return result.rows[0]?.event_id;
  });
}

export async function scheduleAssessmentEvent(actorUserId: string, organisationId: string, eventId: string) {
  return runAssessmentOperation(actorUserId, organisationId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.schedule_assessment_event(${eventId}::uuid) AS eligible_count`);
    return result.rows[0]?.eligible_count;
  });
}

export async function getAssessmentAuthoringOptions(actorUserId: string, organisationId: string) {
  const [organisation] = await db.select({ id: organisations.id, timeZone: organisations.timeZone })
    .from(organisations).where(and(eq(organisations.id, organisationId), eq(organisations.status, 'active'))).limit(1);
  if (!organisation) throw new AssessmentAccessError('Organisation not found or inactive');
  const role = await getOrganisationActorRole(actorUserId, organisationId);
  if (!canReadAssessmentData(role)) throw new AssessmentAccessError('Assessment authoring access is required');
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const [programmes, instruments, learningAreas] = await Promise.all([
      tx.select({ id: assessmentProgrammes.id, code: assessmentProgrammes.programmeCode, title: assessmentProgrammes.title, type: assessmentProgrammes.programmeType })
        .from(assessmentProgrammes).where(and(eq(assessmentProgrammes.organisationId, organisationId), eq(assessmentProgrammes.status, 'active'))).orderBy(assessmentProgrammes.title),
      tx.select({ id: assessmentInstrumentVersions.id, code: assessmentInstrumentVersions.instrumentCode, version: assessmentInstrumentVersions.versionNumber, title: assessmentInstrumentVersions.title, grade: assessmentInstrumentVersions.grade, learningAreaId: assessmentInstrumentVersions.learningAreaId, status: assessmentInstrumentVersions.status, createdBy: assessmentInstrumentVersions.createdBy })
        .from(assessmentInstrumentVersions).where(eq(assessmentInstrumentVersions.organisationId, organisationId)).orderBy(desc(assessmentInstrumentVersions.createdAt)),
      tx.select({ id: curriculumLearningAreas.id, name: curriculumLearningAreas.name }).from(curriculumLearningAreas).orderBy(curriculumLearningAreas.name),
    ]);
    return { programmes, instruments, learningAreas, timeZone: organisation.timeZone };
  });
}


export async function getAssessmentInstrumentOutcomeMappings(actorUserId: string, organisationId: string, instrumentVersionId: string) {
  return runAssessmentOperation(actorUserId, organisationId, async (tx) => {
    const result = await tx.execute(sql`
      SELECT
        task.id AS task_id,
        task.task_code,
        task.title AS task_title,
        task.required,
        mapping.id AS mapping_id,
        mapping.curriculum_source_node_id,
        mapping.status AS mapping_status,
        mapping.created_by,
        mapping.reviewed_by,
        mapping.reviewed_at,
        mapping.review_note,
        node.node_code AS outcome_code,
        node.title AS outcome_title,
        document.document_code,
        offering.grade,
        area.name AS learning_area
      FROM public.assessment_tasks AS task
      JOIN public.assessment_instrument_versions AS instrument
        ON instrument.id = task.instrument_version_id
       AND instrument.tenant_organisation_id = task.tenant_organisation_id
       AND instrument.organisation_id = task.organisation_id
      LEFT JOIN public.assessment_task_outcome_mappings AS mapping
        ON mapping.task_id = task.id
       AND mapping.instrument_version_id = task.instrument_version_id
       AND mapping.tenant_organisation_id = task.tenant_organisation_id
       AND mapping.organisation_id = task.organisation_id
      LEFT JOIN public.curriculum_source_nodes AS node
        ON node.id = mapping.curriculum_source_node_id
      LEFT JOIN public.curriculum_design_documents AS document
        ON document.id = node.document_id
      LEFT JOIN public.curriculum_grade_offerings AS offering
        ON offering.id = document.grade_offering_id
      LEFT JOIN public.curriculum_learning_areas AS area
        ON area.id = offering.learning_area_id
      WHERE task.organisation_id = ${organisationId}::uuid
        AND instrument.id = ${instrumentVersionId}::uuid
      ORDER BY task.display_order, task.task_code, node.node_code
    `);
    return result.rows;
  });
}

export async function createAssessmentTaskOutcomeMapping(
  actorUserId: string, organisationId: string, taskId: string, curriculumSourceNodeId: string,
) {
  return runAssessmentOperation(actorUserId, organisationId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.create_assessment_task_outcome_mapping(
      ${organisationId}::uuid, ${taskId}::uuid, ${curriculumSourceNodeId}::uuid
    ) AS mapping_id`);
    return result.rows[0]?.mapping_id;
  });
}

export async function reviewAssessmentTaskOutcomeMapping(
  actorUserId: string, organisationId: string, mappingId: string, decision: 'approved' | 'rejected', reviewNote: string,
) {
  return runAssessmentOperation(actorUserId, organisationId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.review_assessment_task_outcome_mapping(
      ${organisationId}::uuid, ${mappingId}::uuid, ${decision}::text, ${reviewNote}::text
    ) AS reviewed_at`);
    return result.rows[0]?.reviewed_at;
  });
}

export async function getAssessmentEligibleEnrolments(actorUserId: string, organisationId: string, eventId: string) {
  return runAssessmentOperation(actorUserId, organisationId, async (tx) => {
    const result = await tx.execute(sql`SELECT * FROM sentinel_private.list_assessment_eligible_enrolments(${eventId}::uuid)`);
    return result.rows;
  });
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
    timeZone: assessmentEvents.timeZone,
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

export async function getAssessmentEventResults(actorUserId: string, organisationId: string, eventId: string) {
  const [organisation] = await db.select({ id: organisations.id })
    .from(organisations)
    .where(and(eq(organisations.id, organisationId), eq(organisations.status, 'active')))
    .limit(1);
  if (!organisation) throw new AssessmentAccessError('Organisation not found or inactive');
  const role = await getOrganisationActorRole(actorUserId, organisationId);
  if (!canReadAssessmentData(role)) throw new AssessmentAccessError('You do not have permission to view assessment results for this organisation');

  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`
      SELECT
        attempt.id AS attempt_id,
        attempt.enrolment_id,
        attempt.status AS attempt_status,
        attempt.submitted_at,
        attempt.created_at,
        lifecycle.id AS result_id,
        lifecycle.result_version,
        lifecycle.total_awarded_score,
        lifecycle.maximum_score,
        lifecycle.percentage,
        lifecycle.lifecycle_status,
        lifecycle.latest_decision_type,
        lifecycle.latest_decision_at
      FROM public.assessment_attempts AS attempt
      LEFT JOIN LATERAL (
        SELECT result_record.*
        FROM public.assessment_result_lifecycle AS result_record
        WHERE result_record.attempt_id = attempt.id
          AND result_record.tenant_organisation_id = attempt.tenant_organisation_id
          AND result_record.organisation_id = attempt.organisation_id
        ORDER BY result_record.result_version DESC
        LIMIT 1
      ) AS lifecycle ON true
      WHERE attempt.organisation_id = ${organisationId}::uuid
        AND attempt.event_id = ${eventId}::uuid
      ORDER BY attempt.created_at, attempt.id
    `);
    return result.rows;
  });
}

export async function getAssessmentAttemptMarkingSheet(actorUserId: string, organisationId: string, attemptId: string) {
  const [organisation] = await db.select({ id: organisations.id })
    .from(organisations)
    .where(and(eq(organisations.id, organisationId), eq(organisations.status, 'active')))
    .limit(1);
  if (!organisation) throw new AssessmentAccessError('Organisation not found or inactive');
  const role = await getOrganisationActorRole(actorUserId, organisationId);
  if (!canReadAssessmentData(role)) throw new AssessmentAccessError('You do not have permission to view assessment evidence for this organisation');

  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`
      SELECT
        event_record.id AS event_id,
        event_record.title AS event_title,
        event_record.status AS event_status,
        attempt.id AS attempt_id,
        attempt.enrolment_id,
        attempt.status AS attempt_status,
        task.id AS task_id,
        task.task_code,
        task.title AS task_title,
        task.response_type,
        task.maximum_score,
        task.required,
        task.display_order,
        response.id AS response_id,
        response.response_payload,
        response.captured_at,
        mark.id AS mark_id,
        mark.mark_version,
        mark.awarded_score,
        mark.marker_note,
        mark.marked_at,
        lifecycle.id AS result_id,
        lifecycle.lifecycle_status,
        lifecycle.latest_decision_type,
        lifecycle.latest_decision_at
      FROM public.assessment_attempts AS attempt
      INNER JOIN public.assessment_events AS event_record
        ON event_record.id = attempt.event_id
       AND event_record.tenant_organisation_id = attempt.tenant_organisation_id
       AND event_record.organisation_id = attempt.organisation_id
      INNER JOIN public.assessment_tasks AS task
        ON task.instrument_version_id = attempt.instrument_version_id
       AND task.tenant_organisation_id = attempt.tenant_organisation_id
       AND task.organisation_id = attempt.organisation_id
      LEFT JOIN public.assessment_responses AS response
        ON response.attempt_id = attempt.id
       AND response.task_id = task.id
       AND response.tenant_organisation_id = attempt.tenant_organisation_id
       AND response.organisation_id = attempt.organisation_id
      LEFT JOIN LATERAL (
        SELECT mark_record.*
        FROM public.assessment_response_marks AS mark_record
        WHERE mark_record.attempt_id = attempt.id
          AND mark_record.task_id = task.id
          AND mark_record.tenant_organisation_id = attempt.tenant_organisation_id
          AND mark_record.organisation_id = attempt.organisation_id
        ORDER BY mark_record.mark_version DESC
        LIMIT 1
      ) AS mark ON true
      LEFT JOIN LATERAL (
        SELECT result_record.id, result_record.lifecycle_status, result_record.latest_decision_type, result_record.latest_decision_at, result_record.result_version
        FROM public.assessment_result_lifecycle AS result_record
        WHERE result_record.attempt_id = attempt.id
          AND result_record.tenant_organisation_id = attempt.tenant_organisation_id
          AND result_record.organisation_id = attempt.organisation_id
        ORDER BY result_record.result_version DESC
        LIMIT 1
      ) AS lifecycle ON true
      WHERE attempt.organisation_id = ${organisationId}::uuid
        AND attempt.id = ${attemptId}::uuid
      ORDER BY task.display_order, task.task_code
    `);
    return result.rows;
  });
}
