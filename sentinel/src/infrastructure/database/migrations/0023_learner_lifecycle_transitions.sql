-- Controlled class capacity, learner class history, reassignment, withdrawal and approved progression.

ALTER TABLE public.classes ADD COLUMN capacity integer;
--> statement-breakpoint
ALTER TABLE public.learner_enrolments ADD COLUMN withdrawal_reason text;
--> statement-breakpoint
ALTER TABLE public.learner_enrolments ADD CONSTRAINT learner_enrolments_withdrawal_reason_check CHECK (withdrawal_reason IS NULL OR length(btrim(withdrawal_reason)) BETWEEN 10 AND 500);
--> statement-breakpoint
ALTER TABLE public.classes ADD CONSTRAINT classes_capacity_check CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 500);
--> statement-breakpoint
CREATE INDEX learner_enrolments_class_capacity_idx
  ON public.learner_enrolments (tenant_organisation_id, organisation_id, class_id, status)
  WHERE class_id IS NOT NULL AND status = 'active';
--> statement-breakpoint

ALTER TABLE public.learner_enrolments ADD CONSTRAINT learner_enrolments_tenant_org_id_learner_unique
  UNIQUE (tenant_organisation_id, organisation_id, id, learner_id);
--> statement-breakpoint
CREATE TABLE public.learner_class_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  enrolment_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  class_id uuid NOT NULL,
  grade integer NOT NULL CHECK (grade BETWEEN 1 AND 9),
  academic_year integer NOT NULL CHECK (academic_year BETWEEN 2000 AND 2100),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) BETWEEN 10 AND 500),
  created_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learner_class_placements_scope_check CHECK (tenant_organisation_id = organisation_id),
  CONSTRAINT learner_class_placements_enrolment_fk FOREIGN KEY (tenant_organisation_id, organisation_id, enrolment_id, learner_id)
    REFERENCES public.learner_enrolments (tenant_organisation_id, organisation_id, id, learner_id) ON DELETE RESTRICT,
  CONSTRAINT learner_class_placements_period_check CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT learner_class_placements_class_fk FOREIGN KEY
    (tenant_organisation_id, organisation_id, class_id, grade, academic_year)
    REFERENCES public.classes (tenant_organisation_id, organisation_id, id, grade, academic_year) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE UNIQUE INDEX learner_class_placements_one_active_idx
  ON public.learner_class_placements (tenant_organisation_id, enrolment_id) WHERE status = 'active';
--> statement-breakpoint
CREATE INDEX learner_class_placements_history_idx
  ON public.learner_class_placements (tenant_organisation_id, learner_id, starts_at DESC);
--> statement-breakpoint
INSERT INTO public.learner_class_placements (
  tenant_organisation_id, organisation_id, enrolment_id, learner_id, class_id, grade, academic_year,
  starts_at, ends_at, status, created_by
)
SELECT enrolment.tenant_organisation_id, enrolment.organisation_id, enrolment.id, enrolment.learner_id,
  enrolment.class_id, enrolment.grade, enrolment.academic_year,
  enrolment.starts_at::timestamp AT TIME ZONE organisation.time_zone,
  CASE WHEN enrolment.ends_at IS NULL THEN NULL ELSE enrolment.ends_at::timestamp AT TIME ZONE organisation.time_zone END,
  CASE WHEN enrolment.status = 'active' THEN 'active' ELSE 'ended' END, enrolment.created_by
FROM public.learner_enrolments enrolment
INNER JOIN public.organisations organisation ON organisation.id = enrolment.organisation_id
WHERE enrolment.class_id IS NOT NULL;
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
    COALESCE(v_event.class_id,enrolment.class_id),v_event.instrument_version_id,v_event.grade,v_event.learning_area_id,
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
    AND (
      v_event.class_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.learner_class_placements placement
        WHERE placement.tenant_organisation_id=enrolment.tenant_organisation_id
          AND placement.organisation_id=enrolment.organisation_id
          AND placement.enrolment_id=enrolment.id
          AND placement.class_id=v_event.class_id
          AND placement.starts_at<=v_event.starts_at
          AND (placement.ends_at IS NULL OR placement.ends_at>v_event.starts_at)
      )
    );
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
ALTER TABLE public.learner_class_placements ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.learner_class_placements FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY learner_class_placements_select ON public.learner_class_placements
  FOR SELECT TO sentinel_learner_runtime
  USING (sentinel_private.can_manage_learner_records(organisation_id));
