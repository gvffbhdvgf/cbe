CREATE TABLE public.learner_record_correction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  learner_id uuid NOT NULL,
  person_id uuid NOT NULL,
  original_values jsonb NOT NULL,
  proposed_values jsonb NOT NULL,
  reason text NOT NULL,
  evidence_reference varchar(180),
  status varchar(16) NOT NULL DEFAULT 'pending',
  requested_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  review_reason text,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learner_record_correction_requests_scope_check CHECK (tenant_organisation_id = organisation_id),
  CONSTRAINT learner_record_correction_requests_learner_fk
    FOREIGN KEY (tenant_organisation_id, learner_id)
    REFERENCES public.learner_profiles (tenant_organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT learner_record_correction_requests_person_fk
    FOREIGN KEY (tenant_organisation_id, person_id)
    REFERENCES public.people (tenant_organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT learner_record_correction_requests_values_check CHECK (
    jsonb_typeof(original_values) = 'object'
    AND jsonb_typeof(proposed_values) = 'object'
    AND proposed_values <> '{}'::jsonb
    AND original_values <> '{}'::jsonb
  ),
  CONSTRAINT learner_record_correction_requests_reason_check CHECK (length(btrim(reason)) BETWEEN 10 AND 500),
  CONSTRAINT learner_record_correction_requests_evidence_check CHECK (
    evidence_reference IS NULL OR length(btrim(evidence_reference)) BETWEEN 3 AND 180
  ),
  CONSTRAINT learner_record_correction_requests_status_check CHECK (status IN ('pending','applied','rejected','conflicted')),
  CONSTRAINT learner_record_correction_requests_review_reason_check CHECK (
    review_reason IS NULL OR length(btrim(review_reason)) BETWEEN 10 AND 500
  ),
  CONSTRAINT learner_record_correction_requests_review_state_check CHECK (
    (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_reason IS NULL AND applied_at IS NULL)
    OR (status = 'applied' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_reason IS NOT NULL AND applied_at IS NOT NULL)
    OR (status IN ('rejected','conflicted') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_reason IS NOT NULL AND applied_at IS NULL)
  ),
  CONSTRAINT learner_record_correction_requests_scope_id_unique UNIQUE (tenant_organisation_id, organisation_id, id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX learner_record_correction_one_pending_per_learner_idx
  ON public.learner_record_correction_requests (organisation_id, learner_id)
  WHERE status = 'pending';
--> statement-breakpoint
CREATE INDEX learner_record_correction_requests_history_idx
  ON public.learner_record_correction_requests (organisation_id, requested_at DESC);
--> statement-breakpoint

CREATE TABLE public.learner_record_correction_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL,
  organisation_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  person_id uuid NOT NULL,
  correction_request_id uuid NOT NULL,
  previous_values jsonb NOT NULL,
  corrected_values jsonb NOT NULL,
  changed_fields text[] NOT NULL,
  reason text NOT NULL,
  evidence_reference varchar(180),
  requested_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  reviewed_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  applied_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learner_record_correction_history_scope_check CHECK (tenant_organisation_id = organisation_id),
  CONSTRAINT learner_record_correction_history_request_fk
    FOREIGN KEY (tenant_organisation_id, organisation_id, correction_request_id)
    REFERENCES public.learner_record_correction_requests (tenant_organisation_id, organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT learner_record_correction_history_learner_fk
    FOREIGN KEY (tenant_organisation_id, learner_id)
    REFERENCES public.learner_profiles (tenant_organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT learner_record_correction_history_person_fk
    FOREIGN KEY (tenant_organisation_id, person_id)
    REFERENCES public.people (tenant_organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT learner_record_correction_history_values_check CHECK (
    jsonb_typeof(previous_values) = 'object'
    AND jsonb_typeof(corrected_values) = 'object'
    AND cardinality(changed_fields) > 0
  ),
  CONSTRAINT learner_record_correction_history_reason_check CHECK (length(btrim(reason)) BETWEEN 10 AND 500),
  CONSTRAINT learner_record_correction_history_evidence_check CHECK (
    evidence_reference IS NULL OR length(btrim(evidence_reference)) BETWEEN 3 AND 180
  ),
  CONSTRAINT learner_record_correction_history_request_unique UNIQUE (correction_request_id)
);
--> statement-breakpoint
CREATE INDEX learner_record_correction_history_learner_idx
  ON public.learner_record_correction_history (organisation_id, learner_id, applied_at DESC);
--> statement-breakpoint

CREATE FUNCTION sentinel_private.prevent_learner_record_correction_history_mutation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Learner record correction history is immutable' USING ERRCODE = '23514';
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.prevent_learner_record_correction_history_mutation() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER learner_record_correction_history_append_only
  BEFORE UPDATE OR DELETE ON public.learner_record_correction_history
  FOR EACH ROW EXECUTE FUNCTION sentinel_private.prevent_learner_record_correction_history_mutation();
--> statement-breakpoint

ALTER TABLE public.learner_record_correction_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.learner_record_correction_requests FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY learner_record_correction_requests_select
  ON public.learner_record_correction_requests
  FOR SELECT TO sentinel_learner_runtime
  USING (sentinel_private.can_manage_learner_records(organisation_id));
--> statement-breakpoint
GRANT SELECT ON TABLE public.learner_record_correction_requests TO sentinel_learner_runtime;
--> statement-breakpoint

ALTER TABLE public.learner_record_correction_history ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.learner_record_correction_history FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY learner_record_correction_history_select
  ON public.learner_record_correction_history
  FOR SELECT TO sentinel_learner_runtime
  USING (sentinel_private.can_manage_learner_records(organisation_id));
--> statement-breakpoint
GRANT SELECT ON TABLE public.learner_record_correction_history TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.create_learner_record_correction_request(
  p_organisation_id uuid,
  p_learner_id uuid,
  p_proposed_values jsonb,
  p_reason text,
  p_evidence_reference text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_person_id uuid;
  v_person public.people%ROWTYPE;
  v_current_values jsonb;
  v_original_values jsonb;
  v_request_id uuid;
  v_date_of_birth date;
  v_time_zone text;
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Learner record correction authority is required' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'A correction reason of 10 to 500 characters is required' USING ERRCODE = '22023';
  END IF;
  IF p_evidence_reference IS NOT NULL AND length(btrim(p_evidence_reference)) NOT BETWEEN 3 AND 180 THEN
    RAISE EXCEPTION 'Evidence reference must be between 3 and 180 characters' USING ERRCODE = '22023';
  END IF;
  IF p_proposed_values IS NULL OR jsonb_typeof(p_proposed_values) <> 'object'
    OR jsonb_object_length(p_proposed_values) = 0 THEN
    RAISE EXCEPTION 'At least one supported identity field must be supplied' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(p_proposed_values) AS field(key)
    WHERE field.key NOT IN ('firstName','middleName','lastName','preferredName','dateOfBirth')
  ) THEN
    RAISE EXCEPTION 'Unsupported learner correction field' USING ERRCODE = '22023';
  END IF;
  IF p_proposed_values ? 'firstName' AND (
    jsonb_typeof(p_proposed_values->'firstName') <> 'string'
    OR length(btrim(p_proposed_values->>'firstName')) NOT BETWEEN 1 AND 120
  ) THEN RAISE EXCEPTION 'First name must contain 1 to 120 characters' USING ERRCODE = '22023'; END IF;
  IF p_proposed_values ? 'lastName' AND (
    jsonb_typeof(p_proposed_values->'lastName') <> 'string'
    OR length(btrim(p_proposed_values->>'lastName')) NOT BETWEEN 1 AND 120
  ) THEN RAISE EXCEPTION 'Last name must contain 1 to 120 characters' USING ERRCODE = '22023'; END IF;
  IF p_proposed_values ? 'middleName' AND p_proposed_values->'middleName' <> 'null'::jsonb AND (
    jsonb_typeof(p_proposed_values->'middleName') <> 'string'
    OR length(btrim(p_proposed_values->>'middleName')) NOT BETWEEN 1 AND 120
  ) THEN RAISE EXCEPTION 'Middle name must contain 1 to 120 characters or be cleared' USING ERRCODE = '22023'; END IF;
  IF p_proposed_values ? 'preferredName' AND p_proposed_values->'preferredName' <> 'null'::jsonb AND (
    jsonb_typeof(p_proposed_values->'preferredName') <> 'string'
    OR length(btrim(p_proposed_values->>'preferredName')) NOT BETWEEN 1 AND 120
  ) THEN RAISE EXCEPTION 'Preferred name must contain 1 to 120 characters or be cleared' USING ERRCODE = '22023'; END IF;
  IF p_proposed_values ? 'dateOfBirth' AND p_proposed_values->'dateOfBirth' <> 'null'::jsonb THEN
    IF jsonb_typeof(p_proposed_values->'dateOfBirth') <> 'string'
      OR p_proposed_values->>'dateOfBirth' !~ '^\d{4}-\d{2}-\d{2}$' THEN
      RAISE EXCEPTION 'Date of birth must be a valid YYYY-MM-DD date' USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_date_of_birth := (p_proposed_values->>'dateOfBirth')::date;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Date of birth must be a valid YYYY-MM-DD date' USING ERRCODE = '22023';
    END;
    SELECT organisation.time_zone INTO v_time_zone FROM public.organisations organisation
    WHERE organisation.id = p_organisation_id;
    IF v_date_of_birth > (pg_catalog.now() AT TIME ZONE COALESCE(v_time_zone, 'Africa/Nairobi'))::date THEN
      RAISE EXCEPTION 'Date of birth cannot be in the future' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT learner.person_id INTO v_person_id
  FROM public.learner_profiles learner
  WHERE learner.id = p_learner_id AND learner.tenant_organisation_id = p_organisation_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Learner record not found' USING ERRCODE = 'P0002'; END IF;

  SELECT person.* INTO v_person FROM public.people person
  WHERE person.id = v_person_id AND person.tenant_organisation_id = p_organisation_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Learner identity record not found' USING ERRCODE = 'P0002'; END IF;

  v_current_values := jsonb_build_object(
    'firstName', v_person.legal_first_name,
    'middleName', v_person.legal_middle_name,
    'lastName', v_person.legal_last_name,
    'preferredName', v_person.preferred_name,
    'dateOfBirth', v_person.date_of_birth
  );
  SELECT jsonb_object_agg(current_value.key, current_value.value)
    INTO v_original_values
  FROM jsonb_each(v_current_values) AS current_value(key, value)
  WHERE p_proposed_values ? current_value.key;

  IF NOT EXISTS (
    SELECT 1 FROM jsonb_each(p_proposed_values) AS proposed(key, value)
    WHERE (v_current_values->proposed.key) IS DISTINCT FROM proposed.value
  ) THEN
    RAISE EXCEPTION 'The proposed values do not change the current learner identity' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.learner_record_correction_requests request
    WHERE request.organisation_id = p_organisation_id
      AND request.learner_id = p_learner_id
      AND request.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'A learner correction request is already awaiting review' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.learner_record_correction_requests (
    tenant_organisation_id, organisation_id, learner_id, person_id,
    original_values, proposed_values, reason, evidence_reference, requested_by
  ) VALUES (
    p_organisation_id, p_organisation_id, p_learner_id, v_person_id,
    v_original_values, p_proposed_values, btrim(p_reason), NULLIF(btrim(p_evidence_reference), ''), v_actor_id
  ) RETURNING id INTO v_request_id;

  INSERT INTO public.audit_events(actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (
    v_actor_id, p_organisation_id, 'learner.record_correction_requested',
    'learner_record_correction', v_request_id::text,
    jsonb_build_object(
      'correctionRequestId', v_request_id,
      'learnerId', p_learner_id,
      'changedFields', (SELECT jsonb_agg(field.key ORDER BY field.key) FROM jsonb_object_keys(p_proposed_values) AS field(key))
    )
  );
  RETURN v_request_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.create_learner_record_correction_request(uuid,uuid,jsonb,text,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.create_learner_record_correction_request(uuid,uuid,jsonb,text,text) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.review_learner_record_correction(
  p_organisation_id uuid,
  p_request_id uuid,
  p_decision text,
  p_review_reason text
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_request public.learner_record_correction_requests%ROWTYPE;
  v_learner public.learner_profiles%ROWTYPE;
  v_person public.people%ROWTYPE;
  v_current_values jsonb;
  v_changed_fields text[];
  v_now timestamptz := pg_catalog.now();
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Learner record correction authority is required' USING ERRCODE = '42501';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approve','reject') THEN
    RAISE EXCEPTION 'Correction decision must be approve or reject' USING ERRCODE = '22023';
  END IF;
  IF p_review_reason IS NULL OR length(btrim(p_review_reason)) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'A review reason of 10 to 500 characters is required' USING ERRCODE = '22023';
  END IF;

  SELECT request.* INTO v_request
  FROM public.learner_record_correction_requests request
  WHERE request.id = p_request_id AND request.organisation_id = p_organisation_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Learner correction request not found' USING ERRCODE = 'P0002'; END IF;
  IF v_request.requested_by = v_actor_id THEN
    RAISE EXCEPTION 'Learner correction requests require an independent reviewer' USING ERRCODE = '42501';
  END IF;
  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending learner correction requests can be reviewed' USING ERRCODE = '23514';
  END IF;

  IF p_decision = 'reject' THEN
    UPDATE public.learner_record_correction_requests
    SET status = 'rejected', reviewed_by = v_actor_id, reviewed_at = v_now,
      review_reason = btrim(p_review_reason), updated_at = v_now
    WHERE id = v_request.id;
    INSERT INTO public.audit_events(actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
    VALUES (v_actor_id, p_organisation_id, 'learner.record_correction_rejected',
      'learner_record_correction', v_request.id::text,
      jsonb_build_object('correctionRequestId', v_request.id, 'changedFields',
        (SELECT jsonb_agg(field.key ORDER BY field.key) FROM jsonb_object_keys(v_request.proposed_values) AS field(key))));
    RETURN 'rejected';
  END IF;

  SELECT learner.* INTO v_learner
  FROM public.learner_profiles learner
  WHERE learner.id = v_request.learner_id
    AND learner.tenant_organisation_id = p_organisation_id
    AND learner.person_id = v_request.person_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Learner identity record no longer matches this correction request' USING ERRCODE = 'P0002'; END IF;

  SELECT person.* INTO v_person
  FROM public.people person
  WHERE person.id = v_request.person_id AND person.tenant_organisation_id = p_organisation_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Learner identity record not found' USING ERRCODE = 'P0002'; END IF;

  v_current_values := jsonb_build_object(
    'firstName', v_person.legal_first_name,
    'middleName', v_person.legal_middle_name,
    'lastName', v_person.legal_last_name,
    'preferredName', v_person.preferred_name,
    'dateOfBirth', v_person.date_of_birth
  );
  IF EXISTS (
    SELECT 1 FROM jsonb_each(v_request.original_values) AS original(key, value)
    WHERE (v_current_values->original.key) IS DISTINCT FROM original.value
  ) THEN
    UPDATE public.learner_record_correction_requests
    SET status = 'conflicted', reviewed_by = v_actor_id, reviewed_at = v_now,
      review_reason = btrim(p_review_reason), updated_at = v_now
    WHERE id = v_request.id;
    INSERT INTO public.audit_events(actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
    VALUES (v_actor_id, p_organisation_id, 'learner.record_correction_conflicted',
      'learner_record_correction', v_request.id::text,
      jsonb_build_object('correctionRequestId', v_request.id, 'changedFields',
        (SELECT jsonb_agg(field.key ORDER BY field.key) FROM jsonb_object_keys(v_request.proposed_values) AS field(key))));
    RETURN 'conflicted';
  END IF;

  UPDATE public.people
  SET legal_first_name = CASE WHEN v_request.proposed_values ? 'firstName' THEN v_request.proposed_values->>'firstName' ELSE legal_first_name END,
    legal_middle_name = CASE WHEN v_request.proposed_values ? 'middleName' THEN v_request.proposed_values->>'middleName' ELSE legal_middle_name END,
    legal_last_name = CASE WHEN v_request.proposed_values ? 'lastName' THEN v_request.proposed_values->>'lastName' ELSE legal_last_name END,
    preferred_name = CASE WHEN v_request.proposed_values ? 'preferredName' THEN v_request.proposed_values->>'preferredName' ELSE preferred_name END,
    date_of_birth = CASE WHEN v_request.proposed_values ? 'dateOfBirth' THEN (v_request.proposed_values->>'dateOfBirth')::date ELSE date_of_birth END,
    updated_at = v_now
  WHERE id = v_request.person_id AND tenant_organisation_id = p_organisation_id;

  SELECT array_agg(field.key ORDER BY field.key) INTO v_changed_fields
  FROM jsonb_object_keys(v_request.proposed_values) AS field(key);
  INSERT INTO public.learner_record_correction_history (
    tenant_organisation_id, organisation_id, learner_id, person_id, correction_request_id,
    previous_values, corrected_values, changed_fields, reason, evidence_reference,
    requested_by, reviewed_by, applied_at
  ) VALUES (
    v_request.tenant_organisation_id, v_request.organisation_id, v_request.learner_id, v_request.person_id, v_request.id,
    v_request.original_values, v_request.proposed_values, v_changed_fields, v_request.reason,
    v_request.evidence_reference, v_request.requested_by, v_actor_id, v_now
  );

  UPDATE public.learner_record_correction_requests
  SET status = 'applied', reviewed_by = v_actor_id, reviewed_at = v_now,
    review_reason = btrim(p_review_reason), applied_at = v_now, updated_at = v_now
  WHERE id = v_request.id;
  INSERT INTO public.audit_events(actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, 'learner.record_correction_applied',
    'learner_record_correction', v_request.id::text,
    jsonb_build_object('correctionRequestId', v_request.id, 'changedFields', to_jsonb(v_changed_fields)));
  RETURN 'applied';
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.review_learner_record_correction(uuid,uuid,text,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.review_learner_record_correction(uuid,uuid,text,text) TO sentinel_learner_runtime;
