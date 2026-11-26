-- Verified institutional identity and transfer-receiving eligibility.
CREATE TABLE public.organisation_transfer_eligibility (
  organisation_id uuid PRIMARY KEY REFERENCES public.organisations(id) ON DELETE RESTRICT,
  registry_issuer varchar(48) NOT NULL CHECK (registry_issuer IN (
    'moe_registration_number', 'nemis_uic', 'kemis_institution_id',
    'tveta_registration_number', 'other_authority'
  )),
  registry_identifier varchar(180) NOT NULL CHECK (length(btrim(registry_identifier)) BETWEEN 3 AND 180),
  status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected','suspended')),
  submitted_evidence_reference varchar(180) NOT NULL CHECK (length(btrim(submitted_evidence_reference)) BETWEEN 3 AND 180),
  requested_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  requested_at timestamptz NOT NULL DEFAULT now(),
  verification_method varchar(32) CHECK (verification_method IS NULL OR verification_method IN (
    'official_registry', 'official_certificate', 'authority_confirmation', 'other'
  )),
  review_evidence_reference varchar(180),
  reviewed_by uuid REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  valid_until date,
  rejection_reason varchar(300),
  suspended_by uuid REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  suspended_at timestamptz,
  suspension_reason varchar(300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organisation_transfer_eligibility_state_check CHECK (
    (status = 'pending'
      AND verification_method IS NULL AND review_evidence_reference IS NULL
      AND reviewed_by IS NULL AND reviewed_at IS NULL AND valid_until IS NULL
      AND rejection_reason IS NULL AND suspended_by IS NULL AND suspended_at IS NULL AND suspension_reason IS NULL)
    OR
    (status = 'verified'
      AND verification_method IS NOT NULL AND review_evidence_reference IS NOT NULL AND length(btrim(review_evidence_reference)) BETWEEN 3 AND 180
      AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
      AND rejection_reason IS NULL AND suspended_by IS NULL AND suspended_at IS NULL AND suspension_reason IS NULL)
    OR
    (status = 'rejected'
      AND verification_method IS NULL AND review_evidence_reference IS NULL
      AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
      AND rejection_reason IS NOT NULL AND length(btrim(rejection_reason)) BETWEEN 3 AND 300
      AND suspended_by IS NULL AND suspended_at IS NULL AND suspension_reason IS NULL)
    OR
    (status = 'suspended'
      AND verification_method IS NOT NULL AND review_evidence_reference IS NOT NULL AND length(btrim(review_evidence_reference)) BETWEEN 3 AND 180
      AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL
      AND suspended_by IS NOT NULL AND suspended_at IS NOT NULL
      AND suspension_reason IS NOT NULL AND length(btrim(suspension_reason)) BETWEEN 3 AND 300)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX organisation_transfer_registry_identifier_unique
  ON public.organisation_transfer_eligibility (registry_issuer, lower(btrim(registry_identifier)));
--> statement-breakpoint
CREATE INDEX organisation_transfer_eligibility_status_idx
  ON public.organisation_transfer_eligibility (status, requested_at);
--> statement-breakpoint
ALTER TABLE public.organisation_transfer_eligibility ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.organisation_transfer_eligibility FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION sentinel_private.is_platform_administrator()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_administrators administrator
    WHERE administrator.user_id = sentinel_private.current_user_id()
      AND administrator.status = 'active'
  );
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.is_platform_administrator() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.is_platform_administrator() TO sentinel_learner_runtime;
--> statement-breakpoint
CREATE POLICY organisation_transfer_eligibility_select ON public.organisation_transfer_eligibility
  FOR SELECT TO sentinel_learner_runtime
  USING (
    sentinel_private.can_manage_learner_records(organisation_id)
    OR sentinel_private.is_platform_administrator()
  );
--> statement-breakpoint
REVOKE ALL ON TABLE public.organisation_transfer_eligibility FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON TABLE public.organisation_transfer_eligibility FROM sentinel_learner_runtime;
--> statement-breakpoint
GRANT SELECT ON TABLE public.organisation_transfer_eligibility TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.request_organisation_transfer_eligibility(
  p_organisation_id uuid,
  p_registry_issuer text,
  p_registry_identifier text,
  p_submitted_evidence_reference text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := sentinel_private.current_user_id();
  v_status text;
  v_today date;
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Institution learner-transfer administration authority is required' USING ERRCODE = '42501';
  END IF;
  IF p_registry_issuer IS NULL OR p_registry_issuer NOT IN (
    'moe_registration_number', 'nemis_uic', 'kemis_institution_id',
    'tveta_registration_number', 'other_authority'
  ) THEN
    RAISE EXCEPTION 'Select a supported official institutional identifier' USING ERRCODE = '22023';
  END IF;
  IF p_registry_identifier IS NULL OR length(btrim(p_registry_identifier)) NOT BETWEEN 3 AND 180
    OR p_submitted_evidence_reference IS NULL OR length(btrim(p_submitted_evidence_reference)) NOT BETWEEN 3 AND 180 THEN
    RAISE EXCEPTION 'An institutional identifier and secure evidence reference are required' USING ERRCODE = '22023';
  END IF;
  SELECT (now() AT TIME ZONE organisation.time_zone)::date INTO v_today
  FROM public.organisations organisation
  WHERE organisation.id = p_organisation_id AND organisation.status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Institution not found or inactive' USING ERRCODE = 'P0002'; END IF;

  INSERT INTO public.organisation_transfer_eligibility (
    organisation_id, registry_issuer, registry_identifier, status,
    submitted_evidence_reference, requested_by, requested_at, updated_at
  ) VALUES (
    p_organisation_id, p_registry_issuer, btrim(p_registry_identifier), 'pending',
    btrim(p_submitted_evidence_reference), v_actor_id, now(), now()
  )
  ON CONFLICT (organisation_id) DO UPDATE SET
    registry_issuer = EXCLUDED.registry_issuer,
    registry_identifier = EXCLUDED.registry_identifier,
    status = 'pending',
    submitted_evidence_reference = EXCLUDED.submitted_evidence_reference,
    requested_by = v_actor_id,
    requested_at = now(),
    verification_method = NULL,
    review_evidence_reference = NULL,
    reviewed_by = NULL,
    reviewed_at = NULL,
    valid_until = NULL,
    rejection_reason = NULL,
    suspended_by = NULL,
    suspended_at = NULL,
    suspension_reason = NULL,
    updated_at = now()
  WHERE public.organisation_transfer_eligibility.status IN ('rejected','suspended')
    OR (public.organisation_transfer_eligibility.status = 'verified'
      AND public.organisation_transfer_eligibility.valid_until IS NOT NULL
      AND public.organisation_transfer_eligibility.valid_until < v_today)
  RETURNING status INTO v_status;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'A pending or verified transfer-eligibility record already exists' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.audit_events(actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, 'organisation.transfer_eligibility_requested',
    'organisation_transfer_eligibility', p_organisation_id::text,
    jsonb_build_object('registryIssuer',p_registry_issuer,'registryIdentifier',btrim(p_registry_identifier),
      'evidenceReference',btrim(p_submitted_evidence_reference)));
  RETURN p_organisation_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.request_organisation_transfer_eligibility(uuid,text,text,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.request_organisation_transfer_eligibility(uuid,text,text,text) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.review_organisation_transfer_eligibility(
  p_organisation_id uuid,
  p_decision text,
  p_verification_method text,
  p_review_evidence_reference text,
  p_valid_until date,
  p_rejection_reason text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := sentinel_private.current_user_id();
  v_request public.organisation_transfer_eligibility%ROWTYPE;
  v_status text;
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.is_platform_administrator() THEN
    RAISE EXCEPTION 'Active platform-administrator authority is required' USING ERRCODE = '42501';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('verified','rejected') THEN
    RAISE EXCEPTION 'Choose a valid transfer-eligibility decision' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'verified' AND (
    p_verification_method IS NULL OR p_verification_method NOT IN ('official_registry','official_certificate','authority_confirmation','other')
    OR p_review_evidence_reference IS NULL OR length(btrim(p_review_evidence_reference)) NOT BETWEEN 3 AND 180
    OR (p_valid_until IS NOT NULL AND p_valid_until < CURRENT_DATE)
  ) THEN
    RAISE EXCEPTION 'Verification method, review evidence and a valid expiry date are required' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'rejected' AND (p_rejection_reason IS NULL OR length(btrim(p_rejection_reason)) NOT BETWEEN 3 AND 300) THEN
    RAISE EXCEPTION 'A rejection reason of 3 to 300 characters is required' USING ERRCODE = '22023';
  END IF;

  SELECT eligibility.* INTO v_request FROM public.organisation_transfer_eligibility eligibility
  WHERE eligibility.organisation_id = p_organisation_id
  FOR UPDATE;
  IF NOT FOUND OR v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Only a pending institution transfer-eligibility request can be reviewed' USING ERRCODE = '23514';
  END IF;
  IF v_request.requested_by = v_actor_id THEN
    RAISE EXCEPTION 'The requester cannot review their own institution eligibility' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.organisations WHERE id = p_organisation_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'An inactive institution cannot be verified for transfers' USING ERRCODE = '23514'; END IF;

  IF p_decision = 'verified' THEN
    UPDATE public.organisation_transfer_eligibility
    SET status = 'verified', verification_method = p_verification_method,
      review_evidence_reference = btrim(p_review_evidence_reference), reviewed_by = v_actor_id,
      reviewed_at = now(), valid_until = p_valid_until, rejection_reason = NULL,
      suspended_by = NULL, suspended_at = NULL, suspension_reason = NULL, updated_at = now()
    WHERE organisation_id = p_organisation_id
    RETURNING status INTO v_status;
  ELSE
    UPDATE public.organisation_transfer_eligibility
    SET status = 'rejected', verification_method = NULL, review_evidence_reference = NULL,
      reviewed_by = v_actor_id, reviewed_at = now(), valid_until = NULL,
      rejection_reason = btrim(p_rejection_reason), suspended_by = NULL,
      suspended_at = NULL, suspension_reason = NULL, updated_at = now()
    WHERE organisation_id = p_organisation_id
    RETURNING status INTO v_status;
  END IF;

  INSERT INTO public.audit_events(actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id,
    CASE WHEN p_decision = 'verified' THEN 'organisation.transfer_eligibility_verified' ELSE 'organisation.transfer_eligibility_rejected' END,
    'organisation_transfer_eligibility', p_organisation_id::text,
    jsonb_build_object('registryIssuer',v_request.registry_issuer,'registryIdentifier',v_request.registry_identifier,
      'decision',p_decision,'verificationMethod',p_verification_method,
      'reviewEvidenceReference',p_review_evidence_reference,'validUntil',p_valid_until,'rejectionReason',p_rejection_reason));
  RETURN v_status;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.review_organisation_transfer_eligibility(uuid,text,text,text,date,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.review_organisation_transfer_eligibility(uuid,text,text,text,date,text) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.suspend_organisation_transfer_eligibility(
  p_organisation_id uuid,
  p_suspension_reason text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_actor_id uuid := sentinel_private.current_user_id(); v_status text;
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.is_platform_administrator() THEN
    RAISE EXCEPTION 'Active platform-administrator authority is required' USING ERRCODE = '42501';
  END IF;
  IF p_suspension_reason IS NULL OR length(btrim(p_suspension_reason)) NOT BETWEEN 3 AND 300 THEN
    RAISE EXCEPTION 'A suspension reason of 3 to 300 characters is required' USING ERRCODE = '22023';
  END IF;
  UPDATE public.organisation_transfer_eligibility
  SET status = 'suspended', suspended_by = v_actor_id, suspended_at = now(),
    suspension_reason = btrim(p_suspension_reason), updated_at = now()
  WHERE organisation_id = p_organisation_id AND status = 'verified'
  RETURNING status INTO v_status;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Only a verified institution can have transfer eligibility suspended' USING ERRCODE = '23514';
  END IF;
  INSERT INTO public.audit_events(actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, 'organisation.transfer_eligibility_suspended',
    'organisation_transfer_eligibility', p_organisation_id::text,
    jsonb_build_object('suspensionReason',btrim(p_suspension_reason)));
  RETURN v_status;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.suspend_organisation_transfer_eligibility(uuid,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.suspend_organisation_transfer_eligibility(uuid,text) TO sentinel_learner_runtime;
--> statement-breakpoint

-- Re-check receiving-institution eligibility at request, acceptance and release.
-- A released transfer can still be completed if eligibility is later suspended, avoiding a stranded learner.
CREATE FUNCTION sentinel_private.enforce_verified_transfer_destination()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_organisation_status text;
  v_today date;
  v_eligibility_status text;
  v_valid_until date;
BEGIN
  IF NEW.status NOT IN ('requested','accepted','released') THEN
    RETURN NEW;
  END IF;

  SELECT organisation.status,
    (now() AT TIME ZONE organisation.time_zone)::date
  INTO v_organisation_status, v_today
  FROM public.organisations organisation
  WHERE organisation.id = NEW.receiving_organisation_id;
  IF NOT FOUND OR v_organisation_status <> 'active' THEN
    RAISE EXCEPTION 'Receiving institution is not active' USING ERRCODE = '23514';
  END IF;

  SELECT eligibility.status, eligibility.valid_until
  INTO v_eligibility_status, v_valid_until
  FROM public.organisation_transfer_eligibility eligibility
  WHERE eligibility.organisation_id = NEW.receiving_organisation_id;
  IF NOT FOUND OR v_eligibility_status <> 'verified'
    OR (v_valid_until IS NOT NULL AND v_valid_until < v_today) THEN
    RAISE EXCEPTION 'Receiving institution is not verified and transfer-eligible' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.enforce_verified_transfer_destination() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER learner_transfer_verified_destination_guard
  BEFORE INSERT OR UPDATE OF status ON public.learner_transfer_requests
  FOR EACH ROW EXECUTE FUNCTION sentinel_private.enforce_verified_transfer_destination();

--> statement-breakpoint
-- A safe destination directory exposes only organisation IDs and names, never registry evidence.
CREATE FUNCTION sentinel_private.list_verified_transfer_institutions()
RETURNS TABLE (organisation_id uuid, organisation_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
  SELECT organisation.id, organisation.name
  FROM public.organisations organisation
  INNER JOIN public.organisation_transfer_eligibility eligibility
    ON eligibility.organisation_id = organisation.id
  WHERE organisation.status = 'active'
    AND eligibility.status = 'verified'
    AND (eligibility.valid_until IS NULL
      OR eligibility.valid_until >= (now() AT TIME ZONE organisation.time_zone)::date)
  ORDER BY organisation.name
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.list_verified_transfer_institutions() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.list_verified_transfer_institutions() TO sentinel_learner_runtime;
