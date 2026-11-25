-- Append-only assessment marking and deterministic result generation.
-- Learner response evidence remains immutable; marks are separate versioned records.
-- Result generation is atomic and does not publish or approve a result.

CREATE TABLE public.assessment_response_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL,
  organisation_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  task_id uuid NOT NULL,
  instrument_version_id uuid NOT NULL,
  mark_version integer NOT NULL CHECK (mark_version > 0),
  awarded_score numeric(10,2) NOT NULL CHECK (awarded_score >= 0),
  marker_note text,
  supersedes_mark_id uuid,
  marked_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  marked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_response_marks_response_fk FOREIGN KEY (
    tenant_organisation_id, organisation_id, attempt_id, task_id
  ) REFERENCES public.assessment_responses (
    tenant_organisation_id, organisation_id, attempt_id, task_id
  ) ON DELETE RESTRICT,
  CONSTRAINT assessment_response_marks_task_fk FOREIGN KEY (
    tenant_organisation_id, organisation_id, task_id, instrument_version_id
  ) REFERENCES public.assessment_tasks (
    tenant_organisation_id, organisation_id, id, instrument_version_id
  ) ON DELETE RESTRICT,
  CONSTRAINT assessment_response_marks_scope_id_unique UNIQUE (
    tenant_organisation_id, organisation_id, id, attempt_id, task_id
  ),
  CONSTRAINT assessment_response_marks_version_unique UNIQUE (
    tenant_organisation_id, organisation_id, attempt_id, task_id, mark_version
  ),
  CONSTRAINT assessment_response_marks_supersedes_fk FOREIGN KEY (
    tenant_organisation_id, organisation_id, supersedes_mark_id, attempt_id, task_id
  ) REFERENCES public.assessment_response_marks (
    tenant_organisation_id, organisation_id, id, attempt_id, task_id
  ) ON DELETE RESTRICT,
  CONSTRAINT assessment_response_marks_supersedes_check CHECK (
    (mark_version = 1 AND supersedes_mark_id IS NULL)
    OR (mark_version > 1 AND supersedes_mark_id IS NOT NULL)
  )
);
--> statement-breakpoint
COMMENT ON COLUMN public.assessment_responses.awarded_score IS 'Deprecated legacy field; do not write marks here. Use append-only assessment_response_marks.';
--> statement-breakpoint
COMMENT ON COLUMN public.assessment_responses.marked_by IS 'Deprecated legacy field; marking identity is recorded in assessment_response_marks.';
--> statement-breakpoint
COMMENT ON COLUMN public.assessment_responses.marked_at IS 'Deprecated legacy field; marking timestamps are recorded in assessment_response_marks.';
--> statement-breakpoint
COMMENT ON COLUMN public.assessment_responses.marker_note IS 'Deprecated legacy field; marker notes are recorded in assessment_response_marks.';
--> statement-breakpoint

CREATE INDEX assessment_response_marks_attempt_task_idx
  ON public.assessment_response_marks (tenant_organisation_id, organisation_id, attempt_id, task_id, mark_version DESC);
--> statement-breakpoint

ALTER TABLE public.assessment_response_marks ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.assessment_response_marks FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY assessment_response_marks_select
  ON public.assessment_response_marks
  FOR SELECT TO sentinel_learner_runtime
  USING (sentinel_private.can_access_assessment_data(organisation_id));
--> statement-breakpoint
REVOKE ALL ON TABLE public.assessment_response_marks FROM PUBLIC, sentinel_learner_runtime;
--> statement-breakpoint
GRANT SELECT ON TABLE public.assessment_response_marks TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.prevent_assessment_mark_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Assessment marks are append-only; corrections must supersede the prior mark'
    USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER assessment_response_marks_append_only
