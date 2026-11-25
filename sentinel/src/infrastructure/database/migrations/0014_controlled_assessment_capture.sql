-- Controlled event opening, attempt creation, response capture and submission.
-- All writes are atomic SECURITY DEFINER operations; the runtime role receives EXECUTE only.
-- Event times remain UTC until organisation timezone support is modelled.

CREATE FUNCTION sentinel_private.open_assessment_event(p_event_id uuid)
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
  IF v_event.status <> 'scheduled' THEN
    RAISE EXCEPTION 'Only scheduled assessment events can be opened' USING ERRCODE = '23514';
  END IF;
  IF v_now < v_event.starts_at THEN
    RAISE EXCEPTION 'Assessment event cannot open before its scheduled start time' USING ERRCODE = '23514';
  END IF;
  IF v_now >= v_event.ends_at THEN
    RAISE EXCEPTION 'Assessment event has passed its scheduled end time' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.assessment_instrument_versions AS instrument
    WHERE instrument.id = v_event.instrument_version_id
      AND instrument.tenant_organisation_id = v_event.tenant_organisation_id
      AND instrument.organisation_id = v_event.organisation_id
      AND instrument.grade = v_event.grade
      AND instrument.learning_area_id = v_event.learning_area_id
      AND instrument.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Assessment event requires an approved instrument version' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.assessment_programmes AS programme
    WHERE programme.id = v_event.programme_id
      AND programme.tenant_organisation_id = v_event.tenant_organisation_id
      AND programme.organisation_id = v_event.organisation_id
      AND programme.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Assessment event requires an active assessment programme' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.assessment_event_eligible_enrolments AS roster
    WHERE roster.event_id = v_event.id
      AND roster.tenant_organisation_id = v_event.tenant_organisation_id
      AND roster.organisation_id = v_event.organisation_id
  ) THEN
    RAISE EXCEPTION 'Assessment event has no frozen eligible learner roster' USING ERRCODE = '23514';
  END IF;

  UPDATE public.assessment_events
  SET status = 'open', updated_at = v_now
  WHERE id = v_event.id;

  INSERT INTO public.audit_events (
    actor_user_id, organisation_id, action, resource_type, resource_id, metadata
  ) VALUES (
    v_actor_id, v_event.organisation_id, 'assessment.event_opened',
    'assessment_event', v_event.id::text,
    jsonb_build_object('startsAt', v_event.starts_at, 'endsAt', v_event.ends_at, 'openedAt', v_now)
  );

  RETURN v_now;
END;
$$;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.create_assessment_attempt(p_event_id uuid, p_enrolment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_event public.assessment_events%ROWTYPE;
  v_attempt_id uuid;
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
    RAISE EXCEPTION 'Learner attempts can only be created for open assessment events' USING ERRCODE = '23514';
  END IF;
  IF v_now < v_event.starts_at OR v_now >= v_event.ends_at THEN
    RAISE EXCEPTION 'Assessment event is outside its permitted attempt window' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.assessment_event_eligible_enrolments AS roster
    WHERE roster.tenant_organisation_id = v_event.tenant_organisation_id
      AND roster.organisation_id = v_event.organisation_id
      AND roster.event_id = v_event.id
      AND roster.enrolment_id = p_enrolment_id
      AND roster.instrument_version_id = v_event.instrument_version_id
      AND roster.grade = v_event.grade
      AND roster.learning_area_id = v_event.learning_area_id
      AND roster.academic_year = v_event.academic_year
  ) THEN
    RAISE EXCEPTION 'Learner enrolment is not on this assessment event eligible roster' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.assessment_attempts (
    tenant_organisation_id, organisation_id, event_id, enrolment_id,
    instrument_version_id, grade, learning_area_id, academic_year,
    attempt_number, status, captured_by
  ) VALUES (
    v_event.tenant_organisation_id, v_event.organisation_id, v_event.id, p_enrolment_id,
    v_event.instrument_version_id, v_event.grade, v_event.learning_area_id, v_event.academic_year,
    1, 'in_progress', v_actor_id
  ) RETURNING id INTO v_attempt_id;

  INSERT INTO public.audit_events (
    actor_user_id, organisation_id, action, resource_type, resource_id, metadata
  ) VALUES (
    v_actor_id, v_event.organisation_id, 'assessment.attempt_created',
    'assessment_attempt', v_attempt_id::text,
    jsonb_build_object('eventId', v_event.id, 'enrolmentId', p_enrolment_id, 'instrumentVersionId', v_event.instrument_version_id)
  );

  RETURN v_attempt_id;
