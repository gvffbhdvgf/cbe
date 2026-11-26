-- Curriculum outcome mapping governance and organisation-local assessment scheduling.

ALTER TABLE public.organisations
  ADD COLUMN time_zone varchar(64) NOT NULL DEFAULT 'Africa/Nairobi';
--> statement-breakpoint
ALTER TABLE public.assessment_events
  ADD COLUMN time_zone varchar(64) NOT NULL DEFAULT 'Africa/Nairobi';
--> statement-breakpoint

CREATE FUNCTION sentinel_private.validate_organisation_time_zone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW.time_zone IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_timezone_names AS zone WHERE zone.name = NEW.time_zone
  ) THEN
    RAISE EXCEPTION 'A valid IANA time zone is required'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER organisations_time_zone_validation
BEFORE INSERT OR UPDATE OF time_zone ON public.organisations
FOR EACH ROW EXECUTE FUNCTION sentinel_private.validate_organisation_time_zone();
--> statement-breakpoint
CREATE TRIGGER assessment_events_time_zone_validation
BEFORE INSERT OR UPDATE OF time_zone ON public.assessment_events
FOR EACH ROW EXECUTE FUNCTION sentinel_private.validate_organisation_time_zone();
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.validate_organisation_time_zone() FROM PUBLIC;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION sentinel_private.create_assessment_event(
  p_organisation_id uuid, p_programme_id uuid, p_instrument_version_id uuid,
  p_title text, p_starts_at timestamptz, p_ends_at timestamptz,
  p_academic_year integer, p_moderation_required boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_instrument public.assessment_instrument_versions%ROWTYPE;
  v_event_id uuid;
  v_time_zone text;
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT sentinel_private.can_access_assessment_data(p_organisation_id) THEN
    RAISE EXCEPTION 'Assessment authoring authority is required' USING ERRCODE = '42501';
  END IF;
  IF length(trim(p_title)) NOT BETWEEN 3 AND 180 OR p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at
    OR p_academic_year NOT BETWEEN 2000 AND 2100 THEN
    RAISE EXCEPTION 'Assessment event details are invalid' USING ERRCODE = '22023';
  END IF;
  SELECT organisation.time_zone INTO v_time_zone
  FROM public.organisations AS organisation
  WHERE organisation.id = p_organisation_id AND organisation.status = 'active';
  IF v_time_zone IS NULL THEN RAISE EXCEPTION 'Organisation time zone is unavailable' USING ERRCODE = '23514'; END IF;
  SELECT instrument.* INTO v_instrument
  FROM public.assessment_instrument_versions AS instrument
  WHERE instrument.id = p_instrument_version_id
    AND instrument.tenant_organisation_id = p_organisation_id
    AND instrument.organisation_id = p_organisation_id
    AND instrument.status = 'approved'
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'An approved instrument version is required' USING ERRCODE = '23514'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.assessment_programmes AS programme
    WHERE programme.id = p_programme_id
      AND programme.tenant_organisation_id = p_organisation_id
      AND programme.organisation_id = p_organisation_id
      AND programme.status = 'active'
  ) THEN RAISE EXCEPTION 'An active assessment programme is required' USING ERRCODE = '23514'; END IF;
  INSERT INTO public.assessment_events (
    tenant_organisation_id, organisation_id, programme_id, instrument_version_id,
    grade, learning_area_id, academic_year, title, starts_at, ends_at, time_zone,
    status, moderation_required, created_by
  ) VALUES (
    p_organisation_id, p_organisation_id, p_programme_id, p_instrument_version_id,
    v_instrument.grade, v_instrument.learning_area_id, p_academic_year, trim(p_title),
    p_starts_at, p_ends_at, v_time_zone, 'draft', COALESCE(p_moderation_required, false), v_actor_id
  ) RETURNING id INTO v_event_id;
  INSERT INTO public.audit_events (actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, 'assessment.event_created', 'assessment_event', v_event_id::text,
    jsonb_build_object('programmeId', p_programme_id, 'instrumentVersionId', p_instrument_version_id,
      'grade', v_instrument.grade, 'academicYear', p_academic_year,
      'startsAt', p_starts_at, 'endsAt', p_ends_at, 'timeZone', v_time_zone));
  RETURN v_event_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.create_assessment_event(uuid,uuid,uuid,text,timestamptz,timestamptz,integer,boolean) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.create_assessment_event(uuid,uuid,uuid,text,timestamptz,timestamptz,integer,boolean) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.create_assessment_event_local(
  p_organisation_id uuid, p_programme_id uuid, p_instrument_version_id uuid,
  p_title text, p_starts_at_local timestamp without time zone,
  p_ends_at_local timestamp without time zone, p_academic_year integer,
  p_moderation_required boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_time_zone text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT sentinel_private.can_access_assessment_data(p_organisation_id) THEN
    RAISE EXCEPTION 'Assessment authoring authority is required' USING ERRCODE = '42501';
  END IF;
  IF p_starts_at_local IS NULL OR p_ends_at_local IS NULL THEN
    RAISE EXCEPTION 'Local assessment start and end times are required' USING ERRCODE = '22023';
  END IF;
  SELECT organisation.time_zone INTO v_time_zone
  FROM public.organisations AS organisation
  WHERE organisation.id = p_organisation_id AND organisation.status = 'active';
  IF v_time_zone IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_timezone_names AS zone WHERE zone.name = v_time_zone
  ) THEN RAISE EXCEPTION 'A valid organisation time zone is required' USING ERRCODE = '22023'; END IF;
  v_starts_at := p_starts_at_local AT TIME ZONE v_time_zone;
  v_ends_at := p_ends_at_local AT TIME ZONE v_time_zone;
  IF (v_starts_at AT TIME ZONE v_time_zone) <> p_starts_at_local
    OR (v_ends_at AT TIME ZONE v_time_zone) <> p_ends_at_local THEN
    RAISE EXCEPTION 'The supplied local time does not exist in the organisation time zone' USING ERRCODE = '22023';
  END IF;
  RETURN sentinel_private.create_assessment_event(
    p_organisation_id, p_programme_id, p_instrument_version_id, p_title,
    v_starts_at, v_ends_at, p_academic_year, p_moderation_required
  );
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.create_assessment_event_local(uuid,uuid,uuid,text,timestamp without time zone,timestamp without time zone,integer,boolean) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.create_assessment_event_local(uuid,uuid,uuid,text,timestamp without time zone,timestamp without time zone,integer,boolean) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION sentinel_private.schedule_assessment_event(p_event_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_event public.assessment_events%ROWTYPE;
  v_eligible_count integer;
  v_eligibility_date date;
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT event_record.* INTO v_event
  FROM public.assessment_events AS event_record
  WHERE event_record.id = p_event_id
    AND sentinel_private.can_access_assessment_data(event_record.organisation_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assessment event not found or access denied' USING ERRCODE = 'P0002'; END IF;
  IF v_event.status <> 'draft' THEN RAISE EXCEPTION 'Only draft assessment events can be scheduled' USING ERRCODE = '23514'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.assessment_instrument_versions AS instrument
    WHERE instrument.id = v_event.instrument_version_id
      AND instrument.tenant_organisation_id = v_event.tenant_organisation_id
      AND instrument.organisation_id = v_event.organisation_id
      AND instrument.grade = v_event.grade
      AND instrument.learning_area_id = v_event.learning_area_id
      AND instrument.status = 'approved'
  ) THEN RAISE EXCEPTION 'Assessment event requires an approved instrument version' USING ERRCODE = '23514'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.assessment_programmes AS programme
    WHERE programme.id = v_event.programme_id
      AND programme.tenant_organisation_id = v_event.tenant_organisation_id
      AND programme.organisation_id = v_event.organisation_id
      AND programme.status = 'active'
  ) THEN RAISE EXCEPTION 'Assessment event requires an active assessment programme' USING ERRCODE = '23514'; END IF;

  v_eligibility_date := (v_event.starts_at AT TIME ZONE v_event.time_zone)::date;
  INSERT INTO public.assessment_event_eligible_enrolments (
    tenant_organisation_id, organisation_id, event_id, enrolment_id, learner_id,
    class_id, instrument_version_id, grade, learning_area_id, academic_year,
    eligibility_date, snapshot_by
  )
  SELECT
    v_event.tenant_organisation_id, v_event.organisation_id, v_event.id,
    enrolment.id, enrolment.learner_id, enrolment.class_id,
    v_event.instrument_version_id, v_event.grade, v_event.learning_area_id,
    v_event.academic_year, v_eligibility_date, v_actor_id
  FROM public.learner_enrolments AS enrolment
  INNER JOIN public.learner_profiles AS learner
    ON learner.id = enrolment.learner_id
   AND learner.tenant_organisation_id = enrolment.tenant_organisation_id
  WHERE enrolment.tenant_organisation_id = v_event.tenant_organisation_id
    AND enrolment.organisation_id = v_event.organisation_id
    AND enrolment.grade = v_event.grade
    AND enrolment.academic_year = v_event.academic_year
    AND enrolment.status = 'active'
    AND learner.status = 'active'
    AND enrolment.starts_at <= v_eligibility_date
    AND (enrolment.ends_at IS NULL OR enrolment.ends_at > v_eligibility_date);
  GET DIAGNOSTICS v_eligible_count = ROW_COUNT;
  IF v_eligible_count = 0 THEN
    RAISE EXCEPTION 'Cannot schedule an assessment event with no eligible learner enrolments' USING ERRCODE = '23514';
  END IF;
  UPDATE public.assessment_events SET status = 'scheduled', updated_at = pg_catalog.now() WHERE id = v_event.id;
  INSERT INTO public.audit_events (actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, v_event.organisation_id, 'assessment.event_scheduled', 'assessment_event', v_event.id::text,
    jsonb_build_object('eligibleLearnerCount', v_eligible_count, 'eligibilityDate', v_eligibility_date,
      'timeZone', v_event.time_zone, 'instrumentVersionId', v_event.instrument_version_id,
      'grade', v_event.grade, 'academicYear', v_event.academic_year));
  RETURN v_eligible_count;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.schedule_assessment_event(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.schedule_assessment_event(uuid) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.create_assessment_task_outcome_mapping(
  p_organisation_id uuid, p_instrument_version_id uuid, p_task_id uuid, p_curriculum_source_node_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_instrument_id uuid;
  v_grade integer;
  v_learning_area_id uuid;
  v_mapping_id uuid;
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT sentinel_private.can_access_assessment_data(p_organisation_id) THEN
    RAISE EXCEPTION 'Assessment authoring authority is required' USING ERRCODE = '42501';
  END IF;
  SELECT instrument.id, instrument.grade, instrument.learning_area_id
    INTO v_instrument_id, v_grade, v_learning_area_id
  FROM public.assessment_tasks AS task
  JOIN public.assessment_instrument_versions AS instrument
    ON instrument.id = task.instrument_version_id
   AND instrument.tenant_organisation_id = task.tenant_organisation_id
   AND instrument.organisation_id = task.organisation_id
  WHERE task.id = p_task_id
    AND task.tenant_organisation_id = p_organisation_id
    AND task.organisation_id = p_organisation_id
    AND instrument.status IN ('draft','in_review')
  FOR SHARE OF task, instrument;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not found, immutable, or access denied' USING ERRCODE = 'P0002'; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.curriculum_source_nodes AS node
    JOIN public.curriculum_design_documents AS document ON document.id = node.document_id
    JOIN public.curriculum_grade_offerings AS offering ON offering.id = document.grade_offering_id
    WHERE node.id = p_curriculum_source_node_id
      AND node.node_type = 'specific_outcome'
      AND node.extraction_status = 'approved'
      AND document.review_status = 'approved'
      AND document.rights_status = 'confirmed'
      AND offering.grade = v_grade
      AND offering.learning_area_id = v_learning_area_id
  ) THEN
    RAISE EXCEPTION 'Mapping requires an approved, rights-cleared specific outcome for the same grade and learning area'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.assessment_task_outcome_mappings (
    tenant_organisation_id, organisation_id, task_id, instrument_version_id,
    curriculum_source_node_id, status, created_by
  ) VALUES (
    p_organisation_id, p_organisation_id, p_task_id, v_instrument_id,
    p_curriculum_source_node_id, 'pending', v_actor_id
  ) RETURNING id INTO v_mapping_id;
  INSERT INTO public.audit_events (actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, 'assessment.outcome_mapping_proposed',
    'assessment_task_outcome_mapping', v_mapping_id::text,
    jsonb_build_object('taskId', p_task_id, 'curriculumSourceNodeId', p_curriculum_source_node_id));
  RETURN v_mapping_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.create_assessment_task_outcome_mapping(uuid,uuid,uuid,uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.create_assessment_task_outcome_mapping(uuid,uuid,uuid) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.review_assessment_task_outcome_mapping(
  p_organisation_id uuid, p_mapping_id uuid, p_decision text, p_review_note text
) RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_mapping public.assessment_task_outcome_mappings%ROWTYPE;
  v_reviewed_at timestamptz := pg_catalog.now();
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF NOT sentinel_private.can_access_assessment_data(p_organisation_id) THEN
    RAISE EXCEPTION 'Assessment authoring authority is required' USING ERRCODE = '42501';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected') OR length(trim(COALESCE(p_review_note,''))) < 5
    OR length(trim(p_review_note)) > 1000 THEN
    RAISE EXCEPTION 'A valid decision and review note of 5–1000 characters are required' USING ERRCODE = '22023';
  END IF;
  SELECT mapping.* INTO v_mapping
  FROM public.assessment_task_outcome_mappings AS mapping
  WHERE mapping.id = p_mapping_id
    AND mapping.tenant_organisation_id = p_organisation_id
    AND mapping.organisation_id = p_organisation_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Outcome mapping not found or access denied' USING ERRCODE = 'P0002'; END IF;
  IF v_mapping.status <> 'pending' THEN RAISE EXCEPTION 'Only pending outcome mappings can be reviewed' USING ERRCODE = '23514'; END IF;
  IF v_mapping.created_by = v_actor_id THEN
    RAISE EXCEPTION 'Outcome mapping review requires an independent reviewer' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.assessment_instrument_versions AS instrument
    WHERE instrument.id = v_mapping.instrument_version_id
      AND instrument.organisation_id = p_organisation_id
      AND instrument.status IN ('draft','in_review')
  ) THEN RAISE EXCEPTION 'Outcome mappings are immutable after instrument approval' USING ERRCODE = '55000'; END IF;

  UPDATE public.assessment_task_outcome_mappings
  SET status = p_decision, reviewed_by = v_actor_id, reviewed_at = v_reviewed_at,
      review_note = trim(p_review_note)
  WHERE id = v_mapping.id;
  INSERT INTO public.audit_events (actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, 'assessment.outcome_mapping_' || p_decision,
    'assessment_task_outcome_mapping', v_mapping.id::text,
    jsonb_build_object('taskId', v_mapping.task_id, 'curriculumSourceNodeId', v_mapping.curriculum_source_node_id,
      'createdBy', v_mapping.created_by, 'reviewNote', trim(p_review_note)));
  RETURN v_reviewed_at;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.review_assessment_task_outcome_mapping(uuid,uuid,text,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.review_assessment_task_outcome_mapping(uuid,uuid,text,text) TO sentinel_learner_runtime;
