ALTER TABLE public.learner_progression_events DROP CONSTRAINT learner_progression_events_event_type_check;
--> statement-breakpoint
ALTER TABLE public.learner_progression_events ADD CONSTRAINT learner_progression_events_event_type_check CHECK (event_type IN ('admitted', 'promoted', 'repeated', 'transferred_in', 'transferred_out', 'withdrawn', 'graduated', 'reinstated', 'class_assigned'));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION sentinel_private.assign_learner_to_class(
  p_enrolment_id uuid,
  p_class_id uuid,
  p_effective_at date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_enrolment public.learner_enrolments%ROWTYPE;
  v_class public.classes%ROWTYPE;
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT enrolment.*
  INTO v_enrolment
  FROM public.learner_enrolments AS enrolment
  WHERE enrolment.id = p_enrolment_id
    AND sentinel_private.can_manage_learner_records(enrolment.tenant_organisation_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrolment not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_enrolment.status <> 'active' THEN
    RAISE EXCEPTION 'Only active enrolments can be placed into a class' USING ERRCODE = '23514';
  END IF;

  IF p_effective_at < v_enrolment.starts_at
    OR (v_enrolment.ends_at IS NOT NULL AND p_effective_at >= v_enrolment.ends_at) THEN
    RAISE EXCEPTION 'Placement date must fall within the active enrolment period' USING ERRCODE = '23514';
  END IF;

  IF v_enrolment.class_id IS NOT NULL THEN
    IF v_enrolment.class_id = p_class_id THEN
      RETURN v_enrolment.id;
    END IF;
    RAISE EXCEPTION 'This enrolment already has a class; reassignment requires a separate approved workflow' USING ERRCODE = '23514';
  END IF;

  SELECT class_record.*
  INTO v_class
  FROM public.classes AS class_record
  WHERE class_record.id = p_class_id
    AND class_record.tenant_organisation_id = v_enrolment.tenant_organisation_id
    AND class_record.organisation_id = v_enrolment.organisation_id
    AND class_record.grade = v_enrolment.grade
    AND class_record.academic_year = v_enrolment.academic_year
    AND class_record.status = 'active'
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected class does not match the active enrolment grade, academic year and organisation' USING ERRCODE = '23514';
  END IF;

  UPDATE public.learner_enrolments
  SET class_id = p_class_id, updated_at = pg_catalog.now()
  WHERE id = v_enrolment.id;

  INSERT INTO public.learner_progression_events (
    tenant_organisation_id, learner_id, event_type, from_grade, to_grade, effective_at, actor_user_id, reason_code
  ) VALUES (
    v_enrolment.tenant_organisation_id, v_enrolment.learner_id, 'class_assigned',
    v_enrolment.grade, v_enrolment.grade, p_effective_at, v_actor_id, 'class_assignment'
  );

  INSERT INTO public.audit_events (
    actor_user_id, organisation_id, action, resource_type, resource_id, metadata
  ) VALUES (
    v_actor_id, v_enrolment.organisation_id, 'learner.class_assigned', 'learner_enrolment',
    v_enrolment.id::text,
    jsonb_build_object(
      'classId', v_class.id,
      'classCode', v_class.class_code,
      'grade', v_class.grade,
      'academicYear', v_class.academic_year,
      'effectiveAt', p_effective_at
    )
  );

  RETURN v_enrolment.id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.assign_learner_to_class(uuid, uuid, date) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.assign_learner_to_class(uuid, uuid, date) TO sentinel_learner_runtime;