END;
$$;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.capture_assessment_response(p_attempt_id uuid, p_task_id uuid, p_response_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_attempt public.assessment_attempts%ROWTYPE;
  v_event public.assessment_events%ROWTYPE;
  v_response_id uuid;
  v_now timestamptz := pg_catalog.now();
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_response_payload IS NULL OR pg_catalog.jsonb_typeof(p_response_payload) <> 'object' THEN
    RAISE EXCEPTION 'Response payload must be a JSON object' USING ERRCODE = '22023';
  END IF;

  SELECT attempt.* INTO v_attempt
  FROM public.assessment_attempts AS attempt
  WHERE attempt.id = p_attempt_id
    AND sentinel_private.can_access_assessment_data(attempt.organisation_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment attempt not found or access denied' USING ERRCODE = 'P0002';
  END IF;
  SELECT event_record.* INTO v_event
  FROM public.assessment_events AS event_record
  WHERE event_record.id = v_attempt.event_id
    AND event_record.organisation_id = v_attempt.organisation_id
  FOR UPDATE;
  IF NOT FOUND OR v_event.status <> 'open' THEN
    RAISE EXCEPTION 'Responses can only be captured while the assessment event is open' USING ERRCODE = '23514';
  END IF;
  IF v_now < v_event.starts_at OR v_now >= v_event.ends_at THEN
    RAISE EXCEPTION 'Assessment event is outside its permitted response window' USING ERRCODE = '23514';
  END IF;
  IF v_attempt.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Responses can only be captured for an in-progress attempt' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.assessment_tasks AS task
    WHERE task.id = p_task_id
      AND task.tenant_organisation_id = v_attempt.tenant_organisation_id
      AND task.organisation_id = v_attempt.organisation_id
      AND task.instrument_version_id = v_attempt.instrument_version_id
  ) THEN
    RAISE EXCEPTION 'Task does not belong to this assessment instrument version' USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.assessment_responses (
    tenant_organisation_id, organisation_id, attempt_id, task_id,
    instrument_version_id, response_payload, captured_by, captured_at
  ) VALUES (
    v_attempt.tenant_organisation_id, v_attempt.organisation_id, v_attempt.id, p_task_id,
    v_attempt.instrument_version_id, p_response_payload, v_actor_id, v_now
  ) RETURNING id INTO v_response_id;

  INSERT INTO public.audit_events (
    actor_user_id, organisation_id, action, resource_type, resource_id, metadata
  ) VALUES (
    v_actor_id, v_attempt.organisation_id, 'assessment.response_captured',
    'assessment_response', v_response_id::text,
    jsonb_build_object('attemptId', v_attempt.id, 'taskId', p_task_id)
  );

  RETURN v_response_id;
END;
$$;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.submit_assessment_attempt(p_attempt_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_attempt public.assessment_attempts%ROWTYPE;
  v_event public.assessment_events%ROWTYPE;
  v_required_count integer;
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
  SELECT event_record.* INTO v_event
  FROM public.assessment_events AS event_record
  WHERE event_record.id = v_attempt.event_id
    AND event_record.organisation_id = v_attempt.organisation_id
  FOR UPDATE;
  IF NOT FOUND OR v_event.status <> 'open' THEN
    RAISE EXCEPTION 'An attempt can only be submitted while its assessment event is open' USING ERRCODE = '23514';
  END IF;
  IF v_now < v_event.starts_at OR v_now >= v_event.ends_at THEN
    RAISE EXCEPTION 'Assessment event is outside its permitted submission window' USING ERRCODE = '23514';
  END IF;
  IF v_attempt.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Only an in-progress assessment attempt can be submitted' USING ERRCODE = '23514';
  END IF;

  SELECT count(*) INTO v_required_count
  FROM public.assessment_tasks AS task
  WHERE task.tenant_organisation_id = v_attempt.tenant_organisation_id
    AND task.organisation_id = v_attempt.organisation_id
    AND task.instrument_version_id = v_attempt.instrument_version_id
    AND task.required = true;
  IF v_required_count = 0 THEN
    RAISE EXCEPTION 'Assessment instrument has no required tasks and cannot be submitted' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.assessment_tasks AS task
    LEFT JOIN public.assessment_responses AS response
      ON response.tenant_organisation_id = task.tenant_organisation_id
     AND response.organisation_id = task.organisation_id
     AND response.task_id = task.id
     AND response.attempt_id = v_attempt.id
    WHERE task.tenant_organisation_id = v_attempt.tenant_organisation_id
      AND task.organisation_id = v_attempt.organisation_id
      AND task.instrument_version_id = v_attempt.instrument_version_id
      AND task.required = true
      AND response.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Every required assessment task must have a captured response before submission' USING ERRCODE = '23514';
  END IF;

  UPDATE public.assessment_attempts
  SET status = 'submitted', submitted_at = v_now, updated_at = v_now
  WHERE id = v_attempt.id;

  INSERT INTO public.audit_events (
    actor_user_id, organisation_id, action, resource_type, resource_id, metadata
  ) VALUES (
    v_actor_id, v_attempt.organisation_id, 'assessment.attempt_submitted',
    'assessment_attempt', v_attempt.id::text,
    jsonb_build_object('eventId', v_event.id, 'enrolmentId', v_attempt.enrolment_id, 'submittedAt', v_now, 'requiredTaskCount', v_required_count)
  );

  RETURN v_now;
END;
$$;
--> statement-breakpoint

-- Captured evidence is immutable; corrections must be represented by a future,
-- explicitly reasoned correction workflow rather than silent overwrites.
CREATE FUNCTION sentinel_private.prevent_assessment_response_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Captured assessment responses are append-only; use a governed correction workflow'
    USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER assessment_responses_append_only
BEFORE UPDATE OR DELETE ON public.assessment_responses
FOR EACH ROW EXECUTE FUNCTION sentinel_private.prevent_assessment_response_mutation();
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.prevent_assessment_response_mutation() FROM PUBLIC;
--> statement-breakpoint

REVOKE ALL ON FUNCTION sentinel_private.open_assessment_event(uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.create_assessment_attempt(uuid, uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.capture_assessment_response(uuid, uuid, jsonb) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.submit_assessment_attempt(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.open_assessment_event(uuid) TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.create_assessment_attempt(uuid, uuid) TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.capture_assessment_response(uuid, uuid, jsonb) TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.submit_assessment_attempt(uuid) TO sentinel_learner_runtime;
