-- Governed assessment authoring. Runtime writes are exposed only through narrow SECURITY DEFINER operations.

CREATE FUNCTION sentinel_private.create_assessment_programme(
  p_organisation_id uuid,
  p_programme_code text,
  p_title text,
  p_programme_type text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_programme_id uuid;
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT sentinel_private.can_access_assessment_data(p_organisation_id) THEN
    RAISE EXCEPTION 'Assessment authoring authority is required' USING ERRCODE = '42501';
  END IF;
  IF length(trim(p_programme_code)) NOT BETWEEN 2 AND 64
    OR length(trim(p_title)) NOT BETWEEN 3 AND 180
    OR p_programme_type IS NULL OR p_programme_type NOT IN ('formative','summative','diagnostic') THEN
    RAISE EXCEPTION 'Programme details are invalid' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.assessment_programmes (
    tenant_organisation_id, organisation_id, programme_code, title, programme_type, created_by
  ) VALUES (
    p_organisation_id, p_organisation_id, upper(trim(p_programme_code)), trim(p_title), p_programme_type, v_actor_id
  ) RETURNING id INTO v_programme_id;

  INSERT INTO public.audit_events (actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, 'assessment.programme_created', 'assessment_programme',
    v_programme_id::text, jsonb_build_object('programmeCode', upper(trim(p_programme_code)), 'programmeType', p_programme_type));
  RETURN v_programme_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.create_assessment_programme(uuid,text,text,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.create_assessment_programme(uuid,text,text,text) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.create_assessment_instrument_version(
  p_organisation_id uuid,
  p_learning_area_id uuid,
  p_grade integer,
  p_instrument_code text,
  p_title text,
  p_tasks jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_version_id uuid;
  v_version_number integer;
  v_task jsonb;
  v_task_count integer := 0;
  v_task_code text;
  v_response_type text;
  v_maximum_score numeric;
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT sentinel_private.can_access_assessment_data(p_organisation_id) THEN
    RAISE EXCEPTION 'Assessment authoring authority is required' USING ERRCODE = '42501';
  END IF;
  IF p_grade NOT BETWEEN 1 AND 9 OR length(trim(p_instrument_code)) NOT BETWEEN 2 AND 64
    OR length(trim(p_title)) NOT BETWEEN 3 AND 180 THEN
    RAISE EXCEPTION 'Instrument details are invalid' USING ERRCODE = '22023';
  END IF;
  IF p_tasks IS NULL OR jsonb_typeof(p_tasks) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Instrument tasks must be supplied as an array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_tasks) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'An instrument requires between one and one hundred tasks' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.curriculum_learning_areas area WHERE area.id = p_learning_area_id) THEN
    RAISE EXCEPTION 'Learning area not found' USING ERRCODE = '23503';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_organisation_id::text || ':' || upper(trim(p_instrument_code)), 0));
  SELECT COALESCE(max(instrument.version_number), 0) + 1 INTO v_version_number
  FROM public.assessment_instrument_versions instrument
  WHERE instrument.organisation_id = p_organisation_id
    AND instrument.instrument_code = upper(trim(p_instrument_code));

  INSERT INTO public.assessment_instrument_versions (
    tenant_organisation_id, organisation_id, learning_area_id, grade,
    instrument_code, version_number, title, status, created_by
  ) VALUES (
    p_organisation_id, p_organisation_id, p_learning_area_id, p_grade,
    upper(trim(p_instrument_code)), v_version_number, trim(p_title), 'draft', v_actor_id
  ) RETURNING id INTO v_version_id;

  FOR v_task IN SELECT value FROM jsonb_array_elements(p_tasks) LOOP
    v_task_count := v_task_count + 1;
    v_task_code := trim(v_task->>'taskCode');
    v_response_type := v_task->>'responseType';
    v_maximum_score := (v_task->>'maximumScore')::numeric;
    IF length(v_task_code) NOT BETWEEN 1 AND 40
      OR length(trim(v_task->>'title')) NOT BETWEEN 2 AND 200
      OR v_response_type NOT IN ('text','numeric','boolean','choice','observation','evidence')
      OR v_maximum_score IS NULL OR v_maximum_score <= 0 OR v_maximum_score > 100000
      OR (v_task ? 'required' AND jsonb_typeof(v_task->'required') <> 'boolean') THEN
      RAISE EXCEPTION 'Instrument task % is invalid', v_task_count USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.assessment_tasks (
      tenant_organisation_id, organisation_id, instrument_version_id, task_code, title,
      response_type, maximum_score, required, display_order
    ) VALUES (
      p_organisation_id, p_organisation_id, v_version_id, v_task_code,
      trim(v_task->>'title'), v_response_type, v_maximum_score,
      COALESCE((v_task->>'required')::boolean, true),
      COALESCE((v_task->>'displayOrder')::integer, v_task_count - 1)
    );
  END LOOP;

  INSERT INTO public.audit_events (actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, 'assessment.instrument_version_created', 'assessment_instrument_version',
    v_version_id::text, jsonb_build_object('instrumentCode', upper(trim(p_instrument_code)),
      'versionNumber', v_version_number, 'grade', p_grade, 'taskCount', v_task_count));
  RETURN v_version_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.create_assessment_instrument_version(uuid,uuid,integer,text,text,jsonb) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.create_assessment_instrument_version(uuid,uuid,integer,text,text,jsonb) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.approve_assessment_instrument_version(p_instrument_version_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_instrument public.assessment_instrument_versions%ROWTYPE;
  v_now timestamptz := pg_catalog.now();
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT instrument.* INTO v_instrument
  FROM public.assessment_instrument_versions instrument
  WHERE instrument.id = p_instrument_version_id
    AND sentinel_private.can_access_assessment_data(instrument.organisation_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Instrument not found or access denied' USING ERRCODE = 'P0002'; END IF;
  IF v_instrument.status NOT IN ('draft','in_review') THEN
    RAISE EXCEPTION 'Only draft or in-review instruments can be approved' USING ERRCODE = '23514';
  END IF;
  IF v_instrument.created_by = v_actor_id THEN
    RAISE EXCEPTION 'Instrument approval requires a different authorised officer' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assessment_tasks task WHERE task.instrument_version_id = v_instrument.id
    AND task.organisation_id = v_instrument.organisation_id AND task.required = true) THEN
    RAISE EXCEPTION 'An instrument requires at least one required task' USING ERRCODE = '23514';
  END IF;

  UPDATE public.assessment_instrument_versions
  SET status = 'approved', approved_by = v_actor_id, approved_at = v_now
  WHERE id = v_instrument.id;
  INSERT INTO public.audit_events (actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, v_instrument.organisation_id, 'assessment.instrument_version_approved',
    'assessment_instrument_version', v_instrument.id::text,
    jsonb_build_object('versionNumber', v_instrument.version_number, 'createdBy', v_instrument.created_by));
  RETURN v_now;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.approve_assessment_instrument_version(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.approve_assessment_instrument_version(uuid) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.create_assessment_event(
  p_organisation_id uuid,
  p_programme_id uuid,
  p_instrument_version_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_academic_year integer,
  p_moderation_required boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_instrument public.assessment_instrument_versions%ROWTYPE;
  v_event_id uuid;
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT sentinel_private.can_access_assessment_data(p_organisation_id) THEN
    RAISE EXCEPTION 'Assessment authoring authority is required' USING ERRCODE = '42501';
  END IF;
  IF length(trim(p_title)) NOT BETWEEN 3 AND 180 OR p_starts_at IS NULL OR p_ends_at <= p_starts_at
    OR p_academic_year NOT BETWEEN 2000 AND 2100 THEN
    RAISE EXCEPTION 'Assessment event details are invalid' USING ERRCODE = '22023';
  END IF;
  SELECT instrument.* INTO v_instrument
  FROM public.assessment_instrument_versions instrument
  WHERE instrument.id = p_instrument_version_id
    AND instrument.tenant_organisation_id = p_organisation_id
    AND instrument.organisation_id = p_organisation_id
    AND instrument.status = 'approved'
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'An approved instrument version is required' USING ERRCODE = '23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assessment_programmes programme
    WHERE programme.id = p_programme_id AND programme.tenant_organisation_id = p_organisation_id
      AND programme.organisation_id = p_organisation_id AND programme.status = 'active') THEN
    RAISE EXCEPTION 'An active assessment programme is required' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.assessment_events (
    tenant_organisation_id, organisation_id, programme_id, instrument_version_id,
    grade, learning_area_id, academic_year, title, starts_at, ends_at,
    status, moderation_required, created_by
  ) VALUES (
    p_organisation_id, p_organisation_id, p_programme_id, p_instrument_version_id,
    v_instrument.grade, v_instrument.learning_area_id, p_academic_year, trim(p_title),
    p_starts_at, p_ends_at, 'draft', COALESCE(p_moderation_required, false), v_actor_id
  ) RETURNING id INTO v_event_id;

  INSERT INTO public.audit_events (actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, 'assessment.event_created', 'assessment_event',
    v_event_id::text, jsonb_build_object('programmeId', p_programme_id,
      'instrumentVersionId', p_instrument_version_id, 'grade', v_instrument.grade,
      'academicYear', p_academic_year, 'startsAt', p_starts_at, 'endsAt', p_ends_at));
  RETURN v_event_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.create_assessment_event(uuid,uuid,uuid,text,timestamptz,timestamptz,integer,boolean) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.create_assessment_event(uuid,uuid,uuid,text,timestamptz,timestamptz,integer,boolean) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.list_assessment_eligible_enrolments(p_event_id uuid)
RETURNS TABLE(enrolment_id uuid, learner_id uuid, learner_reference text, class_id uuid, attempt_id uuid, attempt_status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT roster.enrolment_id, roster.learner_id, learner.learner_reference, roster.class_id,
    attempt.id, attempt.status
  FROM public.assessment_event_eligible_enrolments roster
  INNER JOIN public.learner_profiles learner
    ON learner.id = roster.learner_id
   AND learner.tenant_organisation_id = roster.tenant_organisation_id
  LEFT JOIN public.assessment_attempts attempt
    ON attempt.tenant_organisation_id = roster.tenant_organisation_id
   AND attempt.organisation_id = roster.organisation_id
   AND attempt.event_id = roster.event_id
   AND attempt.enrolment_id = roster.enrolment_id
  WHERE roster.event_id = p_event_id
    AND sentinel_private.can_access_assessment_data(roster.organisation_id)
  ORDER BY learner.learner_reference, roster.enrolment_id
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.list_assessment_eligible_enrolments(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.list_assessment_eligible_enrolments(uuid) TO sentinel_learner_runtime;ORDER BY learner.learner_reference, roster.enrolment_id
$$;sed only through narrow SECURITY DEFINER operations.

CREATE FUNCTION sentinel_private.create_assessment_programme(
  p_organisation_id uuid,
  p_programme_code text,
  p_title text,
  p_programme_type text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_programme_id uuid;
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT sentinel_private.can_access_assessment_data(p_organisation_id) THEN
    RAISE EXCEPTION 'Assessment authoring authority is required' USING ERRCODE = '42501';
  END IF;
  IF length(trim(p_programme_code)) NOT BETWEEN 2 AND 64
    OR length(trim(p_title)) NOT BETWEEN 3 AND 180
    OR p_programme_type IS NULL OR p_programme_type NOT IN ('formative','summative','diagnostic') THEN
    RAISE EXCEPTION 'Programme details are invalid' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.assessment_programmes (
    tenant_organisation_id, organisation_id, programme_code, title, programme_type, created_by
  ) VALUES (
    p_organisation_id, p_organisation_id, upper(trim(p_programme_code)), trim(p_title), p_programme_type, v_actor_id
  ) RETURNING id INTO v_programme_id;

  INSERT INTO public.audit_events (actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, 'assessment.programme_created', 'assessment_programme',
    v_programme_id::text, jsonb_build_object('programmeCode', upper(trim(p_programme_code)), 'programmeType', p_programme_type));
  RETURN v_programme_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.create_assessment_programme(uuid,text,text,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.create_assessment_programme(uuid,text,text,text) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.create_assessment_instrument_version(
  p_organisation_id uuid,
  p_learning_area_id uuid,
  p_grade integer,
  p_instrument_code text,
  p_title text,
  p_tasks jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_version_id uuid;
  v_version_number integer;
  v_task jsonb;
  v_task_count integer := 0;
  v_task_code text;
  v_response_type text;
  v_maximum_score numeric;
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT sentinel_private.can_access_assessment_data(p_organisation_id) THEN
    RAISE EXCEPTION 'Assessment authoring authority is required' USING ERRCODE = '42501';
  END IF;
  IF p_grade NOT BETWEEN 1 AND 9 OR length(trim(p_instrument_code)) NOT BETWEEN 2 AND 64
    OR length(trim(p_title)) NOT BETWEEN 3 AND 180 THEN
    RAISE EXCEPTION 'Instrument details are invalid' USING ERRCODE = '22023';
  END IF;
  IF p_tasks IS NULL OR jsonb_typeof(p_tasks) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Instrument tasks must be supplied as an array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_tasks) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'An instrument requires between one and one hundred tasks' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.curriculum_learning_areas area WHERE area.id = p_learning_area_id) THEN
    RAISE EXCEPTION 'Learning area not found' USING ERRCODE = '23503';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_organisation_id::text || ':' || upper(trim(p_instrument_code)), 0));
  SELECT COALESCE(max(instrument.version_number), 0) + 1 INTO v_version_number
  FROM public.assessment_instrument_versions instrument
  WHERE instrument.organisation_id = p_organisation_id
    AND instrument.instrument_code = upper(trim(p_instrument_code));

  INSERT INTO public.assessment_instrument_versions (
    tenant_organisation_id, organisation_id, learning_area_id, grade,
    instrument_code, version_number, title, status, created_by
  ) VALUES (
    p_organisation_id, p_organisation_id, p_learning_area_id, p_grade,
    upper(trim(p_instrument_code)), v_version_number, trim(p_title), 'draft', v_actor_id
  ) RETURNING id INTO v_version_id;

  FOR v_task IN SELECT value FROM jsonb_array_elements(p_tasks) LOOP
    v_task_count := v_task_count + 1;
    v_task_code := trim(v_task->>'taskCode');
    v_response_type := v_task->>'responseType';
    v_maximum_score := (v_task->>'maximumScore')::numeric;
    IF length(v_task_code) NOT BETWEEN 1 AND 40
      OR length(trim(v_task->>'title')) NOT BETWEEN 2 AND 200
      OR v_response_type NOT IN ('text','numeric','boolean','choice','observation','evidence')
      OR v_maximum_score IS NULL OR v_maximum_score <= 0 OR v_maximum_score > 100000
      OR (v_task ? 'required' AND jsonb_typeof(v_task->'required') <> 'boolean') THEN
      RAISE EXCEPTION 'Instrument task % is invalid', v_task_count USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.assessment_tasks (
      tenant_organisation_id, organisation_id, instrument_version_id, task_code, title,
      response_type, maximum_score, required, display_order
    ) VALUES (
      p_organisation_id, p_organisation_id, v_version_id, v_task_code,
      trim(v_task->>'title'), v_response_type, v_maximum_score,
      COALESCE((v_task->>'required')::boolean, true),
      COALESCE((v_task->>'displayOrder')::integer, v_task_count - 1)
    );
  END LOOP;

  INSERT INTO public.audit_events (actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, 'assessment.instrument_version_created', 'assessment_instrument_version',
    v_version_id::text, jsonb_build_object('instrumentCode', upper(trim(p_instrument_code)),
      'versionNumber', v_version_number, 'grade', p_grade, 'taskCount', v_task_count));
  RETURN v_version_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.create_assessment_instrument_version(uuid,uuid,integer,text,text,jsonb) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.create_assessment_instrument_version(uuid,uuid,integer,text,text,jsonb) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.approve_assessment_instrument_version(p_instrument_version_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_instrument public.assessment_instrument_versions%ROWTYPE;
  v_now timestamptz := pg_catalog.now();
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT instrument.* INTO v_instrument
  FROM public.assessment_instrument_versions instrument
  WHERE instrument.id = p_instrument_version_id
    AND sentinel_private.can_access_assessment_data(instrument.organisation_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Instrument not found or access denied' USING ERRCODE = 'P0002'; END IF;
  IF v_instrument.status NOT IN ('draft','in_review') THEN
    RAISE EXCEPTION 'Only draft or in-review instruments can be approved' USING ERRCODE = '23514';
  END IF;
  IF v_instrument.created_by = v_actor_id THEN
    RAISE EXCEPTION 'Instrument approval requires a different authorised officer' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assessment_tasks task WHERE task.instrument_version_id = v_instrument.id
    AND task.organisation_id = v_instrument.organisation_id AND task.required = true) THEN
    RAISE EXCEPTION 'An instrument requires at least one required task' USING ERRCODE = '23514';
  END IF;

  UPDATE public.assessment_instrument_versions
  SET status = 'approved', approved_by = v_actor_id, approved_at = v_now
  WHERE id = v_instrument.id;
  INSERT INTO public.audit_events (actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, v_instrument.organisation_id, 'assessment.instrument_version_approved',
    'assessment_instrument_version', v_instrument.id::text,
    jsonb_build_object('versionNumber', v_instrument.version_number, 'createdBy', v_instrument.created_by));
  RETURN v_now;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.approve_assessment_instrument_version(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.approve_assessment_instrument_version(uuid) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.create_assessment_event(
  p_organisation_id uuid,
  p_programme_id uuid,
  p_instrument_version_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_academic_year integer,
  p_moderation_required boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_instrument public.assessment_instrument_versions%ROWTYPE;
  v_event_id uuid;
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT sentinel_private.can_access_assessment_data(p_organisation_id) THEN
    RAISE EXCEPTION 'Assessment authoring authority is required' USING ERRCODE = '42501';
  END IF;
  IF length(trim(p_title)) NOT BETWEEN 3 AND 180 OR p_starts_at IS NULL OR p_ends_at <= p_starts_at
    OR p_academic_year NOT BETWEEN 2000 AND 2100 THEN
    RAISE EXCEPTION 'Assessment event details are invalid' USING ERRCODE = '22023';
  END IF;
  SELECT instrument.* INTO v_instrument
  FROM public.assessment_instrument_versions instrument
  WHERE instrument.id = p_instrument_version_id
    AND instrument.tenant_organisation_id = p_organisation_id
    AND instrument.organisation_id = p_organisation_id
    AND instrument.status = 'approved'
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'An approved instrument version is required' USING ERRCODE = '23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assessment_programmes programme
    WHERE programme.id = p_programme_id AND programme.tenant_organisation_id = p_organisation_id
      AND programme.organisation_id = p_organisation_id AND programme.status = 'active') THEN
    RAISE EXCEPTION 'An active assessment programme is required' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.assessment_events (
    tenant_organisation_id, organisation_id, programme_id, instrument_version_id,
    grade, learning_area_id, academic_year, title, starts_at, ends_at,
    status, moderation_required, created_by
  ) VALUES (
    p_organisation_id, p_organisation_id, p_programme_id, p_instrument_version_id,
    v_instrument.grade, v_instrument.learning_area_id, p_academic_year, trim(p_title),
    p_starts_at, p_ends_at, 'draft', COALESCE(p_moderation_required, false), v_actor_id
  ) RETURNING id INTO v_event_id;

  INSERT INTO public.audit_events (actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, 'assessment.event_created', 'assessment_event',
    v_event_id::text, jsonb_build_object('programmeId', p_programme_id,
      'instrumentVersionId', p_instrument_version_id, 'grade', v_instrument.grade,
      'academicYear', p_academic_year, 'startsAt', p_starts_at, 'endsAt', p_ends_at));
  RETURN v_event_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.create_assessment_event(uuid,uuid,uuid,text,timestamptz,timestamptz,integer,boolean) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.create_assessment_event(uuid,uuid,uuid,text,timestamptz,timestamptz,integer,boolean) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.list_assessment_eligible_enrolments(p_event_id uuid)
RETURNS TABLE(enrolment_id uuid, learner_id uuid, learner_reference text, class_id uuid, attempt_id uuid, attempt_status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT roster.enrolment_id, roster.learner_id, learner.learner_reference, roster.class_id,
    attempt.id, attempt.status
  FROM public.assessment_event_eligible_enrolments roster
  INNER JOIN public.learner_profiles learner
    ON learner.id = roster.learner_id
   AND learner.tenant_organisation_id = roster.tenant_organisation_id
  LEFT JOIN public.assessment_attempts attempt
    ON attempt.tenant_organisation_id = roster.tenant_organisation_id
   AND attempt.organisation_id = roster.organisation_id
   AND attempt.event_id = roster.event_id
   AND attempt.enrolment_id = roster.enrolment_id
  WHERE roster.event_id = p_event_id
    AND sentinel_private.can_access_assessment_data(roster.organisation_id)
  ORDER BY learner.learner_reference, roster.enrolment_id
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.list_assessment_eligible_enrolments(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.list_assessment_eligible_enrolments(uuid) TO sentinel_learner_runtime;