--> statement-breakpoint
GRANT SELECT ON TABLE public.learner_class_placements TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.assert_class_capacity_available(p_class_id uuid, p_exclude_enrolment_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_class public.classes%ROWTYPE; v_occupancy integer;
BEGIN
  SELECT class_record.* INTO v_class FROM public.classes class_record
  WHERE class_record.id=p_class_id AND class_record.status='active'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active target class not found' USING ERRCODE='P0002'; END IF;
  IF v_class.capacity IS NULL THEN RETURN; END IF;
  SELECT count(*)::integer INTO v_occupancy FROM public.learner_enrolments enrolment
  WHERE enrolment.tenant_organisation_id=v_class.tenant_organisation_id
    AND enrolment.organisation_id=v_class.organisation_id
    AND enrolment.class_id=v_class.id AND enrolment.status='active'
    AND (p_exclude_enrolment_id IS NULL OR enrolment.id<>p_exclude_enrolment_id);
  IF v_occupancy >= v_class.capacity THEN
    RAISE EXCEPTION 'Target class has reached its capacity of % learners',v_class.capacity USING ERRCODE='23514';
  END IF;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.assert_class_capacity_available(uuid,uuid) FROM PUBLIC;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.set_class_capacity(p_organisation_id uuid,p_class_id uuid,p_capacity integer)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_actor_id uuid:=sentinel_private.current_user_id(); v_class public.classes%ROWTYPE; v_occupancy integer;
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Class management authority is required' USING ERRCODE='42501';
  END IF;
  IF p_capacity IS NOT NULL AND p_capacity NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Class capacity must be between 1 and 500, or unlimited' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_class FROM public.classes
  WHERE id=p_class_id AND organisation_id=p_organisation_id AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active class not found' USING ERRCODE='P0002'; END IF;
  SELECT count(*)::integer INTO v_occupancy FROM public.learner_enrolments
  WHERE organisation_id=p_organisation_id AND class_id=p_class_id AND status='active';
  IF p_capacity IS NOT NULL AND p_capacity<v_occupancy THEN
    RAISE EXCEPTION 'Capacity cannot be lower than current occupancy of % learners',v_occupancy USING ERRCODE='23514';
  END IF;
  UPDATE public.classes SET capacity=p_capacity,updated_at=pg_catalog.now() WHERE id=p_class_id;
  INSERT INTO public.audit_events(actor_user_id,organisation_id,action,resource_type,resource_id,metadata)
  VALUES(v_actor_id,p_organisation_id,'class.capacity_changed','class',p_class_id::text,
    jsonb_build_object('previousCapacity',v_class.capacity,'capacity',p_capacity,'currentOccupancy',v_occupancy));
  RETURN p_capacity;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.set_class_capacity(uuid,uuid,integer) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.set_class_capacity(uuid,uuid,integer) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION sentinel_private.assign_learner_to_class(p_enrolment_id uuid,p_class_id uuid,p_effective_at date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_actor_id uuid:=sentinel_private.current_user_id(); v_enrolment public.learner_enrolments%ROWTYPE; v_class public.classes%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  SELECT enrolment.* INTO v_enrolment FROM public.learner_enrolments enrolment
  WHERE enrolment.id=p_enrolment_id AND sentinel_private.can_manage_learner_records(enrolment.tenant_organisation_id) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Enrolment not found' USING ERRCODE='P0002'; END IF;
  IF v_enrolment.status<>'active' THEN RAISE EXCEPTION 'Only active enrolments can be placed into a class' USING ERRCODE='23514'; END IF;
  IF p_effective_at<v_enrolment.starts_at OR (v_enrolment.ends_at IS NOT NULL AND p_effective_at>=v_enrolment.ends_at) THEN
    RAISE EXCEPTION 'Placement date must fall within the active enrolment period' USING ERRCODE='23514';
  END IF;
  IF v_enrolment.class_id IS NOT NULL THEN
    IF v_enrolment.class_id=p_class_id THEN RETURN v_enrolment.id; END IF;
    RAISE EXCEPTION 'This enrolment already has a class; use the audited reassignment workflow' USING ERRCODE='23514';
  END IF;
  SELECT class_record.* INTO v_class FROM public.classes class_record
  WHERE class_record.id=p_class_id AND class_record.tenant_organisation_id=v_enrolment.tenant_organisation_id
    AND class_record.organisation_id=v_enrolment.organisation_id AND class_record.grade=v_enrolment.grade
    AND class_record.academic_year=v_enrolment.academic_year AND class_record.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Selected class does not match the active enrolment grade, academic year and organisation' USING ERRCODE='23514'; END IF;
  PERFORM sentinel_private.assert_class_capacity_available(p_class_id,NULL);
  UPDATE public.learner_enrolments SET class_id=p_class_id,updated_at=pg_catalog.now() WHERE id=v_enrolment.id;
  INSERT INTO public.learner_class_placements(tenant_organisation_id,organisation_id,enrolment_id,learner_id,class_id,grade,academic_year,starts_at,created_by)
  VALUES(v_enrolment.tenant_organisation_id,v_enrolment.organisation_id,v_enrolment.id,v_enrolment.learner_id,p_class_id,
    v_enrolment.grade,v_enrolment.academic_year,p_effective_at::timestamp AT TIME ZONE (SELECT time_zone FROM public.organisations WHERE id=v_enrolment.organisation_id),v_actor_id);
  INSERT INTO public.learner_progression_events(tenant_organisation_id,learner_id,event_type,from_grade,to_grade,effective_at,actor_user_id,reason_code)
  VALUES(v_enrolment.tenant_organisation_id,v_enrolment.learner_id,'class_assigned',v_enrolment.grade,v_enrolment.grade,p_effective_at,v_actor_id,'class_assignment');
  INSERT INTO public.audit_events(actor_user_id,organisation_id,action,resource_type,resource_id,metadata)
  VALUES(v_actor_id,v_enrolment.organisation_id,'learner.class_assigned','learner_enrolment',v_enrolment.id::text,
    jsonb_build_object('classId',v_class.id,'classCode',v_class.class_code,'grade',v_class.grade,'academicYear',v_class.academic_year,'effectiveAt',p_effective_at));
  RETURN v_enrolment.id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.assign_learner_to_class(uuid,uuid,date) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.assign_learner_to_class(uuid,uuid,date) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.reassign_learner_to_class(p_organisation_id uuid,p_enrolment_id uuid,p_class_id uuid,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_actor_id uuid:=sentinel_private.current_user_id(); v_enrolment public.learner_enrolments%ROWTYPE;
  v_target public.classes%ROWTYPE; v_current public.learner_class_placements%ROWTYPE; v_reason text:=pg_catalog.btrim(p_reason);
  v_now timestamptz:=pg_catalog.now();
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Learner class reassignment authority is required' USING ERRCODE='42501';
  END IF;
  IF v_reason IS NULL OR pg_catalog.length(v_reason)<10 OR pg_catalog.length(v_reason)>500 THEN
    RAISE EXCEPTION 'A reason of 10 to 500 characters is required for class reassignment' USING ERRCODE='22023';
  END IF;
  SELECT enrolment.* INTO v_enrolment FROM public.learner_enrolments enrolment
  WHERE enrolment.id=p_enrolment_id AND enrolment.organisation_id=p_organisation_id
    AND sentinel_private.can_manage_learner_records(enrolment.tenant_organisation_id) FOR UPDATE;
  IF NOT FOUND OR v_enrolment.status<>'active' OR v_enrolment.class_id IS NULL THEN
    RAISE EXCEPTION 'Only an actively enrolled, already placed learner can be reassigned' USING ERRCODE='23514';
  END IF;
  IF v_enrolment.class_id=p_class_id THEN RAISE EXCEPTION 'Select a different target class' USING ERRCODE='22023'; END IF;
  SELECT class_record.* INTO v_target FROM public.classes class_record
  WHERE class_record.id=p_class_id AND class_record.tenant_organisation_id=v_enrolment.tenant_organisation_id
    AND class_record.organisation_id=p_organisation_id AND class_record.grade=v_enrolment.grade
    AND class_record.academic_year=v_enrolment.academic_year AND class_record.status='active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Target class must match the learner grade, academic year and organisation' USING ERRCODE='23514'; END IF;
  SELECT placement.* INTO v_current FROM public.learner_class_placements placement
  WHERE placement.enrolment_id=v_enrolment.id AND placement.status='active' FOR UPDATE;
  IF NOT FOUND OR v_now<=v_current.starts_at THEN
    RAISE EXCEPTION 'The active class placement history is missing or invalid' USING ERRCODE='23514';
  END IF;
  PERFORM sentinel_private.assert_class_capacity_available(p_class_id,NULL);
  UPDATE public.learner_class_placements SET ends_at=v_now,status='ended'
  WHERE id=v_current.id;
  INSERT INTO public.learner_class_placements(tenant_organisation_id,organisation_id,enrolment_id,learner_id,class_id,grade,academic_year,starts_at,reason,created_by)
  VALUES(v_enrolment.tenant_organisation_id,p_organisation_id,v_enrolment.id,v_enrolment.learner_id,p_class_id,
    v_enrolment.grade,v_enrolment.academic_year,v_now,v_reason,v_actor_id);
  UPDATE public.learner_enrolments SET class_id=p_class_id,updated_at=pg_catalog.now() WHERE id=v_enrolment.id;
  INSERT INTO public.learner_progression_events(tenant_organisation_id,learner_id,event_type,from_grade,to_grade,effective_at,actor_user_id,reason_code)
  VALUES(v_enrolment.tenant_organisation_id,v_enrolment.learner_id,'class_assigned',v_enrolment.grade,v_enrolment.grade,(v_now AT TIME ZONE (SELECT time_zone FROM public.organisations WHERE id=p_organisation_id))::date,v_actor_id,'class_reassignment');
  INSERT INTO public.audit_events(actor_user_id,organisation_id,action,resource_type,resource_id,metadata)
  VALUES(v_actor_id,p_organisation_id,'learner.class_reassigned','learner_enrolment',v_enrolment.id::text,
    jsonb_build_object('fromClassId',v_enrolment.class_id,'toClassId',p_class_id,'effectiveAt',v_now,'reasonRecorded',true));
  RETURN v_enrolment.id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.reassign_learner_to_class(uuid,uuid,uuid,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.reassign_learner_to_class(uuid,uuid,uuid,text) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.withdraw_learner_enrolment(p_organisation_id uuid,p_enrolment_id uuid,p_withdrawal_date date,p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_actor_id uuid:=sentinel_private.current_user_id(); v_enrolment public.learner_enrolments%ROWTYPE;
  v_today date; v_end_date date; v_end_at timestamptz; v_time_zone text; v_placement public.learner_class_placements%ROWTYPE; v_reason text:=pg_catalog.btrim(p_reason);
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Learner withdrawal authority is required' USING ERRCODE='42501';
  END IF;
  IF v_reason IS NULL OR pg_catalog.length(v_reason)<10 OR pg_catalog.length(v_reason)>500 THEN
    RAISE EXCEPTION 'A reason of 10 to 500 characters is required for learner withdrawal' USING ERRCODE='22023';
  END IF;
  SELECT (pg_catalog.now() AT TIME ZONE organisation.time_zone)::date, organisation.time_zone INTO v_today,v_time_zone
  FROM public.organisations organisation WHERE organisation.id=p_organisation_id AND organisation.status='active';
  IF v_today IS NULL OR p_withdrawal_date>v_today THEN
    RAISE EXCEPTION 'Withdrawal date cannot be in the future' USING ERRCODE='23514';
  END IF;
  SELECT enrolment.* INTO v_enrolment FROM public.learner_enrolments enrolment
  WHERE enrolment.id=p_enrolment_id AND enrolment.organisation_id=p_organisation_id
    AND sentinel_private.can_manage_learner_records(enrolment.tenant_organisation_id) FOR UPDATE;
  IF NOT FOUND OR v_enrolment.status<>'active' THEN
    RAISE EXCEPTION 'Only an active learner enrolment can be withdrawn' USING ERRCODE='23514';
  END IF;
  v_end_date:=p_withdrawal_date+1;
  v_end_at:=v_end_date::timestamp AT TIME ZONE v_time_zone;
  IF p_withdrawal_date<v_enrolment.starts_at OR (v_enrolment.ends_at IS NOT NULL AND v_end_date>v_enrolment.ends_at) THEN
    RAISE EXCEPTION 'Withdrawal date must fall within the active enrolment period' USING ERRCODE='23514';
  END IF;
  IF v_enrolment.class_id IS NOT NULL THEN
    SELECT placement.* INTO v_placement FROM public.learner_class_placements placement
    WHERE placement.enrolment_id=v_enrolment.id AND placement.status='active' FOR UPDATE;
    IF FOUND THEN
      IF v_end_at<=v_placement.starts_at THEN RAISE EXCEPTION 'Withdrawal date precedes the current class placement' USING ERRCODE='23514'; END IF;
      UPDATE public.learner_class_placements SET ends_at=v_end_at,status='ended' WHERE id=v_placement.id;
    END IF;
  END IF;
  UPDATE public.learner_enrolments SET status='withdrawn',ends_at=v_end_date,withdrawal_reason=v_reason,updated_at=pg_catalog.now() WHERE id=v_enrolment.id;
  INSERT INTO public.learner_progression_events(tenant_organisation_id,learner_id,event_type,from_grade,effective_at,actor_user_id,reason_code)
  VALUES(v_enrolment.tenant_organisation_id,v_enrolment.learner_id,'withdrawn',v_enrolment.grade,p_withdrawal_date,v_actor_id,'institutional_withdrawal');
  INSERT INTO public.audit_events(actor_user_id,organisation_id,action,resource_type,resource_id,metadata)
  VALUES(v_actor_id,p_organisation_id,'learner.withdrawn','learner_enrolment',v_enrolment.id::text,
    jsonb_build_object('withdrawalDate',p_withdrawal_date,'reasonRecorded',true,'classId',v_enrolment.class_id));
  RETURN v_enrolment.id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.withdraw_learner_enrolment(uuid,uuid,date,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.withdraw_learner_enrolment(uuid,uuid,date,text) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE TABLE public.learner_progression_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  enrolment_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  from_grade integer NOT NULL CHECK (from_grade BETWEEN 1 AND 9),
  from_academic_year integer NOT NULL,
  to_grade integer NOT NULL CHECK (to_grade BETWEEN 1 AND 9),
  to_academic_year integer NOT NULL,
  target_class_id uuid,
  effective_at date NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 500),
  status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','executed')),
  requested_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  decided_by uuid REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  decided_at timestamptz,
  approved_by uuid REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  decision_note text,
  executed_at timestamptz,
  new_enrolment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learner_progression_requests_scope_check CHECK (tenant_organisation_id=organisation_id),
  CONSTRAINT learner_progression_requests_enrolment_fk FOREIGN KEY (tenant_organisation_id, organisation_id, enrolment_id, learner_id)
    REFERENCES public.learner_enrolments (tenant_organisation_id, organisation_id, id, learner_id) ON DELETE RESTRICT,
  CONSTRAINT learner_progression_requests_new_enrolment_fk FOREIGN KEY (tenant_organisation_id, organisation_id, new_enrolment_id, learner_id)
    REFERENCES public.learner_enrolments (tenant_organisation_id, organisation_id, id, learner_id) ON DELETE RESTRICT,
  CONSTRAINT learner_progression_requests_year_check CHECK (to_academic_year=from_academic_year+1),
  CONSTRAINT learner_progression_requests_grade_step_check CHECK (to_grade IN (from_grade,from_grade+1)),
  CONSTRAINT learner_progression_requests_decision_check CHECK (
    (status='pending' AND decided_by IS NULL AND decided_at IS NULL AND approved_by IS NULL AND approved_at IS NULL)
    OR (status='approved' AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND approved_by=decided_by AND approved_at=decided_at)
    OR (status='rejected' AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND approved_by IS NULL AND approved_at IS NULL)
    OR (status='executed' AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND approved_by IS NOT NULL AND approved_at IS NOT NULL)
  ),
  CONSTRAINT learner_progression_requests_class_fk FOREIGN KEY
    (tenant_organisation_id,organisation_id,target_class_id,to_grade,to_academic_year)
    REFERENCES public.classes(tenant_organisation_id,organisation_id,id,grade,academic_year) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE UNIQUE INDEX learner_progression_requests_pending_idx
  ON public.learner_progression_requests(tenant_organisation_id,enrolment_id) WHERE status IN ('pending','approved');
--> statement-breakpoint
CREATE INDEX learner_progression_requests_status_idx
  ON public.learner_progression_requests(tenant_organisation_id,organisation_id,status,created_at DESC);
--> statement-breakpoint
ALTER TABLE public.learner_progression_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.learner_progression_requests FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY learner_progression_requests_select ON public.learner_progression_requests
  FOR SELECT TO sentinel_learner_runtime USING (sentinel_private.can_manage_learner_records(organisation_id));
--> statement-breakpoint
GRANT SELECT ON TABLE public.learner_progression_requests TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.request_learner_progression(
  p_organisation_id uuid,p_enrolment_id uuid,p_to_grade integer,p_to_academic_year integer,
  p_target_class_id uuid,p_effective_at date,p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_actor_id uuid:=sentinel_private.current_user_id(); v_enrolment public.learner_enrolments%ROWTYPE;
  v_request_id uuid; v_reason text:=pg_catalog.btrim(p_reason);
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Learner progression request authority is required' USING ERRCODE='42501';
  END IF;
  IF v_reason IS NULL OR pg_catalog.length(v_reason)<10 OR pg_catalog.length(v_reason)>500 THEN
    RAISE EXCEPTION 'A reason of 10 to 500 characters is required for progression' USING ERRCODE='22023';
  END IF;
  SELECT enrolment.* INTO v_enrolment FROM public.learner_enrolments enrolment
  WHERE enrolment.id=p_enrolment_id AND enrolment.organisation_id=p_organisation_id
    AND sentinel_private.can_manage_learner_records(enrolment.tenant_organisation_id) FOR UPDATE;
  IF NOT FOUND OR v_enrolment.status<>'active' THEN RAISE EXCEPTION 'An active enrolment is required' USING ERRCODE='23514'; END IF;
  IF p_to_grade NOT IN (v_enrolment.grade,v_enrolment.grade+1) OR p_to_grade>9
    OR p_to_academic_year<>v_enrolment.academic_year+1 OR p_effective_at<=v_enrolment.starts_at THEN
    RAISE EXCEPTION 'Progression must move to the same or next grade in the next academic year, after the current enrolment start' USING ERRCODE='23514';
  END IF;
  IF p_target_class_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.classes class_record WHERE class_record.id=p_target_class_id
      AND class_record.organisation_id=p_organisation_id AND class_record.grade=p_to_grade
      AND class_record.academic_year=p_to_academic_year AND class_record.status='active'
  ) THEN RAISE EXCEPTION 'Target class must match the approved grade and academic year' USING ERRCODE='23514'; END IF;
  INSERT INTO public.learner_progression_requests(
    tenant_organisation_id,organisation_id,enrolment_id,learner_id,from_grade,from_academic_year,
    to_grade,to_academic_year,target_class_id,effective_at,reason,requested_by
  ) VALUES (
    v_enrolment.tenant_organisation_id,p_organisation_id,v_enrolment.id,v_enrolment.learner_id,
    v_enrolment.grade,v_enrolment.academic_year,p_to_grade,p_to_academic_year,p_target_class_id,p_effective_at,v_reason,v_actor_id
  ) RETURNING id INTO v_request_id;
  INSERT INTO public.audit_events(actor_user_id,organisation_id,action,resource_type,resource_id,metadata)
  VALUES(v_actor_id,p_organisation_id,'learner.progression_requested','learner_progression_request',v_request_id::text,
    jsonb_build_object('enrolmentId',v_enrolment.id,'fromGrade',v_enrolment.grade,'toGrade',p_to_grade,
      'fromAcademicYear',v_enrolment.academic_year,'toAcademicYear',p_to_academic_year,'effectiveAt',p_effective_at,'targetClassId',p_target_class_id));
  RETURN v_request_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.request_learner_progression(uuid,uuid,integer,integer,uuid,date,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.request_learner_progression(uuid,uuid,integer,integer,uuid,date,text) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.approve_learner_progression_request(p_organisation_id uuid,p_request_id uuid,p_note text DEFAULT NULL)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_actor_id uuid:=sentinel_private.current_user_id(); v_request public.learner_progression_requests%ROWTYPE; v_now timestamptz:=pg_catalog.now();
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Progression approval authority is required' USING ERRCODE='42501';
  END IF;
  SELECT request.* INTO v_request FROM public.learner_progression_requests request
  WHERE request.id=p_request_id AND request.organisation_id=p_organisation_id FOR UPDATE;
  IF NOT FOUND OR v_request.status<>'pending' THEN RAISE EXCEPTION 'Pending progression request not found' USING ERRCODE='P0002'; END IF;
  IF v_request.requested_by=v_actor_id THEN RAISE EXCEPTION 'Progression requests require independent approval by another authorised user' USING ERRCODE='42501'; END IF;
  UPDATE public.learner_progression_requests SET status='approved',decided_by=v_actor_id,decided_at=v_now,approved_by=v_actor_id,approved_at=v_now,
    decision_note=NULLIF(pg_catalog.btrim(p_note),''),updated_at=v_now WHERE id=p_request_id;
  INSERT INTO public.audit_events(actor_user_id,organisation_id,action,resource_type,resource_id,metadata)
  VALUES(v_actor_id,p_organisation_id,'learner.progression_approved','learner_progression_request',p_request_id::text,
    jsonb_build_object('requestedBy',v_request.requested_by,'approvedAt',v_now,'effectiveAt',v_request.effective_at));
  RETURN v_now;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.approve_learner_progression_request(uuid,uuid,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.approve_learner_progression_request(uuid,uuid,text) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.reject_learner_progression_request(p_organisation_id uuid,p_request_id uuid,p_note text)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_actor_id uuid:=sentinel_private.current_user_id(); v_request public.learner_progression_requests%ROWTYPE; v_now timestamptz:=pg_catalog.now(); v_note text:=pg_catalog.btrim(p_note);
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Progression decision authority is required' USING ERRCODE='42501';
  END IF;
  IF v_note IS NULL OR pg_catalog.length(v_note)<10 OR pg_catalog.length(v_note)>500 THEN
    RAISE EXCEPTION 'A reason of 10 to 500 characters is required to reject progression' USING ERRCODE='22023';
  END IF;
  SELECT request.* INTO v_request FROM public.learner_progression_requests request
  WHERE request.id=p_request_id AND request.organisation_id=p_organisation_id FOR UPDATE;
  IF NOT FOUND OR v_request.status<>'pending' THEN RAISE EXCEPTION 'Pending progression request not found' USING ERRCODE='P0002'; END IF;
  IF v_request.requested_by=v_actor_id THEN RAISE EXCEPTION 'Progression requests require an independent decision by another authorised user' USING ERRCODE='42501'; END IF;
  UPDATE public.learner_progression_requests SET status='rejected',decided_by=v_actor_id,decided_at=v_now,
    decision_note=v_note,updated_at=v_now WHERE id=p_request_id;
  INSERT INTO public.audit_events(actor_user_id,organisation_id,action,resource_type,resource_id,metadata)
  VALUES(v_actor_id,p_organisation_id,'learner.progression_rejected','learner_progression_request',p_request_id::text,
    jsonb_build_object('requestedBy',v_request.requested_by,'rejectedAt',v_now,'decisionNote',v_note));
  RETURN v_now;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.reject_learner_progression_request(uuid,uuid,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.reject_learner_progression_request(uuid,uuid,text) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.execute_approved_learner_progression(p_organisation_id uuid,p_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_actor_id uuid:=sentinel_private.current_user_id(); v_request public.learner_progression_requests%ROWTYPE;
  v_enrolment public.learner_enrolments%ROWTYPE; v_today date; v_time_zone text; v_effective_at_ts timestamptz; v_new_enrolment_id uuid;
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Progression execution authority is required' USING ERRCODE='42501';
  END IF;
  SELECT (pg_catalog.now() AT TIME ZONE organisation.time_zone)::date, organisation.time_zone INTO v_today,v_time_zone
  FROM public.organisations organisation WHERE organisation.id=p_organisation_id AND organisation.status='active';
  SELECT request.* INTO v_request FROM public.learner_progression_requests request
  WHERE request.id=p_request_id AND request.organisation_id=p_organisation_id AND request.status='approved' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Approved progression request not found' USING ERRCODE='P0002'; END IF;
  IF v_request.effective_at>v_today THEN RAISE EXCEPTION 'Progression cannot be executed before its effective date' USING ERRCODE='23514'; END IF;
  SELECT enrolment.* INTO v_enrolment FROM public.learner_enrolments enrolment
  WHERE enrolment.id=v_request.enrolment_id AND enrolment.status='active' FOR UPDATE;
  IF NOT FOUND OR v_enrolment.learner_id<>v_request.learner_id THEN RAISE EXCEPTION 'Source enrolment is no longer active' USING ERRCODE='23514'; END IF;
  IF v_request.effective_at<=v_enrolment.starts_at OR (v_enrolment.ends_at IS NOT NULL AND v_request.effective_at>=v_enrolment.ends_at) THEN
    RAISE EXCEPTION 'Progression effective date is outside the source enrolment period' USING ERRCODE='23514';
  END IF;
  v_effective_at_ts:=v_request.effective_at::timestamp AT TIME ZONE v_time_zone;
  IF v_request.target_class_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.classes class_record WHERE class_record.id=v_request.target_class_id
      AND class_record.organisation_id=p_organisation_id AND class_record.status='active'
      AND class_record.grade=v_request.to_grade AND class_record.academic_year=v_request.to_academic_year) THEN
      RAISE EXCEPTION 'Approved target class is no longer active or does not match the progression' USING ERRCODE='23514';
    END IF;
    PERFORM sentinel_private.assert_class_capacity_available(v_request.target_class_id,NULL);
  END IF;
  UPDATE public.learner_enrolments SET status='ended',ends_at=v_request.effective_at,updated_at=pg_catalog.now() WHERE id=v_enrolment.id;
  IF EXISTS (SELECT 1 FROM public.learner_class_placements placement WHERE placement.enrolment_id=v_enrolment.id AND placement.status='active' AND v_effective_at_ts<=placement.starts_at) THEN
    RAISE EXCEPTION 'Progression effective date precedes the active class placement start' USING ERRCODE='23514';
  END IF;
  UPDATE public.learner_class_placements SET status='ended',ends_at=v_effective_at_ts
    WHERE enrolment_id=v_enrolment.id AND status='active';
  INSERT INTO public.learner_enrolments(
    tenant_organisation_id,learner_id,organisation_id,grade,academic_year,class_id,status,starts_at,created_by
  ) VALUES (
    v_enrolment.tenant_organisation_id,v_enrolment.learner_id,p_organisation_id,v_request.to_grade,
    v_request.to_academic_year,v_request.target_class_id,'active',v_request.effective_at,v_actor_id
  ) RETURNING id INTO v_new_enrolment_id;
  IF v_request.target_class_id IS NOT NULL THEN
    INSERT INTO public.learner_class_placements(tenant_organisation_id,organisation_id,enrolment_id,learner_id,class_id,grade,academic_year,starts_at,created_by)
    VALUES(v_enrolment.tenant_organisation_id,p_organisation_id,v_new_enrolment_id,v_enrolment.learner_id,
      v_request.target_class_id,v_request.to_grade,v_request.to_academic_year,v_effective_at_ts,v_actor_id);
  END IF;
  INSERT INTO public.learner_progression_events(tenant_organisation_id,learner_id,event_type,from_grade,to_grade,effective_at,actor_user_id,reason_code)
  VALUES(v_enrolment.tenant_organisation_id,v_enrolment.learner_id,
    CASE WHEN v_request.to_grade>v_request.from_grade THEN 'promoted' ELSE 'repeated' END,
    v_request.from_grade,v_request.to_grade,v_request.effective_at,v_actor_id,'approved_progression');
  UPDATE public.learner_progression_requests SET status='executed',executed_at=pg_catalog.now(),
    new_enrolment_id=v_new_enrolment_id,updated_at=pg_catalog.now() WHERE id=p_request_id;
  INSERT INTO public.audit_events(actor_user_id,organisation_id,action,resource_type,resource_id,metadata)
  VALUES(v_actor_id,p_organisation_id,'learner.progression_executed','learner_progression_request',p_request_id::text,
    jsonb_build_object('oldEnrolmentId',v_enrolment.id,'newEnrolmentId',v_new_enrolment_id,
      'fromGrade',v_request.from_grade,'toGrade',v_request.to_grade,'fromAcademicYear',v_request.from_academic_year,
      'toAcademicYear',v_request.to_academic_year,'effectiveAt',v_request.effective_at,'targetClassId',v_request.target_class_id));
  RETURN v_new_enrolment_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.execute_approved_learner_progression(uuid,uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.execute_approved_learner_progression(uuid,uuid) TO sentinel_learner_runtime;
