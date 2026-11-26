-- Cohort-level academic-year rollover planning that reuses independent learner progression decisions.
CREATE TABLE public.academic_year_rollover_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  from_academic_year integer NOT NULL CHECK (from_academic_year BETWEEN 2000 AND 2099),
  to_academic_year integer NOT NULL CHECK (to_academic_year BETWEEN 2001 AND 2100),
  effective_at date NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','cancelled')),
  requested_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (tenant_organisation_id = organisation_id),
  CHECK (to_academic_year = from_academic_year + 1),
  CHECK ((status = 'draft' AND submitted_at IS NULL) OR (status IN ('submitted','cancelled') AND submitted_at IS NOT NULL)),
  UNIQUE (tenant_organisation_id, organisation_id, id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX academic_year_rollover_one_open_batch_idx
  ON public.academic_year_rollover_batches(tenant_organisation_id, organisation_id, from_academic_year)
  WHERE status IN ('draft','submitted');
--> statement-breakpoint
CREATE TABLE public.academic_year_rollover_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL,
  organisation_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  source_enrolment_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  learner_reference varchar(48) NOT NULL,
  from_grade integer NOT NULL CHECK (from_grade BETWEEN 1 AND 9),
  outcome varchar(20) NOT NULL DEFAULT 'unresolved' CHECK (outcome IN ('unresolved','promote','repeat','not_progressing')),
  to_grade integer,
  target_class_id uuid REFERENCES public.classes(id) ON DELETE RESTRICT,
  reason text,
  progression_request_id uuid REFERENCES public.learner_progression_requests(id) ON DELETE RESTRICT,
  status varchar(20) NOT NULL DEFAULT 'unresolved' CHECK (status IN ('unresolved','planned','request_created','excluded')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (tenant_organisation_id = organisation_id),
  CHECK (
    (outcome = 'unresolved' AND to_grade IS NULL AND target_class_id IS NULL AND reason IS NULL AND status = 'unresolved' AND progression_request_id IS NULL)
    OR (outcome IN ('promote','repeat') AND to_grade BETWEEN 1 AND 9 AND reason IS NOT NULL AND length(btrim(reason)) BETWEEN 10 AND 500 AND status IN ('planned','request_created'))
    OR (outcome = 'not_progressing' AND to_grade IS NULL AND target_class_id IS NULL AND reason IS NOT NULL AND length(btrim(reason)) BETWEEN 10 AND 500 AND status = 'excluded' AND progression_request_id IS NULL)
  ),
  FOREIGN KEY (tenant_organisation_id, organisation_id, batch_id)
    REFERENCES public.academic_year_rollover_batches(tenant_organisation_id, organisation_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_organisation_id, organisation_id, source_enrolment_id, learner_id)
    REFERENCES public.learner_enrolments(tenant_organisation_id, organisation_id, id, learner_id) ON DELETE RESTRICT,
  UNIQUE (batch_id, source_enrolment_id),
  UNIQUE (progression_request_id)
);
--> statement-breakpoint
CREATE INDEX academic_year_rollover_items_batch_status_idx
  ON public.academic_year_rollover_items(batch_id, status, learner_reference);
--> statement-breakpoint
ALTER TABLE public.academic_year_rollover_batches ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.academic_year_rollover_batches FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.academic_year_rollover_items ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.academic_year_rollover_items FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY academic_year_rollover_batches_select ON public.academic_year_rollover_batches
  FOR SELECT TO sentinel_learner_runtime USING (sentinel_private.can_manage_learner_records(organisation_id));
--> statement-breakpoint
CREATE POLICY academic_year_rollover_items_select ON public.academic_year_rollover_items
  FOR SELECT TO sentinel_learner_runtime USING (sentinel_private.can_manage_learner_records(organisation_id));
--> statement-breakpoint
GRANT SELECT ON TABLE public.academic_year_rollover_batches, public.academic_year_rollover_items TO sentinel_learner_runtime;
--> statement-breakpoint
CREATE FUNCTION sentinel_private.create_academic_year_rollover(
  p_organisation_id uuid, p_from_academic_year integer, p_effective_at date
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := sentinel_private.current_user_id();
  v_batch_id uuid;
  v_item_count integer;
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Academic-year rollover authority is required' USING ERRCODE = '42501';
  END IF;
  IF p_from_academic_year NOT BETWEEN 2000 AND 2099 OR p_effective_at IS NULL THEN
    RAISE EXCEPTION 'A valid source academic year and effective date are required' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organisations WHERE id = p_organisation_id AND status = 'active') THEN
    RAISE EXCEPTION 'Active organisation not found' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.academic_year_rollover_batches(
    tenant_organisation_id, organisation_id, from_academic_year, to_academic_year,
    effective_at, requested_by
  ) VALUES (
    p_organisation_id, p_organisation_id, p_from_academic_year, p_from_academic_year + 1,
    p_effective_at, v_actor_id
  ) RETURNING id INTO v_batch_id;

  INSERT INTO public.academic_year_rollover_items(
    tenant_organisation_id, organisation_id, batch_id, source_enrolment_id,
    learner_id, learner_reference, from_grade
  )
  SELECT enrolment.tenant_organisation_id, enrolment.organisation_id, v_batch_id,
    enrolment.id, enrolment.learner_id, learner.learner_reference, enrolment.grade
  FROM public.learner_enrolments enrolment
  INNER JOIN public.learner_profiles learner
    ON learner.id = enrolment.learner_id
   AND learner.tenant_organisation_id = enrolment.tenant_organisation_id
  WHERE enrolment.tenant_organisation_id = p_organisation_id
    AND enrolment.organisation_id = p_organisation_id
    AND enrolment.academic_year = p_from_academic_year
    AND enrolment.status = 'active'
  ORDER BY learner.learner_reference;
  GET DIAGNOSTICS v_item_count = ROW_COUNT;
  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'No active learner enrolments exist for the selected academic year' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.audit_events(actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, 'learner.academic_year_rollover_created',
    'academic_year_rollover_batch', v_batch_id::text,
    jsonb_build_object('fromAcademicYear',p_from_academic_year,'toAcademicYear',p_from_academic_year + 1,
      'effectiveAt',p_effective_at,'learnerCount',v_item_count));
  RETURN v_batch_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.create_academic_year_rollover(uuid,integer,date) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.create_academic_year_rollover(uuid,integer,date) TO sentinel_learner_runtime;
--> statement-breakpoint
CREATE FUNCTION sentinel_private.set_academic_year_rollover_item_decision(
  p_batch_id uuid, p_item_id uuid, p_outcome text, p_target_class_id uuid, p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := sentinel_private.current_user_id();
  v_batch public.academic_year_rollover_batches%ROWTYPE;
  v_item public.academic_year_rollover_items%ROWTYPE;
  v_target_grade integer;
BEGIN
  SELECT batch.* INTO v_batch FROM public.academic_year_rollover_batches batch
  WHERE batch.id = p_batch_id AND sentinel_private.can_manage_learner_records(batch.organisation_id)
  FOR UPDATE;
  IF NOT FOUND OR v_batch.status <> 'draft' THEN
    RAISE EXCEPTION 'Draft academic-year rollover not found' USING ERRCODE = 'P0002';
  END IF;
  SELECT item.* INTO v_item FROM public.academic_year_rollover_items item
  WHERE item.id = p_item_id AND item.batch_id = p_batch_id
  FOR UPDATE;
  IF NOT FOUND OR v_item.status <> 'unresolved' THEN
    RAISE EXCEPTION 'Unresolved rollover item not found' USING ERRCODE = 'P0002';
  END IF;
  IF p_outcome NOT IN ('promote','repeat','not_progressing') THEN
    RAISE EXCEPTION 'A supported learner disposition is required' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'A learner-specific reason of 10 to 500 characters is required' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.learner_enrolments enrolment
    WHERE enrolment.id = v_item.source_enrolment_id
      AND enrolment.learner_id = v_item.learner_id
      AND enrolment.organisation_id = v_batch.organisation_id
      AND enrolment.academic_year = v_batch.from_academic_year
      AND enrolment.grade = v_item.from_grade
      AND enrolment.status = 'active'
  ) THEN
    RAISE EXCEPTION 'The source enrolment is no longer active; refresh the rollover cohort' USING ERRCODE = '23514';
  END IF;

  IF p_outcome = 'not_progressing' THEN
    IF p_target_class_id IS NOT NULL THEN RAISE EXCEPTION 'A not-progressing disposition cannot have a target class' USING ERRCODE = '22023'; END IF;
    UPDATE public.academic_year_rollover_items
    SET outcome = 'not_progressing', to_grade = NULL, target_class_id = NULL,
      reason = btrim(p_reason), status = 'excluded', updated_at = now()
    WHERE id = p_item_id;
  ELSE
    v_target_grade := CASE WHEN p_outcome = 'promote' THEN v_item.from_grade + 1 ELSE v_item.from_grade END;
    IF v_target_grade > 9 THEN
      RAISE EXCEPTION 'Grade 9 cannot be promoted beyond the current Grades 1–9 learner model' USING ERRCODE = '23514';
    END IF;
    IF p_target_class_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.classes class_record
      WHERE class_record.id = p_target_class_id
        AND class_record.organisation_id = v_batch.organisation_id
        AND class_record.status = 'active'
        AND class_record.grade = v_target_grade
        AND class_record.academic_year = v_batch.to_academic_year
    ) THEN
      RAISE EXCEPTION 'Target class must be active and match the target grade and academic year' USING ERRCODE = '23514';
    END IF;
    UPDATE public.academic_year_rollover_items
    SET outcome = p_outcome, to_grade = v_target_grade, target_class_id = p_target_class_id,
      reason = btrim(p_reason), status = 'planned', updated_at = now()
    WHERE id = p_item_id;
  END IF;

  INSERT INTO public.audit_events(actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, v_batch.organisation_id, 'learner.academic_year_rollover_item_decided',
    'academic_year_rollover_item', p_item_id::text,
    jsonb_build_object('batchId',p_batch_id,'outcome',p_outcome,'targetGrade',v_target_grade,
      'targetClassId',p_target_class_id,'reason',btrim(p_reason)));
  RETURN p_item_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.set_academic_year_rollover_item_decision(uuid,uuid,text,uuid,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.set_academic_year_rollover_item_decision(uuid,uuid,text,uuid,text) TO sentinel_learner_runtime;
--> statement-breakpoint
CREATE FUNCTION sentinel_private.submit_academic_year_rollover(p_batch_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := sentinel_private.current_user_id();
  v_batch public.academic_year_rollover_batches%ROWTYPE;
  v_current_count integer;
  v_snapshot_count integer;
  v_submitted_count integer := 0;
  v_item public.academic_year_rollover_items%ROWTYPE;
  v_request_id uuid;
BEGIN
  SELECT batch.* INTO v_batch FROM public.academic_year_rollover_batches batch
  WHERE batch.id = p_batch_id AND sentinel_private.can_manage_learner_records(batch.organisation_id)
  FOR UPDATE;
  IF NOT FOUND OR v_batch.status <> 'draft' THEN
    RAISE EXCEPTION 'Draft academic-year rollover not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*)::integer INTO v_current_count
  FROM public.learner_enrolments enrolment
  WHERE enrolment.tenant_organisation_id = v_batch.tenant_organisation_id
    AND enrolment.organisation_id = v_batch.organisation_id
    AND enrolment.academic_year = v_batch.from_academic_year
    AND enrolment.status = 'active';
  SELECT count(*)::integer INTO v_snapshot_count
  FROM public.academic_year_rollover_items item WHERE item.batch_id = p_batch_id;
  IF v_current_count <> v_snapshot_count THEN
    RAISE EXCEPTION 'The active source cohort changed after the rollover snapshot; create a fresh rollover plan' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.academic_year_rollover_items item WHERE item.batch_id = p_batch_id AND item.status = 'unresolved') THEN
    RAISE EXCEPTION 'Every learner must have an explicit progression or not-progressing decision before submission' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.academic_year_rollover_items item
    LEFT JOIN public.learner_enrolments enrolment ON enrolment.id = item.source_enrolment_id
    WHERE item.batch_id = p_batch_id
      AND (enrolment.id IS NULL OR enrolment.status <> 'active'
        OR enrolment.academic_year <> v_batch.from_academic_year OR enrolment.grade <> item.from_grade)
  ) THEN
    RAISE EXCEPTION 'A source enrolment changed after the rollover snapshot; refresh the plan' USING ERRCODE = '23514';
  END IF;

  FOR v_item IN
    SELECT * FROM public.academic_year_rollover_items
    WHERE batch_id = p_batch_id AND outcome IN ('promote','repeat') AND status = 'planned'
    ORDER BY learner_reference
    FOR UPDATE
  LOOP
    v_request_id := sentinel_private.request_learner_progression(
      v_batch.organisation_id, v_item.source_enrolment_id, v_item.to_grade,
      v_batch.to_academic_year, v_item.target_class_id, v_batch.effective_at, v_item.reason
    );
    UPDATE public.academic_year_rollover_items
    SET progression_request_id = v_request_id, status = 'request_created', updated_at = now()
    WHERE id = v_item.id;
    v_submitted_count := v_submitted_count + 1;
  END LOOP;

  UPDATE public.academic_year_rollover_batches
  SET status = 'submitted', submitted_at = now(), updated_at = now()
  WHERE id = p_batch_id;
  INSERT INTO public.audit_events(actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, v_batch.organisation_id, 'learner.academic_year_rollover_submitted',
    'academic_year_rollover_batch', p_batch_id::text,
    jsonb_build_object('fromAcademicYear',v_batch.from_academic_year,'toAcademicYear',v_batch.to_academic_year,
      'learnerCount',v_snapshot_count,'progressionRequestsCreated',v_submitted_count,
      'notProgressingCount',v_snapshot_count-v_submitted_count,'effectiveAt',v_batch.effective_at));
  RETURN v_submitted_count;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.submit_academic_year_rollover(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.submit_academic_year_rollover(uuid) TO sentinel_learner_runtime;
