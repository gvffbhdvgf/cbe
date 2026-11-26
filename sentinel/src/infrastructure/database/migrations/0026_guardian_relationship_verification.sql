CREATE TABLE public.guardian_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  person_id uuid NOT NULL,
  user_id uuid REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
  contact_email varchar(254),
  verification_status varchar(20) NOT NULL DEFAULT 'pending',
  status varchar(16) NOT NULL DEFAULT 'active',
  verification_method varchar(24),
  evidence_reference varchar(160),
  verified_at timestamptz,
  verified_by uuid REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  rejected_at timestamptz,
  rejected_by uuid REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  rejection_reason varchar(300),
  created_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guardian_profiles_tenant_person_fkey FOREIGN KEY (tenant_organisation_id, person_id)
    REFERENCES public.people(tenant_organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT guardian_profiles_tenant_person_unique UNIQUE (tenant_organisation_id, person_id),
  CONSTRAINT guardian_profiles_status_check CHECK (status IN ('active', 'inactive', 'suspended')),
  CONSTRAINT guardian_profiles_verification_status_check CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  CONSTRAINT guardian_profiles_contact_email_check CHECK (contact_email IS NULL OR contact_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  CONSTRAINT guardian_profiles_verification_method_check CHECK (verification_method IS NULL OR verification_method IN ('school_record', 'official_document', 'in_person', 'guardian_otp', 'other')),
  CONSTRAINT guardian_profiles_verified_check CHECK (verification_status <> 'verified' OR (verified_at IS NOT NULL AND verified_by IS NOT NULL AND verification_method IS NOT NULL AND evidence_reference IS NOT NULL)),
  CONSTRAINT guardian_profiles_rejected_check CHECK (verification_status <> 'rejected' OR (rejected_at IS NOT NULL AND rejected_by IS NOT NULL AND rejection_reason IS NOT NULL)),
  CONSTRAINT guardian_profiles_user_link_check CHECK (user_id IS NULL OR (verification_status = 'verified' AND contact_email IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX guardian_profiles_org_user_unique ON public.guardian_profiles (tenant_organisation_id, user_id) WHERE user_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX guardian_profiles_org_verification_idx ON public.guardian_profiles (tenant_organisation_id, verification_status, status);
--> statement-breakpoint
ALTER TABLE public.guardian_relationships
  ADD COLUMN verified_at timestamptz,
  ADD COLUMN verified_by uuid REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  ADD COLUMN verification_method varchar(24),
  ADD COLUMN evidence_reference varchar(160),
  ADD COLUMN rejected_at timestamptz,
  ADD COLUMN rejected_by uuid REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  ADD COLUMN rejection_reason varchar(300),
  ADD COLUMN revoked_at timestamptz,
  ADD COLUMN revoked_by uuid REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  ADD COLUMN revocation_reason varchar(300),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint
ALTER TABLE public.guardian_relationships DROP CONSTRAINT guardian_relationships_learner_guardian_unique;
--> statement-breakpoint
CREATE UNIQUE INDEX guardian_relationships_active_unique
  ON public.guardian_relationships (tenant_organisation_id, learner_id, guardian_person_id, relationship_type)
  WHERE status = 'active' AND verification_status IN ('pending', 'verified');
--> statement-breakpoint
ALTER TABLE public.guardian_relationships
  ADD CONSTRAINT guardian_relationships_relationship_type_check
    CHECK (relationship_type IN ('mother', 'father', 'parent', 'legal_guardian', 'foster_parent', 'grandparent', 'sibling', 'relative', 'other')),
  ADD CONSTRAINT guardian_relationships_verification_method_check
    CHECK (verification_method IS NULL OR verification_method IN ('school_record', 'official_document', 'in_person', 'guardian_otp', 'other')),
  ADD CONSTRAINT guardian_relationships_verified_check
    CHECK (verification_status <> 'verified' OR (verified_at IS NOT NULL AND verified_by IS NOT NULL AND verification_method IS NOT NULL AND evidence_reference IS NOT NULL)),
  ADD CONSTRAINT guardian_relationships_rejected_check
    CHECK (verification_status <> 'rejected' OR (rejected_at IS NOT NULL AND rejected_by IS NOT NULL AND rejection_reason IS NOT NULL)),
  ADD CONSTRAINT guardian_relationships_revoked_check
    CHECK (status <> 'revoked' OR (revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND revocation_reason IS NOT NULL)),
  ADD CONSTRAINT guardian_relationships_permissions_check
    CHECK (verification_status = 'verified' OR (can_view_progress = false AND can_receive_messages = false));
--> statement-breakpoint
CREATE INDEX guardian_relationships_guardian_verification_idx
  ON public.guardian_relationships (tenant_organisation_id, guardian_person_id, verification_status, status);
--> statement-breakpoint
ALTER TABLE public.guardian_profiles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.guardian_profiles FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.guardian_relationships ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.guardian_relationships FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY guardian_profiles_select_policy ON public.guardian_profiles
  FOR SELECT TO sentinel_learner_runtime
  USING (
    sentinel_private.can_manage_learner_records(tenant_organisation_id)
    OR (user_id = sentinel_private.current_user_id() AND status = 'active' AND verification_status = 'verified')
  );
--> statement-breakpoint
CREATE POLICY guardian_relationships_select_policy ON public.guardian_relationships
  FOR SELECT TO sentinel_learner_runtime
  USING (
    sentinel_private.can_manage_learner_records(tenant_organisation_id)
    OR (
      verification_status = 'verified'
      AND status = 'active'
      AND starts_at <= now()
      AND (ends_at IS NULL OR ends_at > now())
      AND (can_view_progress OR can_receive_messages)
      AND EXISTS (
        SELECT 1 FROM public.guardian_profiles gp
        WHERE gp.tenant_organisation_id = guardian_relationships.tenant_organisation_id
          AND gp.person_id = guardian_relationships.guardian_person_id
          AND gp.user_id = sentinel_private.current_user_id()
          AND gp.status = 'active'
          AND gp.verification_status = 'verified'
      )
    )
  );
--> statement-breakpoint
GRANT SELECT ON public.guardian_profiles, public.guardian_relationships TO sentinel_learner_runtime;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON public.guardian_profiles, public.guardian_relationships FROM PUBLIC, sentinel_learner_runtime;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION sentinel_private.create_guardian_relationship(
  p_organisation_id uuid,
  p_learner_id uuid,
  p_person_id uuid,
  p_first_name text,
  p_middle_name text,
  p_last_name text,
  p_preferred_name text,
  p_contact_email text,
  p_relationship_type text,
  p_starts_on date,
  p_ends_on date,
  p_confirm_distinct_person boolean
) RETURNS TABLE (guardian_profile_id uuid, relationship_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := sentinel_private.current_user_id();
  v_time_zone text;
  v_today date;
  v_person_id uuid := p_person_id;
  v_profile_id uuid;
  v_profile_status text;
  v_profile_verification text;
  v_profile_email text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_relationship_id uuid;
  v_learner_status text;
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Guardian relationship management authority is required' USING ERRCODE = '42501';
  END IF;
  SELECT o.time_zone INTO v_time_zone
  FROM public.organisations o
  WHERE o.id = p_organisation_id AND o.status = 'active';
  IF v_time_zone IS NULL THEN RAISE EXCEPTION 'Organisation not found or inactive' USING ERRCODE = 'P0002'; END IF;
  v_today := (now() AT TIME ZONE v_time_zone)::date;
  SELECT lp.status INTO v_learner_status
  FROM public.learner_profiles lp
  WHERE lp.tenant_organisation_id = p_organisation_id AND lp.id = p_learner_id
  FOR SHARE;
  IF v_learner_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'An active learner record in this organisation is required' USING ERRCODE = '23514';
  END IF;
  IF p_relationship_type IS NULL OR p_relationship_type NOT IN ('mother', 'father', 'parent', 'legal_guardian', 'foster_parent', 'grandparent', 'sibling', 'relative', 'other') THEN
    RAISE EXCEPTION 'Choose a supported guardian relationship type' USING ERRCODE = '22023';
  END IF;
  IF p_starts_on IS NULL OR (p_ends_on IS NOT NULL AND (p_ends_on <= p_starts_on OR p_ends_on <= v_today)) THEN
    RAISE EXCEPTION 'Guardian relationship dates are invalid' USING ERRCODE = '22023';
  END IF;
  IF p_contact_email IS NOT NULL AND (length(btrim(p_contact_email)) > 254 OR p_contact_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' ) THEN
    RAISE EXCEPTION 'Enter a valid guardian contact email' USING ERRCODE = '22023';
  END IF;
  v_starts_at := p_starts_on::timestamp AT TIME ZONE v_time_zone;
  v_ends_at := CASE WHEN p_ends_on IS NULL THEN NULL ELSE p_ends_on::timestamp AT TIME ZONE v_time_zone END;

  IF v_person_id IS NULL THEN
    IF p_confirm_distinct_person IS NOT TRUE THEN
      RAISE EXCEPTION 'Confirm that you checked for an existing Person record before creating a new guardian' USING ERRCODE = '22023';
    END IF;
    IF NULLIF(btrim(p_first_name), '') IS NULL OR NULLIF(btrim(p_last_name), '') IS NULL OR length(btrim(p_first_name)) > 120 OR length(btrim(p_middle_name)) > 120 OR length(btrim(p_last_name)) > 120 OR length(btrim(p_preferred_name)) > 120 THEN
      RAISE EXCEPTION 'Legal first and last names are required for a new guardian Person' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.people (tenant_organisation_id, legal_first_name, legal_middle_name, legal_last_name, preferred_name, created_by)
    VALUES (p_organisation_id, btrim(p_first_name), NULLIF(btrim(p_middle_name), ''), btrim(p_last_name), NULLIF(btrim(p_preferred_name), ''), v_actor_id)
    RETURNING id INTO v_person_id;
  ELSE
    PERFORM 1 FROM public.people
    WHERE tenant_organisation_id = p_organisation_id AND id = v_person_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Guardian Person record not found in this organisation' USING ERRCODE = 'P0002'; END IF;
  END IF;

  INSERT INTO public.guardian_profiles (tenant_organisation_id, person_id, contact_email, created_by)
  VALUES (p_organisation_id, v_person_id, lower(NULLIF(btrim(p_contact_email), '')), v_actor_id)
  ON CONFLICT (tenant_organisation_id, person_id) DO NOTHING;

  SELECT gp.id, gp.status, gp.verification_status, gp.contact_email
  INTO v_profile_id, v_profile_status, v_profile_verification, v_profile_email
  FROM public.guardian_profiles gp
  WHERE gp.tenant_organisation_id = p_organisation_id AND gp.person_id = v_person_id
  FOR UPDATE;

  IF v_profile_status <> 'active' THEN RAISE EXCEPTION 'Guardian profile is inactive or suspended' USING ERRCODE = '23514'; END IF;
  IF v_profile_verification = 'rejected' THEN
    UPDATE public.guardian_profiles
    SET verification_status = 'pending', verified_at = NULL, verified_by = NULL,
        verification_method = NULL, evidence_reference = NULL, rejected_at = NULL,
        rejected_by = NULL, rejection_reason = NULL, created_by = v_actor_id, updated_at = now()
    WHERE id = v_profile_id;
    v_profile_verification := 'pending';
  END IF;
  IF p_contact_email IS NOT NULL AND v_profile_email IS NOT NULL AND lower(btrim(p_contact_email)) <> v_profile_email THEN
    RAISE EXCEPTION 'This guardian Person already has a different contact email on file' USING ERRCODE = '23514';
  END IF;
  IF p_contact_email IS NOT NULL AND v_profile_email IS NULL THEN
    UPDATE public.guardian_profiles SET contact_email = lower(btrim(p_contact_email)), updated_at = now() WHERE id = v_profile_id;
  END IF;

  INSERT INTO public.guardian_relationships (
    tenant_organisation_id, learner_id, guardian_person_id, relationship_type,
    verification_status, status, can_view_progress, can_receive_messages,
    starts_at, ends_at, created_by
  ) VALUES (
    p_organisation_id, p_learner_id, v_person_id, p_relationship_type,
    'pending', 'active', false, false, v_starts_at, v_ends_at, v_actor_id
  ) RETURNING id INTO v_relationship_id;

  INSERT INTO public.audit_events (actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, 'guardian.relationship_created', 'guardian_relationship', v_relationship_id::text,
    jsonb_build_object('learnerId', p_learner_id, 'guardianPersonId', v_person_id, 'guardianProfileId', v_profile_id,
      'relationshipType', p_relationship_type, 'startsOn', p_starts_on, 'endsOn', p_ends_on));

  RETURN QUERY SELECT v_profile_id, v_relationship_id;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION sentinel_private.review_guardian_profile(
  p_organisation_id uuid,
  p_guardian_profile_id uuid,
  p_decision text,
  p_verification_method text,
  p_evidence_reference text,
  p_rejection_reason text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := sentinel_private.current_user_id();
  v_profile public.guardian_profiles%ROWTYPE;
  v_decision text := lower(btrim(p_decision));
  v_method text := lower(btrim(p_verification_method));
  v_evidence text := NULLIF(btrim(p_evidence_reference), '');
  v_reason text := NULLIF(btrim(p_rejection_reason), '');
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Guardian profile review authority is required' USING ERRCODE = '42501';
  END IF;
  IF v_decision IS NULL OR v_decision NOT IN ('verified', 'rejected') OR v_method IS NULL OR v_method NOT IN ('school_record', 'official_document', 'in_person', 'guardian_otp', 'other')
     OR v_evidence IS NULL OR length(v_evidence) < 3 OR length(v_evidence) > 160 OR (v_decision = 'rejected' AND (v_reason IS NULL OR length(v_reason) < 3 OR length(v_reason) > 300)) THEN
    RAISE EXCEPTION 'A valid review decision, method and evidence reference are required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_profile FROM public.guardian_profiles
  WHERE tenant_organisation_id = p_organisation_id AND id = p_guardian_profile_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Guardian profile not found' USING ERRCODE = 'P0002'; END IF;
  IF v_profile.created_by = v_actor_id THEN RAISE EXCEPTION 'The creator cannot review their own guardian profile' USING ERRCODE = '42501'; END IF;
  IF v_profile.status <> 'active' OR v_profile.verification_status <> 'pending' THEN
    RAISE EXCEPTION 'Only an active pending guardian profile can be reviewed' USING ERRCODE = '23514';
  END IF;

  IF v_decision = 'verified' THEN
    UPDATE public.guardian_profiles
    SET verification_status = 'verified', verification_method = v_method, evidence_reference = v_evidence,
        verified_at = now(), verified_by = v_actor_id, rejected_at = NULL, rejected_by = NULL,
        rejection_reason = NULL, updated_at = now()
    WHERE id = p_guardian_profile_id;
  ELSE
    UPDATE public.guardian_profiles
    SET verification_status = 'rejected', verification_method = v_method, evidence_reference = v_evidence,
        verified_at = NULL, verified_by = NULL, rejected_at = now(), rejected_by = v_actor_id,
        rejection_reason = v_reason, updated_at = now()
    WHERE id = p_guardian_profile_id;
  END IF;

  INSERT INTO public.audit_events (actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, CASE WHEN v_decision = 'verified' THEN 'guardian.profile_verified' ELSE 'guardian.profile_rejected' END,
    'guardian_profile', p_guardian_profile_id::text,
    jsonb_build_object('decision', v_decision, 'verificationMethod', v_method, 'evidenceReferenceCaptured', true));
  RETURN p_guardian_profile_id;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION sentinel_private.review_guardian_relationship(
  p_organisation_id uuid,
  p_relationship_id uuid,
  p_decision text,
  p_verification_method text,
  p_evidence_reference text,
  p_rejection_reason text,
  p_can_view_progress boolean,
  p_can_receive_messages boolean
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := sentinel_private.current_user_id();
  v_relationship public.guardian_relationships%ROWTYPE;
  v_profile_status text;
  v_profile_verification text;
  v_decision text := lower(btrim(p_decision));
  v_method text := lower(btrim(p_verification_method));
  v_evidence text := NULLIF(btrim(p_evidence_reference), '');
  v_reason text := NULLIF(btrim(p_rejection_reason), '');
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Guardian relationship review authority is required' USING ERRCODE = '42501';
  END IF;
  IF v_decision IS NULL OR v_decision NOT IN ('verified', 'rejected') OR v_method IS NULL OR v_method NOT IN ('school_record', 'official_document', 'in_person', 'guardian_otp', 'other')
     OR v_evidence IS NULL OR length(v_evidence) < 3 OR length(v_evidence) > 160 OR (v_decision = 'rejected' AND (v_reason IS NULL OR length(v_reason) < 3 OR length(v_reason) > 300)) THEN
    RAISE EXCEPTION 'A valid review decision, method and evidence reference are required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_relationship FROM public.guardian_relationships
  WHERE tenant_organisation_id = p_organisation_id AND id = p_relationship_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Guardian relationship not found' USING ERRCODE = 'P0002'; END IF;
  IF v_relationship.created_by = v_actor_id THEN RAISE EXCEPTION 'The creator cannot review their own guardian relationship' USING ERRCODE = '42501'; END IF;
  IF v_relationship.status <> 'active' OR v_relationship.verification_status <> 'pending' THEN
    RAISE EXCEPTION 'Only an active pending guardian relationship can be reviewed' USING ERRCODE = '23514';
  END IF;
  SELECT gp.status, gp.verification_status INTO v_profile_status, v_profile_verification
  FROM public.guardian_profiles gp
  WHERE gp.tenant_organisation_id = p_organisation_id AND gp.person_id = v_relationship.guardian_person_id;
  IF v_profile_status IS DISTINCT FROM 'active' OR v_profile_verification IS DISTINCT FROM 'verified' THEN
    RAISE EXCEPTION 'The guardian Person identity must be independently verified first' USING ERRCODE = '23514';
  END IF;

  IF v_decision = 'verified' THEN
    UPDATE public.guardian_relationships
    SET verification_status = 'verified', verification_method = v_method, evidence_reference = v_evidence,
        verified_at = now(), verified_by = v_actor_id, rejected_at = NULL, rejected_by = NULL,
        rejection_reason = NULL, can_view_progress = COALESCE(p_can_view_progress, false),
        can_receive_messages = COALESCE(p_can_receive_messages, false), updated_at = now()
    WHERE id = p_relationship_id;
  ELSE
    UPDATE public.guardian_relationships
    SET verification_status = 'rejected', verification_method = v_method, evidence_reference = v_evidence,
        verified_at = NULL, verified_by = NULL, rejected_at = now(), rejected_by = v_actor_id,
        rejection_reason = v_reason, can_view_progress = false, can_receive_messages = false, updated_at = now()
    WHERE id = p_relationship_id;
  END IF;

  INSERT INTO public.audit_events (actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, CASE WHEN v_decision = 'verified' THEN 'guardian.relationship_verified' ELSE 'guardian.relationship_rejected' END,
    'guardian_relationship', p_relationship_id::text,
    jsonb_build_object('decision', v_decision, 'verificationMethod', v_method, 'evidenceReferenceCaptured', true,
      'canViewProgress', CASE WHEN v_decision = 'verified' THEN COALESCE(p_can_view_progress, false) ELSE false END,
      'canReceiveMessages', CASE WHEN v_decision = 'verified' THEN COALESCE(p_can_receive_messages, false) ELSE false END));
  RETURN p_relationship_id;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION sentinel_private.link_guardian_account(
  p_organisation_id uuid,
  p_guardian_profile_id uuid,
  p_email text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := sentinel_private.current_user_id();
  v_profile public.guardian_profiles%ROWTYPE;
  v_user_id uuid;
  v_email text := lower(btrim(p_email));
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Guardian account-link authority is required' USING ERRCODE = '42501';
  END IF;
  IF v_email IS NULL OR v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Enter the guardian contact email recorded on the verified profile' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_profile FROM public.guardian_profiles
  WHERE tenant_organisation_id = p_organisation_id AND id = p_guardian_profile_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Guardian profile not found' USING ERRCODE = 'P0002'; END IF;
  IF v_profile.status <> 'active' OR v_profile.verification_status <> 'verified' OR v_profile.user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Only an active, verified, unlinked guardian profile can be linked' USING ERRCODE = '23514';
  END IF;
  IF v_profile.contact_email IS NULL OR v_profile.contact_email <> v_email THEN
    RAISE EXCEPTION 'The email must match the guardian contact email verified by the institution' USING ERRCODE = '23514';
  END IF;
  SELECT u.id INTO v_user_id FROM neon_auth."user" u
  WHERE lower(u.email) = v_email AND u."emailVerified" = true AND COALESCE(u.banned, false) = false
  LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No active email-verified account exists for this guardian email' USING ERRCODE = '23514'; END IF;
  IF EXISTS (SELECT 1 FROM public.guardian_profiles gp WHERE gp.tenant_organisation_id = p_organisation_id AND gp.user_id = v_user_id) THEN
    RAISE EXCEPTION 'This account is already linked to a guardian profile in this organisation' USING ERRCODE = '23505';
  END IF;
  UPDATE public.guardian_profiles SET user_id = v_user_id, updated_at = now() WHERE id = p_guardian_profile_id;
  INSERT INTO public.audit_events (actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, 'guardian.account_linked', 'guardian_profile', p_guardian_profile_id::text,
    jsonb_build_object('userId', v_user_id, 'emailMatchedVerifiedContact', true));
  RETURN p_guardian_profile_id;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION sentinel_private.revoke_guardian_relationship(
  p_organisation_id uuid,
  p_relationship_id uuid,
  p_reason text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := sentinel_private.current_user_id();
  v_relationship public.guardian_relationships%ROWTYPE;
  v_reason text := NULLIF(btrim(p_reason), '');
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Guardian relationship revocation authority is required' USING ERRCODE = '42501';
  END IF;
  IF v_reason IS NULL OR length(v_reason) > 300 THEN RAISE EXCEPTION 'A revocation reason is required' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_relationship FROM public.guardian_relationships
  WHERE tenant_organisation_id = p_organisation_id AND id = p_relationship_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Guardian relationship not found' USING ERRCODE = 'P0002'; END IF;
  IF v_relationship.status <> 'active' OR v_relationship.verification_status <> 'verified' THEN
    RAISE EXCEPTION 'Only an active verified guardian relationship can be revoked' USING ERRCODE = '23514';
  END IF;
  UPDATE public.guardian_relationships
  SET status = 'revoked', ends_at = GREATEST(now(), v_relationship.starts_at + interval '1 second'), revoked_at = now(), revoked_by = v_actor_id,
      revocation_reason = v_reason, can_view_progress = false, can_receive_messages = false, updated_at = now()
  WHERE id = p_relationship_id;
  INSERT INTO public.audit_events (actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, 'guardian.relationship_revoked', 'guardian_relationship', p_relationship_id::text,
    jsonb_build_object('reasonCaptured', true, 'permissionsRevoked', true));
  RETURN p_relationship_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.create_guardian_relationship(uuid,uuid,uuid,text,text,text,text,text,text,date,date,boolean) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.review_guardian_profile(uuid,uuid,text,text,text,text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.review_guardian_relationship(uuid,uuid,text,text,text,text,boolean,boolean) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.link_guardian_account(uuid,uuid,text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.revoke_guardian_relationship(uuid,uuid,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.create_guardian_relationship(uuid,uuid,uuid,text,text,text,text,text,text,date,date,boolean) TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.review_guardian_profile(uuid,uuid,text,text,text,text) TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.review_guardian_relationship(uuid,uuid,text,text,text,text,boolean,boolean) TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.link_guardian_account(uuid,uuid,text) TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.revoke_guardian_relationship(uuid,uuid,text) TO sentinel_learner_runtime;
