-- Freeze assessment eligibility at scheduling time. Dates are interpreted in UTC
-- because the current event model does not yet carry an organisation timezone.

CREATE TABLE public.assessment_event_eligible_enrolments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL,
  organisation_id uuid NOT NULL,
  event_id uuid NOT NULL,
  enrolment_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  class_id uuid,
  instrument_version_id uuid NOT NULL,
  grade integer NOT NULL CHECK (grade BETWEEN 1 AND 9),
  learning_area_id uuid NOT NULL,
  academic_year integer NOT NULL CHECK (academic_year BETWEEN 2000 AND 2100),
  eligibility_date date NOT NULL,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  snapshot_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  CONSTRAINT assessment_event_roster_event_fk FOREIGN KEY (
    tenant_organisation_id, organisation_id, event_id, instrument_version_id,
    grade, learning_area_id, academic_year
  ) REFERENCES public.assessment_events (
    tenant_organisation_id, organisation_id, id, instrument_version_id,
    grade, learning_area_id, academic_year
  ) ON DELETE RESTRICT,
  CONSTRAINT assessment_event_roster_enrolment_fk FOREIGN KEY (
    tenant_organisation_id, organisation_id, enrolment_id, grade, academic_year
  ) REFERENCES public.learner_enrolments (
    tenant_organisation_id, organisation_id, id, grade, academic_year
  ) ON DELETE RESTRICT,
  CONSTRAINT assessment_event_roster_learner_fk FOREIGN KEY (tenant_organisation_id, learner_id)
    REFERENCES public.learner_profiles (tenant_organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT assessment_event_roster_class_fk FOREIGN KEY (
    tenant_organisation_id, organisation_id, class_id, grade, academic_year
  ) REFERENCES public.classes (
    tenant_organisation_id, organisation_id, id, grade, academic_year
  ) ON DELETE RESTRICT,
  CONSTRAINT assessment_event_roster_scope_unique UNIQUE (
    tenant_organisation_id, organisation_id, event_id, enrolment_id
  ),
  CONSTRAINT assessment_event_roster_attempt_fk_key UNIQUE (
    tenant_organisation_id, organisation_id, event_id, enrolment_id,
    instrument_version_id, grade, learning_area_id, academic_year
  )
);
--> statement-breakpoint

ALTER TABLE public.assessment_attempts
  ADD CONSTRAINT assessment_attempts_eligible_roster_fk FOREIGN KEY (
    tenant_organisation_id, organisation_id, event_id, enrolment_id,
    instrument_version_id, grade, learning_area_id, academic_year
  ) REFERENCES public.assessment_event_eligible_enrolments (
    tenant_organisation_id, organisation_id, event_id, enrolment_id,
    instrument_version_id, grade, learning_area_id, academic_year
  ) ON DELETE RESTRICT;
--> statement-breakpoint

ALTER TABLE public.assessment_event_eligible_enrolments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.assessment_event_eligible_enrolments FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY assessment_event_roster_select ON public.assessment_event_eligible_enrolments
  FOR SELECT TO sentinel_learner_runtime
  USING (sentinel_private.can_access_assessment_data(organisation_id));
--> statement-breakpoint
GRANT SELECT ON TABLE public.assessment_event_eligible_enrolments TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.prevent_assessment_roster_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Assessment event eligibility snapshots are immutable'
    USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER assessment_event_roster_append_only
BEFORE UPDATE OR DELETE ON public.assessment_event_eligible_enrolments
FOR EACH ROW EXECUTE FUNCTION sentinel_private.prevent_assessment_roster_mutation();
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.prevent_assessment_roster_mutation() FROM PUBLIC;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.schedule_assessment_event(p_event_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_event public.assessment_events%ROWTYPE;
  v_eligible_count integer;
  v_eligibility_date date;
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT event_record.*
  INTO v_event
  FROM public.assessment_events AS event_record
  WHERE event_record.id = p_event_id
    AND sentinel_private.can_access_assessment_data(event_record.organisation_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment event not found or access denied' USING ERRCODE = 'P0002';
  END IF;

  IF v_event.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft assessment events can be scheduled' USING ERRCODE = '23514';
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

  v_eligibility_date := (v_event.starts_at AT TIME ZONE 'UTC')::date;

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

  UPDATE public.assessment_events
  SET status = 'scheduled', updated_at = pg_catalog.now()
  WHERE id = v_event.id;

  INSERT INTO public.audit_events (
    actor_user_id, organisation_id, action, resource_type, resource_id, metadata
  ) VALUES (
    v_actor_id, v_event.organisation_id, 'assessment.event_scheduled',
    'assessment_event', v_event.id::text,
    jsonb_build_object(
      'eligibleLearnerCount', v_eligible_count,
      'eligibilityDate', v_eligibility_date,
      'instrumentVersionId', v_event.instrument_version_id,
      'grade', v_event.grade,
      'academicYear', v_event.academic_year
    )
  );

  RETURN v_eligible_count;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.schedule_assessment_event(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.schedule_assessment_event(uuid) TO sentinel_learner_runtime;
