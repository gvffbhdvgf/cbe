-- Governed learner identity corrections. Requests retain before/after values; a separate administrator reviews.
CREATE TABLE public.learner_record_correction_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  learner_id uuid NOT NULL,
  person_id uuid NOT NULL,
  field_key varchar(32) NOT NULL CHECK (field_key IN ('legal_first_name','legal_middle_name','legal_last_name','preferred_name','date_of_birth')),
  original_value text,
  proposed_value text,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 10 AND 500),
  evidence_reference varchar(180) CHECK (evidence_reference IS NULL OR length(btrim(evidence_reference)) BETWEEN 3 AND 180),
  status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  review_reason text,
  CHECK (
    (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_reason IS NULL)
    OR (status IN ('approved','rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_reason IS NOT NULL AND length(btrim(review_reason)) BETWEEN 3 AND 500)
  ),
  FOREIGN KEY (tenant_organisation_id, learner_id) REFERENCES public.learner_profiles(tenant_organisation_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_organisation_id, person_id) REFERENCES public.people(tenant_organisation_id,id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE UNIQUE INDEX learner_record_correction_one_pending_field_idx
  ON public.learner_record_correction_requests(tenant_organisation_id, learner_id, field_key)
  WHERE status = 'pending';
--> statement-breakpoint
CREATE INDEX learner_record_correction_queue_idx
  ON public.learner_record_correction_requests(tenant_organisation_id, status, requested_at DESC);
--> statement-breakpoint
ALTER TABLE public.learner_record_correction_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT ON TABLE public.learner_record_correction_requests TO sentinel_learner_runtime;
--> statement-breakpoint
CREATE POLICY learner_record_correction_manager_select
  ON public.learner_record_correction_requests
  FOR SELECT TO sentinel_learner_runtime
  USING (sentinel_private.can_manage_learner_records(tenant_organisation_id));
--> statement-breakpoint
CREATE FUNCTION sentinel_private.submit_learner_record_correction(
  p_learner_id uuid, p_field_key text, p_proposed_value text,
  p_reason text, p_evidence_reference text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := sentinel_private.current_user_id();
  v_organisation_id uuid;
  v_person_id uuid;
  v_original_value text;
  v_request_id uuid;
BEGIN
  SELECT learner.tenant_organisation_id INTO v_organisation_id
  FROM public.learner_profiles learner
  WHERE learner.id = p_learner_id AND learner.status = 'active';
  IF v_actor_id IS NULL OR v_organisation_id IS NULL
     OR NOT sentinel_private.can_manage_learner_records(v_organisation_id) THEN
    RAISE EXCEPTION 'Learner record access denied' USING ERRCODE = '42501';
  END IF;
  IF p_field_key NOT IN ('legal_first_name','legal_middle_name','legal_last_name','preferred_name','date_of_birth') THEN
    RAISE EXCEPTION 'Unsupported learner field' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'A correction reason of 10 to 500 characters is required' USING ERRCODE = '22023';
  END IF;
  IF p_evidence_reference IS NOT NULL AND length(btrim(p_evidence_reference)) NOT BETWEEN 3 AND 180 THEN
    RAISE EXCEPTION 'Evidence reference must be 3 to 180 characters' USING ERRCODE = '22023';
  END IF;
  IF p_field_key IN ('legal_first_name','legal_last_name')
     AND (p_proposed_value IS NULL OR length(btrim(p_proposed_value)) NOT BETWEEN 1 AND 120) THEN
    RAISE EXCEPTION 'Legal first and last names are required and limited to 120 characters' USING ERRCODE = '22023';
  END IF;
  IF p_field_key IN ('legal_middle_name','preferred_name')
     AND p_proposed_value IS NOT NULL AND length(btrim(p_proposed_value)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Name values must be at most 120 characters or empty' USING ERRCODE = '22023';
  END IF;
  IF p_field_key = 'date_of_birth' AND p_proposed_value IS NOT NULL THEN
    IF p_proposed_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RAISE EXCEPTION 'Date of birth must use YYYY-MM-DD' USING ERRCODE = '22023';
    END IF;
    BEGIN
      PERFORM p_proposed_value::date;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Date of birth must be a valid calendar date' USING ERRCODE = '22023';
    END;
  END IF;

  SELECT person.id,
    CASE p_field_key
      WHEN 'legal_first_name' THEN person.legal_first_name
      WHEN 'legal_middle_name' THEN person.legal_middle_name
      WHEN 'legal_last_name' THEN person.legal_last_name
      WHEN 'preferred_name' THEN person.preferred_name
      WHEN 'date_of_birth' THEN person.date_of_birth::text
    END
  INTO v_person_id, v_original_value
  FROM public.learner_profiles learner
  INNER JOIN public.people person
    ON person.id = learner.person_id
   AND person.tenant_organisation_id = learner.tenant_organisation_id
  WHERE learner.id = p_learner_id
    AND learner.tenant_organisation_id = v_organisation_id
  FOR UPDATE OF person;
  IF NOT FOUND THEN RAISE EXCEPTION 'Learner person record not found' USING ERRCODE = 'P0002'; END IF;
  IF v_original_value IS NOT DISTINCT FROM p_proposed_value THEN
    RAISE EXCEPTION 'The proposed value is unchanged' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.learner_record_correction_requests (
    tenant_organisation_id, learner_id, person_id, field_key,
    original_value, proposed_value, reason, evidence_reference, requested_by
  ) VALUES (
    v_organisation_id, p_learner_id, v_person_id, p_field_key,
    v_original_value, p_proposed_value, btrim(p_reason), nullif(btrim(p_evidence_reference),''), v_actor_id
  ) RETURNING id INTO v_request_id;

  INSERT INTO public.audit_events(actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, v_organisation_id, 'learner.record_correction_requested',
    'learner_record_correction_request', v_request_id::text,
    jsonb_build_object('field',p_field_key,'evidenceReferenceProvided',p_evidence_reference IS NOT NULL));
  RETURN v_request_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.submit_learner_record_correction(uuid,text,text,text,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.submit_learner_record_correction(uuid,text,text,text,text) TO sentinel_learner_runtime;
--> statement-breakpoint
CREATE FUNCTION sentinel_private.review_learner_record_correction(
  p_request_id uuid, p_decision text, p_review_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := sentinel_private.current_user_id();
  v_request public.learner_record_correction_requests%ROWTYPE;
  v_current_value text;
BEGIN
  IF v_actor_id IS NULL OR p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'A verified identity and supported review decision are required' USING ERRCODE = '42501';
  END IF;
  IF p_review_reason IS NULL OR length(btrim(p_review_reason)) NOT BETWEEN 3 AND 500 THEN
    RAISE EXCEPTION 'A review reason of 3 to 500 characters is required' USING ERRCODE = '22023';
  END IF;
  SELECT request.* INTO v_request
  FROM public.learner_record_correction_requests request
  WHERE request.id = p_request_id
    AND sentinel_private.can_manage_learner_records(request.tenant_organisation_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Correction request not found or access denied' USING ERRCODE = 'P0002'; END IF;
  IF v_request.status <> 'pending' THEN RAISE EXCEPTION 'This correction request has already been reviewed' USING ERRCODE = '23514'; END IF;
  IF v_request.requested_by = v_actor_id THEN
    RAISE EXCEPTION 'The requester cannot review their own correction request' USING ERRCODE = '42501';
  END IF;

  SELECT CASE v_request.field_key
    WHEN 'legal_first_name' THEN person.legal_first_name
    WHEN 'legal_middle_name' THEN person.legal_middle_name
    WHEN 'legal_last_name' THEN person.legal_last_name
    WHEN 'preferred_name' THEN person.preferred_name
    WHEN 'date_of_birth' THEN person.date_of_birth::text
  END
  INTO v_current_value
  FROM public.people person
  WHERE person.id = v_request.person_id
    AND person.tenant_organisation_id = v_request.tenant_organisation_id
  FOR UPDATE;
  IF NOT FOUND OR v_current_value IS DISTINCT FROM v_request.original_value THEN
    RAISE EXCEPTION 'The learner field changed after submission; submit a fresh correction request' USING ERRCODE = '23514';
  END IF;

  IF p_decision = 'approved' THEN
    UPDATE public.people SET
      legal_first_name = CASE WHEN v_request.field_key = 'legal_first_name' THEN btrim(v_request.proposed_value) ELSE legal_first_name END,
      legal_middle_name = CASE WHEN v_request.field_key = 'legal_middle_name' THEN nullif(btrim(v_request.proposed_value),'') ELSE legal_middle_name END,
      legal_last_name = CASE WHEN v_request.field_key = 'legal_last_name' THEN btrim(v_request.proposed_value) ELSE legal_last_name END,
      preferred_name = CASE WHEN v_request.field_key = 'preferred_name' THEN nullif(btrim(v_request.proposed_value),'') ELSE preferred_name END,
      date_of_birth = CASE WHEN v_request.field_key = 'date_of_birth' THEN v_request.proposed_value::date ELSE date_of_birth END,
      updated_at = now()
    WHERE id = v_request.person_id AND tenant_organisation_id = v_request.tenant_organisation_id;
  END IF;

  UPDATE public.learner_record_correction_requests
  SET status = p_decision, reviewed_by = v_actor_id, reviewed_at = now(), review_reason = btrim(p_review_reason)
  WHERE id = p_request_id;

  INSERT INTO public.audit_events(actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, v_request.tenant_organisation_id,
    CASE WHEN p_decision = 'approved' THEN 'learner.record_correction_approved' ELSE 'learner.record_correction_rejected' END,
    'learner_record_correction_request', p_request_id::text,
    jsonb_build_object('field',v_request.field_key,'requesterId',v_request.requested_by));
  RETURN p_request_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.review_learner_record_correction(uuid,text,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.review_learner_record_correction(uuid,text,text) TO sentinel_learner_runtime;
