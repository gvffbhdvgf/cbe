-- Controlled teacher-to-class/learning-area allocation and class-scoped assessment participation.
-- Teacher permissions are event-specific; the organisation-wide assessment authority is unchanged.

CREATE TABLE public.teacher_class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  teacher_user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  class_id uuid NOT NULL,
  learning_area_id uuid NOT NULL REFERENCES public.curriculum_learning_areas(id) ON DELETE RESTRICT,
  grade integer NOT NULL CHECK (grade BETWEEN 1 AND 9),
  academic_year integer NOT NULL CHECK (academic_year BETWEEN 2000 AND 2100),
  starts_on date NOT NULL,
  ends_on date,
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','ended')),
  assigned_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_class_assignments_scope_check CHECK (tenant_organisation_id = organisation_id),
  CONSTRAINT teacher_class_assignments_period_check CHECK (ends_on IS NULL OR ends_on > starts_on),
  CONSTRAINT teacher_class_assignments_revocation_check CHECK ((status <> 'revoked') OR revoked_at IS NOT NULL),
  CONSTRAINT teacher_class_assignments_class_fk FOREIGN KEY
    (tenant_organisation_id, organisation_id, class_id, grade, academic_year)
    REFERENCES public.classes (tenant_organisation_id, organisation_id, id, grade, academic_year) ON DELETE RESTRICT,
  CONSTRAINT teacher_class_assignments_scope_id_unique UNIQUE (tenant_organisation_id, organisation_id, id)
);
--> statement-breakpoint
CREATE INDEX teacher_class_assignments_teacher_effective_idx
  ON public.teacher_class_assignments (tenant_organisation_id, teacher_user_id, starts_on, ends_on)
  WHERE status = 'active';
--> statement-breakpoint
CREATE INDEX teacher_class_assignments_class_area_idx
  ON public.teacher_class_assignments (tenant_organisation_id, organisation_id, class_id, learning_area_id, status);
--> statement-breakpoint

