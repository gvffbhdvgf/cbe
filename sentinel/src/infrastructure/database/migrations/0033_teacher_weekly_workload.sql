-- Effective-dated weekly teaching load and institution-configured workload policy.
CREATE TABLE public.teacher_weekly_workload_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  teacher_assignment_id uuid NOT NULL,
  weekly_periods integer NOT NULL CHECK (weekly_periods BETWEEN 1 AND 60),
  starts_on date NOT NULL,
  ends_on date,
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended','revoked')),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 500),
  created_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (tenant_organisation_id = organisation_id),
  CHECK (ends_on IS NULL OR ends_on > starts_on),
  FOREIGN KEY (tenant_organisation_id, organisation_id, teacher_assignment_id)
    REFERENCES public.teacher_class_assignments(tenant_organisation_id, organisation_id, id) ON DELETE RESTRICT,
  UNIQUE (tenant_organisation_id, organisation_id, id)
);
--> statement-breakpoint
CREATE INDEX teacher_workload_allocation_effective_idx
  ON public.teacher_weekly_workload_allocations(tenant_organisation_id, organisation_id, teacher_assignment_id, starts_on, ends_on);
--> statement-breakpoint
CREATE TABLE public.teacher_workload_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  academic_year integer NOT NULL CHECK (academic_year BETWEEN 2000 AND 2100),
  reference_weekly_periods integer NOT NULL CHECK (reference_weekly_periods BETWEEN 1 AND 60),
  maximum_weekly_periods integer NOT NULL CHECK (maximum_weekly_periods BETWEEN reference_weekly_periods AND 60),
  period_duration_minutes integer CHECK (period_duration_minutes IS NULL OR period_duration_minutes BETWEEN 15 AND 180),
  effective_from date NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 500),
  created_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (tenant_organisation_id = organisation_id),
  UNIQUE (tenant_organisation_id, organisation_id, academic_year, effective_from),
  UNIQUE (tenant_organisation_id, organisation_id, id)
);
--> statement-breakpoint
CREATE INDEX teacher_workload_policy_effective_idx
  ON public.teacher_workload_policies(tenant_organisation_id, organisation_id, academic_year, effective_from DESC);
--> statement-breakpoint
ALTER TABLE public.teacher_weekly_workload_allocations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.teacher_weekly_workload_allocations FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.teacher_workload_policies ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.teacher_workload_policies FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY teacher_weekly_workload_allocations_select ON public.teacher_weekly_workload_allocations
  FOR SELECT TO sentinel_learner_runtime
  USING (sentinel_private.can_read_teacher_assignment(organisation_id, (
    SELECT assignment.teacher_user_id FROM public.teacher_class_assignments assignment
    WHERE assignment.id = teacher_assignment_id AND assignment.organisation_id = teacher_weekly_workload_allocations.organisation_id
  )));
--> statement-breakpoint
CREATE POLICY teacher_workload_policies_select ON public.teacher_workload_policies
  FOR SELECT TO sentinel_learner_runtime
  USING (sentinel_private.can_read_teacher_assignment(organisation_id, sentinel_private.current_user_id()));
