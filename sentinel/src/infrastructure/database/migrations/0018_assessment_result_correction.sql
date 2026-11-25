-- Governed correction after a moderation rejection.
-- New mark and result versions supersede, never overwrite, the original evidence and result.

CREATE FUNCTION sentinel_private.record_assessment_mark_correction(
  p_attempt_id uuid,
  p_task_id uuid,
  p_awarded_score numeric,
  p_marker_note text,
  p_supersedes_mark_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_attempt public.assessment_attempts%ROWTYPE;
  v_event public.assessment_events%ROWTYPE;
  v_result public.assessment_results%ROWTYPE;
  v_response public.assessment_responses%ROWTYPE;
  v_latest_mark public.assessment_response_marks%ROWTYPE;
  v_latest_decision text;
  v_maximum_score numeric(10,2);
  v_mark_id uuid;
  v_now timestamptz := pg_catalog.now();
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_awarded_score IS NULL OR p_awarded_score < 0 THEN
    RAISE EXCEPTION 'Awarded score must be zero or greater' USING ERRCODE = '22023';
  END IF;
  IF p_marker_note IS NULL OR pg_catalog.length(pg_catalog.btrim(p_marker_note)) = 0 THEN
    RAISE EXCEPTION 'A reason is required for every corrected mark' USING ERRCODE = '22023';
  END IF;

  SELECT attempt.* INTO v_attempt
  FROM public.assessment_attempts AS attempt
  WHERE attempt.id = p_attempt_id
    AND sentinel_private.can_access_assessment_data(attempt.organisation_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment attempt not found or access denied' USING ERRCODE = 'P0002';
  END IF;
  IF v_attempt.status <> 'marked' THEN
    RAISE EXCEPTION 'Only a marked attempt with a moderation correction request can be corrected' USING ERRCODE = '23514';
  END IF;

  SELECT event_record.* INTO v_event
  FROM public.assessment_events AS event_record
  WHERE event_record.id = v_attempt.event_id
    AND event_record.organisation_id = v_attempt.organisation_id
  FOR UPDATE;
  IF NOT FOUND OR v_event.status <> 'marking' THEN
    RAISE EXCEPTION 'The assessment event must remain in marking while a correction is completed' USING ERRCODE = '23514';
  END IF;

  SELECT result_record.* INTO v_result
  FROM public.assessment_results AS result_record
  WHERE result_record.attempt_id = v_attempt.id
    AND result_record.tenant_organisation_id = v_attempt.tenant_organisation_id
    AND result_record.organisation_id = v_attempt.organisation_id
  ORDER BY result_record.result_version DESC
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment result not found for correction' USING ERRCODE = 'P0002';
  END IF;

  SELECT decision.decision_type INTO v_latest_decision
  FROM public.assessment_result_decisions AS decision
  WHERE decision.result_id = v_result.id
    AND decision.attempt_id = v_attempt.id
    AND decision.organisation_id = v_attempt.organisation_id
  ORDER BY decision.decided_at DESC, decision.id DESC
  LIMIT 1;
  IF v_latest_decision <> 'correction_requested' THEN
    RAISE EXCEPTION 'A moderation correction request is required before marks can be corrected' USING ERRCODE = '23514';
  END IF;

  SELECT response.* INTO v_response
  FROM public.assessment_responses AS response
  WHERE response.attempt_id = v_attempt.id
    AND response.task_id = p_task_id
    AND response.tenant_organisation_id = v_attempt.tenant_organisation_id
    AND response.organisation_id = v_attempt.organisation_id
    AND response.instrument_version_id = v_attempt.instrument_version_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Captured response not found for this attempt and task' USING ERRCODE = 'P0002';
  END IF;

  SELECT task.maximum_score INTO v_maximum_score
  FROM public.assessment_tasks AS task
  WHERE task.id = p_task_id
    AND task.tenant_organisation_id = v_attempt.tenant_organisation_id
    AND task.organisation_id = v_attempt.organisation_id
    AND task.instrument_version_id = v_attempt.instrument_version_id
    AND task.required = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only required tasks in the exact instrument version can be corrected' USING ERRCODE = '23503';
  END IF;
  IF p_awarded_score > v_maximum_score THEN
    RAISE EXCEPTION 'Awarded score cannot exceed the task maximum score' USING ERRCODE = '23514';
  END IF;

  SELECT mark.* INTO v_latest_mark
  FROM public.assessment_response_marks AS mark
  WHERE mark.attempt_id = v_attempt.id
    AND mark.task_id = p_task_id
    AND mark.tenant_organisation_id = v_attempt.tenant_organisation_id
    AND mark.organisation_id = v_attempt.organisation_id
  ORDER BY mark.mark_version DESC
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND OR p_supersedes_mark_id IS DISTINCT FROM v_latest_mark.id THEN
    RAISE EXCEPTION 'A correction must supersede the latest existing task mark' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.assessment_response_marks (
    tenant_organisation_id, organisation_id, attempt_id, task_id,
    instrument_version_id, mark_version, awarded_score, marker_note,
    supersedes_mark_id, marked_by, marked_at
  ) VALUES (
    v_attempt.tenant_organisation_id, v_attempt.organisation_id, v_attempt.id, p_task_id,
    v_attempt.instrument_version_id, v_latest_mark.mark_version + 1, p_awarded_score,
    pg_catalog.btrim(p_marker_note), p_supersedes_mark_id, v_actor_id, v_now
  ) RETURNING id INTO v_mark_id;

  INSERT INTO public.audit_events (
    actor_user_id, organisation_id, action, resource_type, resource_id, metadata
  ) VALUES (
    v_actor_id, v_attempt.organisation_id, 'assessment.response_mark_corrected',
    'assessment_response_mark', v_mark_id::text,
    jsonb_build_object(
      'attemptId', v_attempt.id, 'taskId', p_task_id,
      'markVersion', v_latest_mark.mark_version + 1,
      'awardedScore', p_awarded_score, 'supersedesMarkId', p_supersedes_mark_id,
      'correctionReason', pg_catalog.btrim(p_marker_note)
    )
  );

  RETURN v_mark_id;
END;
$$;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.finalize_assessment_mark_correction(p_attempt_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_attempt public.assessment_attempts%ROWTYPE;
  v_event public.assessment_events%ROWTYPE;
  v_previous_result public.assessment_results%ROWTYPE;
  v_result_id uuid;
  v_total_score numeric(10,2);
  v_maximum_score numeric(10,2);
  v_percentage numeric(5,2);
  v_result_version integer;
  v_now timestamptz := pg_catalog.now();
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT attempt.* INTO v_attempt
  FROM public.assessment_attempts AS attempt
  WHERE attempt.id = p_attempt_id
    AND sentinel_private.can_access_assessment_data(attempt.organisation_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment attempt not found or access denied' USING ERRCODE = 'P0002';
  END IF;
  IF v_attempt.status <> 'marked' THEN
    RAISE EXCEPTION 'Only a marked attempt can have a moderation correction finalised' USING ERRCODE = '23514';
  END IF;

  SELECT event_record.* INTO v_event
  FROM public.assessment_events AS event_record
  WHERE event_record.id = v_attempt.event_id
    AND event_record.organisation_id = v_attempt.organisation_id
  FOR UPDATE;
  IF NOT FOUND OR v_event.status <> 'marking' THEN
    RAISE EXCEPTION 'The assessment event must remain in marking while a correction is finalised' USING ERRCODE = '23514';
  END IF;

  SELECT result_record.* INTO v_previous_result
  FROM public.assessment_results AS result_record
  WHERE result_record.attempt_id = v_attempt.id
    AND result_record.tenant_organisation_id = v_attempt.tenant_organisation_id
    AND result_record.organisation_id = v_attempt.organisation_id
  ORDER BY result_record.result_version DESC
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Previous assessment result not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.assessment_result_decisions AS decision
    WHERE decision.result_id = v_previous_result.id
      AND decision.attempt_id = v_attempt.id
      AND decision.decision_type = 'correction_requested'
  ) THEN
    RAISE EXCEPTION 'A moderation correction request is required before corrected result generation' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.assessment_tasks AS task
    WHERE task.tenant_organisation_id = v_attempt.tenant_organisation_id
      AND task.organisation_id = v_attempt.organisation_id
      AND task.instrument_version_id = v_attempt.instrument_version_id
      AND task.required = true
  ) THEN
    RAISE EXCEPTION 'Assessment instrument has no required tasks and cannot produce a corrected result' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.assessment_tasks AS task
    LEFT JOIN public.assessment_responses AS response
      ON response.tenant_organisation_id = task.tenant_organisation_id
     AND response.organisation_id = task.organisation_id
     AND response.attempt_id = v_attempt.id
     AND response.task_id = task.id
    LEFT JOIN LATERAL (
      SELECT mark.id
      FROM public.assessment_response_marks AS mark
      WHERE mark.tenant_organisation_id = task.tenant_organisation_id
        AND mark.organisation_id = task.organisation_id
        AND mark.attempt_id = v_attempt.id
        AND mark.task_id = task.id
      ORDER BY mark.mark_version DESC
      LIMIT 1
    ) AS latest_mark ON true
    WHERE task.tenant_organisation_id = v_attempt.tenant_organisation_id
      AND task.organisation_id = v_attempt.organisation_id
      AND task.instrument_version_id = v_attempt.instrument_version_id
      AND task.required = true
      AND (response.id IS NULL OR latest_mark.id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Every required task must have a captured response and latest mark before corrected result generation' USING ERRCODE = '23514';
  END IF;

  SELECT
    COALESCE(SUM(latest_mark.awarded_score), 0),
    SUM(task.maximum_score)
  INTO v_total_score, v_maximum_score
  FROM public.assessment_tasks AS task
  INNER JOIN public.assessment_responses AS response
    ON response.tenant_organisation_id = task.tenant_organisation_id
   AND response.organisation_id = task.organisation_id
   AND response.attempt_id = v_attempt.id
   AND response.task_id = task.id
  INNER JOIN LATERAL (
    SELECT mark.awarded_score
    FROM public.assessment_response_marks AS mark
    WHERE mark.tenant_organisation_id = task.tenant_organisation_id
      AND mark.organisation_id = task.organisation_id
      AND mark.attempt_id = v_attempt.id
      AND mark.task_id = task.id
    ORDER BY mark.mark_version DESC
    LIMIT 1
  ) AS latest_mark ON true
  WHERE task.tenant_organisation_id = v_attempt.tenant_organisation_id
    AND task.organisation_id = v_attempt.organisation_id
    AND task.instrument_version_id = v_attempt.instrument_version_id
    AND task.required = true;

  IF v_maximum_score IS NULL OR v_maximum_score <= 0 THEN
    RAISE EXCEPTION 'Corrected assessment result requires a positive maximum score' USING ERRCODE = '23514';
  END IF;

  v_percentage := pg_catalog.round((v_total_score / v_maximum_score) * 100, 2);
  v_result_version := v_previous_result.result_version + 1;

  INSERT INTO public.assessment_results (
    tenant_organisation_id, organisation_id, attempt_id, instrument_version_id,
    result_version, total_awarded_score, maximum_score, percentage,
    status, supersedes_result_id, created_by, created_at
  ) VALUES (
    v_attempt.tenant_organisation_id, v_attempt.organisation_id, v_attempt.id, v_attempt.instrument_version_id,
    v_result_version, v_total_score, v_maximum_score, v_percentage,
    'marked', v_previous_result.id, v_actor_id, v_now
  ) RETURNING id INTO v_result_id;

  INSERT INTO public.assessment_result_decisions (
    tenant_organisation_id, organisation_id, attempt_id, result_id,
    decision_type, reason, actor_user_id, decided_at
  ) VALUES (
    v_attempt.tenant_organisation_id, v_attempt.organisation_id, v_attempt.id, v_previous_result.id,
    'result_superseded', pg_catalog.format('Superseded by corrected result version %s', v_result_version),
    v_actor_id, v_now
  );

  INSERT INTO public.audit_events (
    actor_user_id, organisation_id, action, resource_type, resource_id, metadata
  ) VALUES (
    v_actor_id, v_attempt.organisation_id, 'assessment.result_corrected',
    'assessment_result', v_result_id::text,
    jsonb_build_object(
      'attemptId', v_attempt.id, 'resultVersion', v_result_version,
      'supersedesResultId', v_previous_result.id,
      'totalAwardedScore', v_total_score, 'maximumScore', v_maximum_score,
      'percentage', v_percentage
    )
  );

  RETURN v_result_id;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION sentinel_private.record_assessment_mark_correction(uuid, uuid, numeric, text, uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.finalize_assessment_mark_correction(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.record_assessment_mark_correction(uuid, uuid, numeric, text, uuid) TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.finalize_assessment_mark_correction(uuid) TO sentinel_learner_runtime;