ALTER TABLE public.teacher_class_assignments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.teacher_class_assignments FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.can_read_teacher_assignment(p_organisation_id uuid, p_teacher_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
  SELECT sentinel_private.current_user_id() IS NOT NULL
    AND (
      sentinel_private.can_manage_learner_records(p_organisation_id)
      OR p_teacher_user_id = sentinel_private.current_user_id()
    )
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.can_read_teacher_assignment(uuid,uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.can_read_teacher_assignment(uuid,uuid) TO sentinel_learner_runtime;
--> statement-breakpoint
CREATE POLICY teacher_class_assignments_select
  ON public.teacher_class_assignments FOR SELECT TO sentinel_learner_runtime
  USING (sentinel_private.can_read_teacher_assignment(organisation_id, teacher_user_id));
--> statement-breakpoint
GRANT SELECT ON TABLE public.teacher_class_assignments TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.create_teacher_class_assignment(
  p_organisation_id uuid, p_teacher_user_id uuid, p_class_id uuid, p_learning_area_id uuid,
  p_starts_on date, p_ends_on date DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := sentinel_private.current_user_id();
  v_time_zone text;
  v_starts_at timestamptz;
  v_assignment_id uuid;
  v_class public.classes%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Teacher assignment management authority is required' USING ERRCODE = '42501';
  END IF;
  IF p_starts_on IS NULL OR (p_ends_on IS NOT NULL AND p_ends_on <= p_starts_on) THEN
    RAISE EXCEPTION 'A valid effective date range is required' USING ERRCODE = '22023';
  END IF;

  SELECT organisation.time_zone INTO v_time_zone
  FROM public.organisations AS organisation
  WHERE organisation.id = p_organisation_id AND organisation.status = 'active';
  IF v_time_zone IS NULL THEN RAISE EXCEPTION 'Organisation not found or inactive' USING ERRCODE = 'P0002'; END IF;
  v_starts_at := p_starts_on::timestamp AT TIME ZONE v_time_zone;

  SELECT class_record.* INTO v_class
  FROM public.classes AS class_record
  WHERE class_record.id = p_class_id
    AND class_record.tenant_organisation_id = p_organisation_id
    AND class_record.organisation_id = p_organisation_id
    AND class_record.status = 'active'
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active class not found in this organisation' USING ERRCODE = 'P0002'; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM neon_auth."user" AS auth_user
    INNER JOIN public.organisation_memberships AS membership
      ON membership.user_id = auth_user.id
    WHERE auth_user.id = p_teacher_user_id
      AND auth_user."emailVerified" = true
      AND COALESCE(auth_user.banned, false) = false
      AND membership.organisation_id = p_organisation_id
      AND membership.role = 'teacher'
      AND membership.status = 'active'
      AND membership.starts_at <= GREATEST(v_starts_at, pg_catalog.now())
      AND (membership.ends_at IS NULL OR membership.ends_at > GREATEST(v_starts_at, pg_catalog.now()))
  ) THEN
    RAISE EXCEPTION 'An active, verified teacher membership is required' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.curriculum_learning_areas WHERE id = p_learning_area_id) THEN
    RAISE EXCEPTION 'Curriculum learning area not found' USING ERRCODE = '23503';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_organisation_id::text || ':' || p_teacher_user_id::text || ':' || p_class_id::text || ':' || p_learning_area_id::text, 0
  ));
  IF EXISTS (
    SELECT 1 FROM public.teacher_class_assignments AS existing
    WHERE existing.tenant_organisation_id = p_organisation_id
      AND existing.organisation_id = p_organisation_id
      AND existing.teacher_user_id = p_teacher_user_id
      AND existing.class_id = p_class_id
      AND existing.learning_area_id = p_learning_area_id
      AND existing.status = 'active'
      AND daterange(existing.starts_on, existing.ends_on, '[)')
          && daterange(p_starts_on, p_ends_on, '[)')
  ) THEN
    RAISE EXCEPTION 'An overlapping active teacher assignment already exists' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.teacher_class_assignments (
    tenant_organisation_id, organisation_id, teacher_user_id, class_id, learning_area_id,
    grade, academic_year, starts_on, ends_on, assigned_by
  ) VALUES (
    p_organisation_id, p_organisation_id, p_teacher_user_id, p_class_id, p_learning_area_id,
    v_class.grade, v_class.academic_year, p_starts_on, p_ends_on, v_actor_id
  ) RETURNING id INTO v_assignment_id;

  INSERT INTO public.audit_events (actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, 'teacher.class_assignment_created', 'teacher_class_assignment', v_assignment_id::text,
    jsonb_build_object('teacherUserId', p_teacher_user_id, 'classId', p_class_id, 'learningAreaId', p_learning_area_id,
      'grade', v_class.grade, 'academicYear', v_class.academic_year, 'startsOn', p_starts_on, 'endsOn', p_ends_on));
  RETURN v_assignment_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.create_teacher_class_assignment(uuid,uuid,uuid,uuid,date,date) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.create_teacher_class_assignment(uuid,uuid,uuid,uuid,date,date) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.revoke_teacher_class_assignment(p_organisation_id uuid, p_assignment_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_actor_id uuid := sentinel_private.current_user_id(); v_now timestamptz := pg_catalog.now(); v_assignment public.teacher_class_assignments%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Teacher assignment management authority is required' USING ERRCODE = '42501';
  END IF;
  SELECT assignment.* INTO v_assignment
  FROM public.teacher_class_assignments assignment
  WHERE assignment.id = p_assignment_id AND assignment.organisation_id = p_organisation_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Teacher assignment not found' USING ERRCODE = 'P0002'; END IF;
  IF v_assignment.status <> 'active' THEN RAISE EXCEPTION 'Only active teacher assignments can be revoked' USING ERRCODE = '23514'; END IF;
  UPDATE public.teacher_class_assignments
  SET status = 'revoked', revoked_at = v_now, updated_at = v_now
  WHERE id = p_assignment_id;
  INSERT INTO public.audit_events (actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, 'teacher.class_assignment_revoked', 'teacher_class_assignment', p_assignment_id::text,
    jsonb_build_object('teacherUserId', v_assignment.teacher_user_id, 'classId', v_assignment.class_id,
      'learningAreaId', v_assignment.learning_area_id, 'revokedAt', v_now));
  RETURN v_now;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.revoke_teacher_class_assignment(uuid,uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.revoke_teacher_class_assignment(uuid,uuid) TO sentinel_learner_runtime;
--> statement-breakpoint

ALTER TABLE public.assessment_events ADD COLUMN class_id uuid;
--> statement-breakpoint
ALTER TABLE public.assessment_events ADD CONSTRAINT assessment_events_class_scope_fk
  FOREIGN KEY (tenant_organisation_id, organisation_id, class_id, grade, academic_year)
  REFERENCES public.classes (tenant_organisation_id, organisation_id, id, grade, academic_year) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX assessment_events_class_scope_idx
  ON public.assessment_events (tenant_organisation_id, organisation_id, class_id, starts_at)
  WHERE class_id IS NOT NULL;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.can_read_teacher_class(p_organisation_id uuid, p_class_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teacher_class_assignments assignment
    INNER JOIN public.organisations organisation ON organisation.id = assignment.organisation_id
    INNER JOIN neon_auth."user" auth_user ON auth_user.id = assignment.teacher_user_id
    INNER JOIN public.organisation_memberships membership
      ON membership.organisation_id = assignment.organisation_id
     AND membership.user_id = assignment.teacher_user_id
    WHERE assignment.organisation_id = p_organisation_id
      AND assignment.class_id = p_class_id
      AND assignment.teacher_user_id = sentinel_private.current_user_id()
      AND assignment.status = 'active'
      AND assignment.starts_on <= (pg_catalog.now() AT TIME ZONE organisation.time_zone)::date
      AND (assignment.ends_on IS NULL OR assignment.ends_on > (pg_catalog.now() AT TIME ZONE organisation.time_zone)::date)
      AND auth_user."emailVerified" = true AND COALESCE(auth_user.banned, false) = false
      AND membership.role = 'teacher' AND membership.status = 'active'
      AND membership.starts_at <= pg_catalog.now()
      AND (membership.ends_at IS NULL OR membership.ends_at > pg_catalog.now())
      AND organisation.status = 'active'
  )
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.can_read_teacher_class(uuid,uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.can_read_teacher_class(uuid,uuid) TO sentinel_learner_runtime;
--> statement-breakpoint
DROP POLICY classes_tenant_select ON public.classes;
--> statement-breakpoint
CREATE POLICY classes_tenant_select ON public.classes FOR SELECT TO sentinel_learner_runtime
  USING (
    (organisation_id = tenant_organisation_id AND sentinel_private.can_manage_learner_records(tenant_organisation_id))
    OR sentinel_private.can_read_teacher_class(organisation_id, id)
  );
--> statement-breakpoint

CREATE FUNCTION sentinel_private.can_teach_assessment_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.assessment_events event_record
    INNER JOIN public.teacher_class_assignments assignment
      ON assignment.tenant_organisation_id = event_record.tenant_organisation_id
     AND assignment.organisation_id = event_record.organisation_id
     AND assignment.class_id = event_record.class_id
     AND assignment.learning_area_id = event_record.learning_area_id
    INNER JOIN public.organisation_memberships membership
      ON membership.organisation_id = event_record.organisation_id
     AND membership.user_id = assignment.teacher_user_id
    INNER JOIN neon_auth."user" auth_user ON auth_user.id = assignment.teacher_user_id
    INNER JOIN public.organisations organisation ON organisation.id = event_record.organisation_id
    WHERE event_record.id = p_event_id
      AND event_record.class_id IS NOT NULL
      AND event_record.status IN ('scheduled','open','closed','marking','moderated','approved','published','corrected')
      AND assignment.teacher_user_id = sentinel_private.current_user_id()
      AND assignment.status IN ('active','revoked')
      AND assignment.starts_on <= (event_record.starts_at AT TIME ZONE event_record.time_zone)::date
      AND (assignment.ends_on IS NULL OR assignment.ends_on > (event_record.starts_at AT TIME ZONE event_record.time_zone)::date)
      AND (assignment.status <> 'revoked' OR assignment.revoked_at > event_record.starts_at)
      AND auth_user."emailVerified" = true AND COALESCE(auth_user.banned, false) = false
      AND membership.role = 'teacher'
      AND membership.status IN ('active','revoked')
      AND membership.starts_at <= event_record.starts_at
      AND (membership.ends_at IS NULL OR membership.ends_at > event_record.starts_at)
      AND organisation.status = 'active'
  )
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.can_teach_assessment_event(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.can_teach_assessment_event(uuid) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.can_access_assessment_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assessment_events event_record
    WHERE event_record.id = p_event_id
      AND sentinel_private.can_access_assessment_data(event_record.organisation_id)
  ) OR sentinel_private.can_teach_assessment_event(p_event_id)
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.can_access_assessment_event(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.can_access_assessment_event(uuid) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.can_access_assessment_instrument(p_instrument_version_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assessment_events event_record
    WHERE event_record.instrument_version_id = p_instrument_version_id
      AND sentinel_private.can_access_assessment_event(event_record.id)
  )
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.can_access_assessment_instrument(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.can_access_assessment_instrument(uuid) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.can_access_assessment_programme(p_programme_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assessment_events event_record
    WHERE event_record.programme_id = p_programme_id
      AND sentinel_private.can_access_assessment_event(event_record.id)
  )
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.can_access_assessment_programme(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.can_access_assessment_programme(uuid) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.can_access_assessment_attempt(p_attempt_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assessment_attempts attempt
    WHERE attempt.id = p_attempt_id
      AND sentinel_private.can_access_assessment_event(attempt.event_id)
  )
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.can_access_assessment_attempt(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.can_access_assessment_attempt(uuid) TO sentinel_learner_runtime;
--> statement-breakpoint

DROP POLICY assessment_events_assessment_select ON public.assessment_events;
--> statement-breakpoint
CREATE POLICY assessment_events_assessment_select ON public.assessment_events FOR SELECT TO sentinel_learner_runtime
  USING (sentinel_private.can_access_assessment_data(organisation_id) OR sentinel_private.can_teach_assessment_event(id));
--> statement-breakpoint
DROP POLICY assessment_event_roster_select ON public.assessment_event_eligible_enrolments;
--> statement-breakpoint
CREATE POLICY assessment_event_roster_select ON public.assessment_event_eligible_enrolments FOR SELECT TO sentinel_learner_runtime
  USING (sentinel_private.can_access_assessment_event(event_id));
--> statement-breakpoint
DROP POLICY assessment_attempts_assessment_select ON public.assessment_attempts;
--> statement-breakpoint
CREATE POLICY assessment_attempts_assessment_select ON public.assessment_attempts FOR SELECT TO sentinel_learner_runtime
  USING (sentinel_private.can_access_assessment_event(event_id));
--> statement-breakpoint
DROP POLICY assessment_responses_assessment_select ON public.assessment_responses;
--> statement-breakpoint
CREATE POLICY assessment_responses_assessment_select ON public.assessment_responses FOR SELECT TO sentinel_learner_runtime
  USING (sentinel_private.can_access_assessment_attempt(attempt_id));
--> statement-breakpoint
DROP POLICY assessment_instrument_versions_assessment_select ON public.assessment_instrument_versions;
--> statement-breakpoint
CREATE POLICY assessment_instrument_versions_assessment_select ON public.assessment_instrument_versions FOR SELECT TO sentinel_learner_runtime
  USING (sentinel_private.can_access_assessment_data(organisation_id) OR sentinel_private.can_access_assessment_instrument(id));
--> statement-breakpoint
DROP POLICY assessment_programmes_assessment_select ON public.assessment_programmes;
--> statement-breakpoint
CREATE POLICY assessment_programmes_assessment_select ON public.assessment_programmes FOR SELECT TO sentinel_learner_runtime
  USING (sentinel_private.can_access_assessment_data(organisation_id) OR sentinel_private.can_access_assessment_programme(id));
--> statement-breakpoint
DROP POLICY assessment_tasks_assessment_select ON public.assessment_tasks;
--> statement-breakpoint
CREATE POLICY assessment_tasks_assessment_select ON public.assessment_tasks FOR SELECT TO sentinel_learner_runtime
  USING (sentinel_private.can_access_assessment_data(organisation_id) OR sentinel_private.can_access_assessment_instrument(instrument_version_id));
--> statement-breakpoint

CREATE FUNCTION sentinel_private.create_class_assessment_event_local(
  p_organisation_id uuid, p_programme_id uuid, p_instrument_version_id uuid, p_class_id uuid,
  p_title text, p_starts_at_local timestamp without time zone, p_ends_at_local timestamp without time zone,
  p_academic_year integer, p_moderation_required boolean DEFAULT false
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_instrument public.assessment_instrument_versions%ROWTYPE; v_class public.classes%ROWTYPE; v_event_id uuid; v_actor_id uuid := sentinel_private.current_user_id();
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_access_assessment_data(p_organisation_id) THEN
    RAISE EXCEPTION 'Assessment authoring authority is required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_instrument FROM public.assessment_instrument_versions
  WHERE id = p_instrument_version_id AND organisation_id = p_organisation_id AND status = 'approved';
  IF NOT FOUND THEN RAISE EXCEPTION 'An approved instrument version is required' USING ERRCODE = '23514'; END IF;
  SELECT * INTO v_class FROM public.classes
  WHERE id = p_class_id AND organisation_id = p_organisation_id AND tenant_organisation_id = p_organisation_id AND status = 'active'
  FOR SHARE;
  IF NOT FOUND OR v_class.grade <> v_instrument.grade OR v_class.academic_year <> p_academic_year THEN
    RAISE EXCEPTION 'Target class must be active and match the instrument grade and academic year' USING ERRCODE = '23514';
  END IF;
  v_event_id := sentinel_private.create_assessment_event_local(
    p_organisation_id,p_programme_id,p_instrument_version_id,p_title,
    p_starts_at_local,p_ends_at_local,p_academic_year,p_moderation_required
  );
  UPDATE public.assessment_events SET class_id = p_class_id WHERE id = v_event_id;
  INSERT INTO public.audit_events (actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id,p_organisation_id,'assessment.event_class_targeted','assessment_event',v_event_id::text,
    jsonb_build_object('classId',p_class_id,'grade',v_class.grade,'academicYear',v_class.academic_year));
  RETURN v_event_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.create_class_assessment_event_local(uuid,uuid,uuid,uuid,text,timestamp without time zone,timestamp without time zone,integer,boolean) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.create_class_assessment_event_local(uuid,uuid,uuid,uuid,text,timestamp without time zone,timestamp without time zone,integer,boolean) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION sentinel_private.schedule_assessment_event(p_event_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_actor_id uuid; v_event public.assessment_events%ROWTYPE; v_eligible_count integer; v_eligibility_date date;
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  SELECT event_record.* INTO v_event FROM public.assessment_events event_record
  WHERE event_record.id = p_event_id AND sentinel_private.can_access_assessment_data(event_record.organisation_id) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assessment event not found or access denied' USING ERRCODE = 'P0002'; END IF;
  IF v_event.status <> 'draft' THEN RAISE EXCEPTION 'Only draft assessment events can be scheduled' USING ERRCODE = '23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assessment_instrument_versions instrument
    WHERE instrument.id=v_event.instrument_version_id AND instrument.tenant_organisation_id=v_event.tenant_organisation_id
      AND instrument.organisation_id=v_event.organisation_id AND instrument.grade=v_event.grade
      AND instrument.learning_area_id=v_event.learning_area_id AND instrument.status='approved') THEN
    RAISE EXCEPTION 'Assessment event requires an approved instrument version' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assessment_programmes programme
    WHERE programme.id=v_event.programme_id AND programme.tenant_organisation_id=v_event.tenant_organisation_id
      AND programme.organisation_id=v_event.organisation_id AND programme.status='active') THEN
    RAISE EXCEPTION 'Assessment event requires an active assessment programme' USING ERRCODE = '23514';
  END IF;
  IF v_event.class_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.classes class_record
    WHERE class_record.id=v_event.class_id AND class_record.organisation_id=v_event.organisation_id
      AND class_record.status='active' AND class_record.grade=v_event.grade
      AND class_record.academic_year=v_event.academic_year) THEN
    RAISE EXCEPTION 'Target class is no longer active or does not match the event' USING ERRCODE = '23514';
  END IF;
  v_eligibility_date := (v_event.starts_at AT TIME ZONE v_event.time_zone)::date;
  INSERT INTO public.assessment_event_eligible_enrolments (
    tenant_organisation_id,organisation_id,event_id,enrolment_id,learner_id,class_id,
    instrument_version_id,grade,learning_area_id,academic_year,eligibility_date,snapshot_by
  )
  SELECT v_event.tenant_organisation_id,v_event.organisation_id,v_event.id,enrolment.id,enrolment.learner_id,
    enrolment.class_id,v_event.instrument_version_id,v_event.grade,v_event.learning_area_id,
    v_event.academic_year,v_eligibility_date,v_actor_id
  FROM public.learner_enrolments enrolment
  INNER JOIN public.learner_profiles learner ON learner.id=enrolment.learner_id
    AND learner.tenant_organisation_id=enrolment.tenant_organisation_id
  WHERE enrolment.tenant_organisation_id=v_event.tenant_organisation_id
    AND enrolment.organisation_id=v_event.organisation_id
    AND enrolment.grade=v_event.grade AND enrolment.academic_year=v_event.academic_year
    AND enrolment.status='active' AND learner.status='active'
    AND enrolment.starts_at<=v_eligibility_date
    AND (enrolment.ends_at IS NULL OR enrolment.ends_at>v_eligibility_date)
    AND (v_event.class_id IS NULL OR enrolment.class_id=v_event.class_id);
  GET DIAGNOSTICS v_eligible_count = ROW_COUNT;
  IF v_eligible_count=0 THEN RAISE EXCEPTION 'Cannot schedule an assessment event with no eligible learner enrolments' USING ERRCODE = '23514'; END IF;
  UPDATE public.assessment_events SET status='scheduled',updated_at=pg_catalog.now() WHERE id=v_event.id;
  INSERT INTO public.audit_events(actor_user_id,organisation_id,action,resource_type,resource_id,metadata)
  VALUES(v_actor_id,v_event.organisation_id,'assessment.event_scheduled','assessment_event',v_event.id::text,
    jsonb_build_object('eligibleLearnerCount',v_eligible_count,'eligibilityDate',v_eligibility_date,
      'timeZone',v_event.time_zone,'classId',v_event.class_id,'instrumentVersionId',v_event.instrument_version_id,
      'grade',v_event.grade,'academicYear',v_event.academic_year));
  RETURN v_eligible_count;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.schedule_assessment_event(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.schedule_assessment_event(uuid) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION sentinel_private.list_assessment_eligible_enrolments(p_event_id uuid)
RETURNS TABLE(enrolment_id uuid, learner_id uuid, learner_reference text, class_id uuid, attempt_id uuid, attempt_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
  SELECT roster.enrolment_id,roster.learner_id,learner.learner_reference,roster.class_id,attempt.id,attempt.status
  FROM public.assessment_event_eligible_enrolments roster
  INNER JOIN public.learner_profiles learner ON learner.id=roster.learner_id
    AND learner.tenant_organisation_id=roster.tenant_organisation_id
  LEFT JOIN public.assessment_attempts attempt ON attempt.tenant_organisation_id=roster.tenant_organisation_id
    AND attempt.organisation_id=roster.organisation_id AND attempt.event_id=roster.event_id
    AND attempt.enrolment_id=roster.enrolment_id
  WHERE roster.event_id=p_event_id AND sentinel_private.can_access_assessment_event(p_event_id)
  ORDER BY learner.learner_reference,roster.enrolment_id
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.list_assessment_eligible_enrolments(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.list_assessment_eligible_enrolments(uuid) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION sentinel_private.create_assessment_attempt(p_event_id uuid,p_enrolment_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_actor_id uuid; v_event public.assessment_events%ROWTYPE; v_attempt_id uuid; v_now timestamptz := pg_catalog.now();
BEGIN
  v_actor_id:=sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT event_record.* INTO v_event FROM public.assessment_events event_record
  WHERE event_record.id=p_event_id AND sentinel_private.can_access_assessment_event(event_record.id) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assessment event not found or access denied' USING ERRCODE='P0002'; END IF;
  IF v_event.status<>'open' THEN RAISE EXCEPTION 'Learner attempts can only be created for open assessment events' USING ERRCODE='23514'; END IF;
  IF v_now<v_event.starts_at OR v_now>=v_event.ends_at THEN RAISE EXCEPTION 'Assessment event is outside its permitted attempt window' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assessment_event_eligible_enrolments roster
    WHERE roster.tenant_organisation_id=v_event.tenant_organisation_id AND roster.organisation_id=v_event.organisation_id
      AND roster.event_id=v_event.id AND roster.enrolment_id=p_enrolment_id
      AND roster.instrument_version_id=v_event.instrument_version_id AND roster.grade=v_event.grade
      AND roster.learning_area_id=v_event.learning_area_id AND roster.academic_year=v_event.academic_year) THEN
    RAISE EXCEPTION 'Learner enrolment is not on this assessment event eligible roster' USING ERRCODE='23514';
  END IF;
  INSERT INTO public.assessment_attempts(tenant_organisation_id,organisation_id,event_id,enrolment_id,
    instrument_version_id,grade,learning_area_id,academic_year,attempt_number,status,captured_by)
  VALUES(v_event.tenant_organisation_id,v_event.organisation_id,v_event.id,p_enrolment_id,
    v_event.instrument_version_id,v_event.grade,v_event.learning_area_id,v_event.academic_year,1,'in_progress',v_actor_id)
  RETURNING id INTO v_attempt_id;
  INSERT INTO public.audit_events(actor_user_id,organisation_id,action,resource_type,resource_id,metadata)
  VALUES(v_actor_id,v_event.organisation_id,'assessment.attempt_created','assessment_attempt',v_attempt_id::text,
    jsonb_build_object('eventId',v_event.id,'enrolmentId',p_enrolment_id,'instrumentVersionId',v_event.instrument_version_id));
  RETURN v_attempt_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.create_assessment_attempt(uuid,uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.create_assessment_attempt(uuid,uuid) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION sentinel_private.capture_assessment_response(p_attempt_id uuid,p_task_id uuid,p_response_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_actor_id uuid; v_attempt public.assessment_attempts%ROWTYPE; v_event public.assessment_events%ROWTYPE; v_response_id uuid; v_now timestamptz:=pg_catalog.now();
BEGIN
  v_actor_id:=sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_response_payload IS NULL OR pg_catalog.jsonb_typeof(p_response_payload)<>'object' THEN
    RAISE EXCEPTION 'Response payload must be a JSON object' USING ERRCODE='22023';
  END IF;
  SELECT attempt.* INTO v_attempt FROM public.assessment_attempts attempt
  WHERE attempt.id=p_attempt_id AND sentinel_private.can_access_assessment_event(attempt.event_id) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assessment attempt not found or access denied' USING ERRCODE='P0002'; END IF;
  SELECT event_record.* INTO v_event FROM public.assessment_events event_record
  WHERE event_record.id=v_attempt.event_id AND event_record.organisation_id=v_attempt.organisation_id FOR UPDATE;
  IF NOT FOUND OR v_event.status<>'open' THEN RAISE EXCEPTION 'Responses can only be captured while the assessment event is open' USING ERRCODE='23514'; END IF;
  IF v_now<v_event.starts_at OR v_now>=v_event.ends_at THEN RAISE EXCEPTION 'Assessment event is outside its permitted response window' USING ERRCODE='23514'; END IF;
  IF v_attempt.status<>'in_progress' THEN RAISE EXCEPTION 'Responses can only be captured for an in-progress attempt' USING ERRCODE='23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assessment_tasks task WHERE task.id=p_task_id
    AND task.tenant_organisation_id=v_attempt.tenant_organisation_id
    AND task.organisation_id=v_attempt.organisation_id AND task.instrument_version_id=v_attempt.instrument_version_id) THEN
    RAISE EXCEPTION 'Task does not belong to this assessment instrument version' USING ERRCODE='23503';
  END IF;
  INSERT INTO public.assessment_responses(tenant_organisation_id,organisation_id,attempt_id,task_id,
    instrument_version_id,response_payload,captured_by,captured_at)
  VALUES(v_attempt.tenant_organisation_id,v_attempt.organisation_id,v_attempt.id,p_task_id,
    v_attempt.instrument_version_id,p_response_payload,v_actor_id,v_now) RETURNING id INTO v_response_id;
  INSERT INTO public.audit_events(actor_user_id,organisation_id,action,resource_type,resource_id,metadata)
  VALUES(v_actor_id,v_attempt.organisation_id,'assessment.response_captured','assessment_response',v_response_id::text,
    jsonb_build_object('attemptId',v_attempt.id,'taskId',p_task_id));
  RETURN v_response_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.capture_assessment_response(uuid,uuid,jsonb) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.capture_assessment_response(uuid,uuid,jsonb) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION sentinel_private.submit_assessment_attempt(p_attempt_id uuid)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_actor_id uuid; v_attempt public.assessment_attempts%ROWTYPE; v_event public.assessment_events%ROWTYPE; v_required_count integer; v_now timestamptz:=pg_catalog.now();
BEGIN
  v_actor_id:=sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT attempt.* INTO v_attempt FROM public.assessment_attempts attempt
  WHERE attempt.id=p_attempt_id AND sentinel_private.can_access_assessment_event(attempt.event_id) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assessment attempt not found or access denied' USING ERRCODE='P0002'; END IF;
  SELECT event_record.* INTO v_event FROM public.assessment_events event_record
  WHERE event_record.id=v_attempt.event_id AND event_record.organisation_id=v_attempt.organisation_id FOR UPDATE;
  IF NOT FOUND OR v_event.status<>'open' THEN RAISE EXCEPTION 'An attempt can only be submitted while its assessment event is open' USING ERRCODE='23514'; END IF;
  IF v_now<v_event.starts_at OR v_now>=v_event.ends_at THEN RAISE EXCEPTION 'Assessment event is outside its permitted submission window' USING ERRCODE='23514'; END IF;
  IF v_attempt.status<>'in_progress' THEN RAISE EXCEPTION 'Only an in-progress assessment attempt can be submitted' USING ERRCODE='23514'; END IF;
  SELECT count(*) INTO v_required_count FROM public.assessment_tasks task
  WHERE task.tenant_organisation_id=v_attempt.tenant_organisation_id AND task.organisation_id=v_attempt.organisation_id
    AND task.instrument_version_id=v_attempt.instrument_version_id AND task.required=true;
  IF v_required_count=0 THEN RAISE EXCEPTION 'Assessment instrument has no required tasks and cannot be submitted' USING ERRCODE='23514'; END IF;
  IF EXISTS (SELECT 1 FROM public.assessment_tasks task LEFT JOIN public.assessment_responses response
    ON response.tenant_organisation_id=task.tenant_organisation_id AND response.organisation_id=task.organisation_id
      AND response.task_id=task.id AND response.attempt_id=v_attempt.id
    WHERE task.tenant_organisation_id=v_attempt.tenant_organisation_id AND task.organisation_id=v_attempt.organisation_id
      AND task.instrument_version_id=v_attempt.instrument_version_id AND task.required=true AND response.id IS NULL) THEN
    RAISE EXCEPTION 'Every required assessment task must have a captured response before submission' USING ERRCODE='23514';
  END IF;
  UPDATE public.assessment_attempts SET status='submitted',submitted_at=v_now,updated_at=v_now WHERE id=v_attempt.id;
  INSERT INTO public.audit_events(actor_user_id,organisation_id,action,resource_type,resource_id,metadata)
  VALUES(v_actor_id,v_attempt.organisation_id,'assessment.attempt_submitted','assessment_attempt',v_attempt.id::text,
    jsonb_build_object('eventId',v_event.id,'enrolmentId',v_attempt.enrolment_id,'submittedAt',v_now,'requiredTaskCount',v_required_count));
  RETURN v_now;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.submit_assessment_attempt(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.submit_assessment_attempt(uuid) TO sentinel_learner_runtime;