--> statement-breakpoint
GRANT SELECT ON TABLE public.teacher_weekly_workload_allocations, public.teacher_workload_policies TO sentinel_learner_runtime;
--> statement-breakpoint
CREATE FUNCTION sentinel_private.set_teacher_weekly_workload_allocation(
  p_organisation_id uuid, p_assignment_id uuid, p_weekly_periods integer,
  p_starts_on date, p_ends_on date, p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := sentinel_private.current_user_id();
  v_assignment public.teacher_class_assignments%ROWTYPE;
  v_allocation_id uuid;
  v_previous integer;
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Teacher workload management authority is required' USING ERRCODE = '42501';
  END IF;
  IF p_weekly_periods NOT BETWEEN 1 AND 60 OR p_starts_on IS NULL
    OR (p_ends_on IS NOT NULL AND p_ends_on <= p_starts_on)
    OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'A valid weekly period count, effective range and reason are required' USING ERRCODE = '22023';
  END IF;
  SELECT assignment.* INTO v_assignment
  FROM public.teacher_class_assignments assignment
  WHERE assignment.id = p_assignment_id
    AND assignment.organisation_id = p_organisation_id
    AND assignment.status = 'active'
    AND p_starts_on >= assignment.starts_on
    AND (assignment.ends_on IS NULL OR p_starts_on < assignment.ends_on)
    AND (p_ends_on IS NULL OR assignment.ends_on IS NULL OR p_ends_on <= assignment.ends_on)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active teacher assignment not found for this effective period' USING ERRCODE = 'P0002'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_assignment_id::text || ':weekly-workload', 0));
  SELECT allocation.weekly_periods INTO v_previous
  FROM public.teacher_weekly_workload_allocations allocation
  WHERE allocation.teacher_assignment_id = p_assignment_id
    AND allocation.organisation_id = p_organisation_id
    AND allocation.status = 'active'
    AND allocation.starts_on < p_starts_on
    AND (allocation.ends_on IS NULL OR allocation.ends_on > p_starts_on)
  FOR UPDATE;
  IF FOUND THEN
    UPDATE public.teacher_weekly_workload_allocations
    SET ends_on = p_starts_on, status = 'ended'
    WHERE teacher_assignment_id = p_assignment_id AND organisation_id = p_organisation_id
      AND status = 'active' AND starts_on < p_starts_on
      AND (ends_on IS NULL OR ends_on > p_starts_on);
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.teacher_weekly_workload_allocations allocation
    WHERE allocation.teacher_assignment_id = p_assignment_id
      AND allocation.organisation_id = p_organisation_id
      AND allocation.status = 'active'
      AND (p_ends_on IS NULL OR allocation.starts_on < p_ends_on)
      AND (allocation.ends_on IS NULL OR allocation.ends_on > p_starts_on)
  ) THEN
    RAISE EXCEPTION 'The requested workload period overlaps a future allocation' USING ERRCODE = '23P01';
  END IF;

  INSERT INTO public.teacher_weekly_workload_allocations(
    tenant_organisation_id, organisation_id, teacher_assignment_id,
    weekly_periods, starts_on, ends_on, reason, created_by
  ) VALUES (
    p_organisation_id, p_organisation_id, p_assignment_id,
    p_weekly_periods, p_starts_on, p_ends_on, btrim(p_reason), v_actor_id
  ) RETURNING id INTO v_allocation_id;

  INSERT INTO public.audit_events(actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, 'teacher.weekly_workload_allocated', 'teacher_weekly_workload_allocation', v_allocation_id::text,
    jsonb_build_object('assignmentId',p_assignment_id,'weeklyPeriods',p_weekly_periods,'previousWeeklyPeriods',v_previous,
      'startsOn',p_starts_on,'endsOn',p_ends_on));
  RETURN v_allocation_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.set_teacher_weekly_workload_allocation(uuid,uuid,integer,date,date,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.set_teacher_weekly_workload_allocation(uuid,uuid,integer,date,date,text) TO sentinel_learner_runtime;
--> statement-breakpoint
CREATE FUNCTION sentinel_private.set_teacher_workload_policy(
  p_organisation_id uuid, p_academic_year integer, p_reference_periods integer,
  p_maximum_periods integer, p_period_duration_minutes integer,
  p_effective_from date, p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_actor_id uuid := sentinel_private.current_user_id(); v_policy_id uuid;
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Teacher workload policy management authority is required' USING ERRCODE = '42501';
  END IF;
  IF p_academic_year NOT BETWEEN 2000 AND 2100 OR p_reference_periods NOT BETWEEN 1 AND 60
    OR p_maximum_periods NOT BETWEEN p_reference_periods AND 60
    OR (p_period_duration_minutes IS NOT NULL AND p_period_duration_minutes NOT BETWEEN 15 AND 180)
    OR p_effective_from IS NULL OR p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'Valid workload thresholds, period duration, effective date and reason are required' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.teacher_workload_policies(
    tenant_organisation_id, organisation_id, academic_year, reference_weekly_periods,
    maximum_weekly_periods, period_duration_minutes, effective_from, reason, created_by
  ) VALUES (
    p_organisation_id, p_organisation_id, p_academic_year, p_reference_periods,
    p_maximum_periods, p_period_duration_minutes, p_effective_from, btrim(p_reason), v_actor_id
  ) RETURNING id INTO v_policy_id;
  INSERT INTO public.audit_events(actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, 'teacher.workload_policy_created', 'teacher_workload_policy', v_policy_id::text,
    jsonb_build_object('academicYear',p_academic_year,'referenceWeeklyPeriods',p_reference_periods,
      'maximumWeeklyPeriods',p_maximum_periods,'periodDurationMinutes',p_period_duration_minutes,'effectiveFrom',p_effective_from));
  RETURN v_policy_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.set_teacher_workload_policy(uuid,integer,integer,integer,integer,date,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.set_teacher_workload_policy(uuid,integer,integer,integer,integer,date,text) TO sentinel_learner_runtime;