BEFORE UPDATE OR DELETE ON public.assessment_response_marks
FOR EACH ROW EXECUTE FUNCTION sentinel_private.prevent_assessment_mark_mutation();
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.prevent_assessment_mark_mutation() FROM PUBLIC;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.void_assessment_attempt(p_attempt_id uuid, p_reason text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $
DECLARE
  v_actor_id uuid;
  v_attempt public.assessment_attempts%ROWTYPE;
  v_event public.assessment_events%ROWTYPE;
  v_now timestamptz := pg_catalog.now();
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR pg_catalog.length(pg_catalog.btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required to void an assessment attempt' USING ERRCODE = '22023';
  END IF;

  SELECT attempt.* INTO v_attempt
  FROM public.assessment_attempts AS attempt
  WHERE attempt.id = p_attempt_id
    AND sentinel_private.can_access_assessment_data(attempt.organisation_id)
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment attempt not found or access denied' USING ERRCODE = 'P0002';
  END IF;
  IF v_attempt.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Only an in-progress attempt can be voided by this operation' USING ERRCODE = '23514';
  END IF;

  SELECT event_record.* INTO v_event
  FROM public.assessment_events AS event_record
  WHERE event_record.id = v_attempt.event_id
    AND event_record.organisation_id = v_attempt.organisation_id
  FOR UPDATE;
  IF NOT FOUND OR v_event.status <> 'open' OR v_now < v_event.ends_at THEN
    RAISE EXCEPTION 'An incomplete attempt can only be voided after its open assessment event has ended' USING ERRCODE = '23514';
  END IF;

  UPDATE public.assessment_attempts
  SET status = 'voided', updated_at = v_now
  WHERE id = v_attempt.id;

  INSERT INTO public.audit_events (
    actor_user_id, organisation_id, action, resource_type, resource_id, metadata
  ) VALUES (
    v_actor_id, v_attempt.organisation_id, 'assessment.attempt_voided',
    'assessment_attempt', v_attempt.id::text,
    jsonb_build_object('eventId', v_event.id, 'reason', pg_catalog.btrim(p_reason), 'voidedAt', v_now)
  );

  RETURN v_now;
END;
$;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.close_assessment_event(p_event_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_event public.assessment_events%ROWTYPE;
  v_now timestamptz := pg_catalog.now();
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT event_record.* INTO v_event
  FROM public.assessment_events AS event_record
  WHERE event_record.id = p_event_id
    AND sentinel_private.can_access_assessment_data(event_record.organisation_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment event not found or access denied' USING ERRCODE = 'P0002';
  END IF;
  IF v_event.status <> 'open' THEN
    RAISE EXCEPTION 'Only open assessment events can be closed' USING ERRCODE = '23514';
  END IF;
  IF v_now < v_event.ends_at THEN
    RAISE EXCEPTION 'Assessment event cannot close before its scheduled end time' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.assessment_attempts AS attempt
    WHERE attempt.event_id = v_event.id
      AND attempt.tenant_organisation_id = v_event.tenant_organisation_id
      AND attempt.organisation_id = v_event.organisation_id
      AND attempt.status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'All learner attempts must be submitted or voided before the event can close' USING ERRCODE = '23514';
  END IF;

  UPDATE public.assessment_events
  SET status = 'closed', updated_at = v_now
  WHERE id = v_event.id;

  INSERT INTO public.audit_events (
    actor_user_id, organisation_id, action, resource_type, resource_id, metadata
  ) VALUES (
    v_actor_id, v_event.organisation_id, 'assessment.event_closed',
    'assessment_event', v_event.id::text,
    jsonb_build_object('closedAt', v_now, 'endsAt', v_event.ends_at)
  );

  RETURN v_now;
END;
$$;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.record_assessment_mark(
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
  v_response public.assessment_responses%ROWTYPE;
  v_latest public.assessment_response_marks%ROWTYPE;
  v_maximum_score numeric(10,2);
  v_mark_version integer;
  v_mark_id uuid;
  v_action text;
  v_now timestamptz := pg_catalog.now();
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_awarded_score IS NULL OR p_awarded_score < 0 THEN
    RAISE EXCEPTION 'Awarded score must be zero or greater' USING ERRCODE = '22023';
  END IF;

  SELECT attempt.* INTO v_attempt
  FROM public.assessment_attempts AS attempt
  WHERE attempt.id = p_attempt_id
    AND sentinel_private.can_access_assessment_data(attempt.organisation_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment attempt not found or access denied' USING ERRCODE = 'P0002';
  END IF;
  IF v_attempt.status <> 'submitted' THEN
    RAISE EXCEPTION 'Only submitted assessment attempts can be marked' USING ERRCODE = '23514';
  END IF;

  SELECT event_record.* INTO v_event
  FROM public.assessment_events AS event_record
  WHERE event_record.id = v_attempt.event_id
    AND event_record.organisation_id = v_attempt.organisation_id
  FOR UPDATE;
  IF NOT FOUND OR v_event.status NOT IN ('closed','marking') THEN
    RAISE EXCEPTION 'Assessment event must be closed before marking can begin' USING ERRCODE = '23514';
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
    AND task.instrument_version_id = v_attempt.instrument_version_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment task does not belong to the attempt instrument version' USING ERRCODE = '23503';
  END IF;
  IF p_awarded_score > v_maximum_score THEN
    RAISE EXCEPTION 'Awarded score cannot exceed the task maximum score' USING ERRCODE = '23514';
  END IF;

  SELECT mark.* INTO v_latest
  FROM public.assessment_response_marks AS mark
  WHERE mark.attempt_id = v_attempt.id
    AND mark.task_id = p_task_id
    AND mark.tenant_organisation_id = v_attempt.tenant_organisation_id
    AND mark.organisation_id = v_attempt.organisation_id
  ORDER BY mark.mark_version DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF p_supersedes_mark_id IS DISTINCT FROM v_latest.id THEN
      RAISE EXCEPTION 'A correction must explicitly supersede the latest mark version' USING ERRCODE = '23514';
    END IF;
    IF p_marker_note IS NULL OR pg_catalog.length(pg_catalog.btrim(p_marker_note)) = 0 THEN
      RAISE EXCEPTION 'A reason is required when correcting an existing mark' USING ERRCODE = '23514';
    END IF;
    v_mark_version := v_latest.mark_version + 1;
    v_action := 'assessment.response_mark_corrected';
  ELSE
    IF p_supersedes_mark_id IS NOT NULL THEN
      RAISE EXCEPTION 'An initial mark cannot supersede another mark' USING ERRCODE = '23514';
    END IF;
    v_mark_version := 1;
    v_action := 'assessment.response_marked';
  END IF;

  INSERT INTO public.assessment_response_marks (
    tenant_organisation_id, organisation_id, attempt_id, task_id,
    instrument_version_id, mark_version, awarded_score, marker_note,
    supersedes_mark_id, marked_by, marked_at
  ) VALUES (
    v_attempt.tenant_organisation_id, v_attempt.organisation_id, v_attempt.id, p_task_id,
    v_attempt.instrument_version_id, v_mark_version, p_awarded_score, p_marker_note,
    p_supersedes_mark_id, v_actor_id, v_now
  ) RETURNING id INTO v_mark_id;

  IF v_event.status = 'closed' THEN
    UPDATE public.assessment_events
    SET status = 'marking', updated_at = v_now
    WHERE id = v_event.id;
  END IF;

  INSERT INTO public.audit_events (
    actor_user_id, organisation_id, action, resource_type, resource_id, metadata
  ) VALUES (
    v_actor_id, v_attempt.organisation_id, v_action,
    'assessment_response_mark', v_mark_id::text,
    jsonb_build_object(
      'attemptId', v_attempt.id, 'taskId', p_task_id,
      'markVersion', v_mark_version, 'awardedScore', p_awarded_score,
      'supersedesMarkId', p_supersedes_mark_id
    )
  );

  RETURN v_mark_id;
END;
$$;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.finalize_assessment_marking(p_attempt_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_attempt public.assessment_attempts%ROWTYPE;
  v_event public.assessment_events%ROWTYPE;
  v_result_id uuid;
  v_total_score numeric(10,2);
  v_maximum_score numeric(10,2);
  v_percentage numeric(5,2);
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
  IF v_attempt.status <> 'submitted' THEN
    RAISE EXCEPTION 'Only submitted attempts can have marking finalised' USING ERRCODE = '23514';
  END IF;

  SELECT event_record.* INTO v_event
  FROM public.assessment_events AS event_record
  WHERE event_record.id = v_attempt.event_id
    AND event_record.organisation_id = v_attempt.organisation_id
  FOR UPDATE;
  IF NOT FOUND OR v_event.status <> 'marking' THEN
    RAISE EXCEPTION 'Assessment event must be in marking state before result generation' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.assessment_tasks AS task
    WHERE task.tenant_organisation_id = v_attempt.tenant_organisation_id
      AND task.organisation_id = v_attempt.organisation_id
      AND task.instrument_version_id = v_attempt.instrument_version_id
      AND task.required = true
  ) THEN
    RAISE EXCEPTION 'Assessment instrument has no required tasks and cannot produce a result' USING ERRCODE = '23514';
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
    RAISE EXCEPTION 'Every required task must have a captured response and a final mark before result generation' USING ERRCODE = '23514';
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
    RAISE EXCEPTION 'Assessment result requires a positive maximum score' USING ERRCODE = '23514';
  END IF;

  v_percentage := pg_catalog.round((v_total_score / v_maximum_score) * 100, 2);

  INSERT INTO public.assessment_results (
    tenant_organisation_id, organisation_id, attempt_id, instrument_version_id,
    result_version, total_awarded_score, maximum_score, percentage,
    status, created_by, created_at
  ) VALUES (
    v_attempt.tenant_organisation_id, v_attempt.organisation_id, v_attempt.id, v_attempt.instrument_version_id,
    1, v_total_score, v_maximum_score, v_percentage,
    'marked', v_actor_id, v_now
  ) RETURNING id INTO v_result_id;

  UPDATE public.assessment_attempts
  SET status = 'marked', updated_at = v_now
  WHERE id = v_attempt.id;

  INSERT INTO public.audit_events (
    actor_user_id, organisation_id, action, resource_type, resource_id, metadata
  ) VALUES (
    v_actor_id, v_attempt.organisation_id, 'assessment.result_generated',
    'assessment_result', v_result_id::text,
    jsonb_build_object(
      'attemptId', v_attempt.id, 'resultVersion', 1,
      'totalAwardedScore', v_total_score, 'maximumScore', v_maximum_score,
      'percentage', v_percentage, 'includedTaskScope', 'required_tasks_only'
    )
  );

  RETURN v_result_id;
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION sentinel_private.void_assessment_attempt(uuid, text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.close_assessment_event(uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.record_assessment_mark(uuid, uuid, numeric, text, uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.finalize_assessment_marking(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.void_assessment_attempt(uuid, text) TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.close_assessment_event(uuid) TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.record_assessment_mark(uuid, uuid, numeric, text, uuid) TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.finalize_assessment_marking(uuid) TO sentinel_learner_runtime;
