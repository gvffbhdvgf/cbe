-- Privacy-preserving, two-institution learner transfer workflow.
CREATE TABLE public.learner_transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_reference varchar(20) NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),
  sending_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  receiving_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  source_grade integer NOT NULL CHECK (source_grade BETWEEN 1 AND 9),
  destination_grade integer NOT NULL CHECK (destination_grade BETWEEN 1 AND 9),
  destination_academic_year integer NOT NULL CHECK (destination_academic_year BETWEEN 2000 AND 2100),
  effective_at date NOT NULL,
  reason_code varchar(32) NOT NULL CHECK (reason_code IN ('family_relocation','school_change','placement_change','other')),
  status varchar(16) NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','accepted','rejected','released','completed','cancelled')),
  rejection_code varchar(32) CHECK (rejection_code IS NULL OR rejection_code IN ('not_eligible','missing_documentation','capacity_unavailable','other')),
  requested_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  requested_at timestamptz NOT NULL DEFAULT now(),
  accepted_by uuid REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  accepted_at timestamptz,
  rejected_by uuid REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  rejected_at timestamptz,
  released_by uuid REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  released_at timestamptz,
  completed_by uuid REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  completed_at timestamptz,
  cancelled_by uuid REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learner_transfer_distinct_organisations_check CHECK (sending_organisation_id <> receiving_organisation_id),
  CONSTRAINT learner_transfer_rejection_state_check CHECK ((status = 'rejected') = (rejection_code IS NOT NULL)),
  CONSTRAINT learner_transfer_requests_id_sender_unique UNIQUE (id, sending_organisation_id),
  CONSTRAINT learner_transfer_requests_id_receiver_unique UNIQUE (id, receiving_organisation_id)
);
--> statement-breakpoint
CREATE INDEX learner_transfer_requests_sender_status_idx
  ON public.learner_transfer_requests (sending_organisation_id, status, requested_at DESC);
--> statement-breakpoint
CREATE INDEX learner_transfer_requests_receiver_status_idx
  ON public.learner_transfer_requests (receiving_organisation_id, status, requested_at DESC);
--> statement-breakpoint
CREATE TABLE public.learner_transfer_source_links (
  transfer_request_id uuid PRIMARY KEY,
  sending_organisation_id uuid NOT NULL,
  source_learner_id uuid NOT NULL,
  source_enrolment_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learner_transfer_source_request_fk
    FOREIGN KEY (transfer_request_id, sending_organisation_id)
    REFERENCES public.learner_transfer_requests(id, sending_organisation_id) ON DELETE RESTRICT,
  CONSTRAINT learner_transfer_source_learner_fk
    FOREIGN KEY (sending_organisation_id, source_learner_id)
    REFERENCES public.learner_profiles(tenant_organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT learner_transfer_source_enrolment_fk
    FOREIGN KEY (sending_organisation_id, sending_organisation_id, source_enrolment_id, source_learner_id)
    REFERENCES public.learner_enrolments(tenant_organisation_id, organisation_id, id, learner_id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX learner_transfer_source_enrolment_idx
  ON public.learner_transfer_source_links (sending_organisation_id, source_enrolment_id);
--> statement-breakpoint
CREATE TABLE public.learner_transfer_destination_links (
  transfer_request_id uuid PRIMARY KEY,
  receiving_organisation_id uuid NOT NULL,
  destination_learner_id uuid NOT NULL,
  destination_enrolment_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learner_transfer_destination_request_fk
    FOREIGN KEY (transfer_request_id, receiving_organisation_id)
    REFERENCES public.learner_transfer_requests(id, receiving_organisation_id) ON DELETE RESTRICT,
  CONSTRAINT learner_transfer_destination_learner_fk
    FOREIGN KEY (receiving_organisation_id, destination_learner_id)
    REFERENCES public.learner_profiles(tenant_organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT learner_transfer_destination_enrolment_fk
    FOREIGN KEY (receiving_organisation_id, receiving_organisation_id, destination_enrolment_id, destination_learner_id)
    REFERENCES public.learner_enrolments(tenant_organisation_id, organisation_id, id, learner_id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX learner_transfer_destination_enrolment_idx
  ON public.learner_transfer_destination_links (receiving_organisation_id, destination_enrolment_id);
--> statement-breakpoint

-- A scheduled placement that has not begun when a transfer takes effect is cancelled, not deleted.
ALTER TABLE public.learner_class_placements DROP CONSTRAINT learner_class_placements_period_check;
--> statement-breakpoint
ALTER TABLE public.learner_class_placements ADD CONSTRAINT learner_class_placements_period_check
  CHECK (ends_at IS NULL OR ends_at > starts_at OR (status = 'cancelled' AND ends_at = starts_at));
--> statement-breakpoint
ALTER TABLE public.learner_class_placements DROP CONSTRAINT learner_class_placements_status_check;
--> statement-breakpoint
ALTER TABLE public.learner_class_placements ADD CONSTRAINT learner_class_placements_status_check
  CHECK (status IN ('active','ended','cancelled'));
--> statement-breakpoint

ALTER TABLE public.learner_transfer_requests ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.learner_transfer_requests FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.learner_transfer_source_links ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.learner_transfer_source_links FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.learner_transfer_destination_links ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.learner_transfer_destination_links FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY learner_transfer_requests_select ON public.learner_transfer_requests
  FOR SELECT TO sentinel_learner_runtime
  USING (
    sentinel_private.can_manage_learner_records(sending_organisation_id)
    OR sentinel_private.can_manage_learner_records(receiving_organisation_id)
  );
--> statement-breakpoint
CREATE POLICY learner_transfer_source_links_select ON public.learner_transfer_source_links
  FOR SELECT TO sentinel_learner_runtime
  USING (sentinel_private.can_manage_learner_records(sending_organisation_id));
--> statement-breakpoint
CREATE POLICY learner_transfer_destination_links_select ON public.learner_transfer_destination_links
  FOR SELECT TO sentinel_learner_runtime
  USING (sentinel_private.can_manage_learner_records(receiving_organisation_id));
--> statement-breakpoint
REVOKE ALL ON TABLE public.learner_transfer_requests FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON TABLE public.learner_transfer_requests FROM sentinel_learner_runtime;
--> statement-breakpoint
REVOKE ALL ON TABLE public.learner_transfer_source_links FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON TABLE public.learner_transfer_source_links FROM sentinel_learner_runtime;
--> statement-breakpoint
REVOKE ALL ON TABLE public.learner_transfer_destination_links FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON TABLE public.learner_transfer_destination_links FROM sentinel_learner_runtime;
--> statement-breakpoint
GRANT SELECT ON TABLE public.learner_transfer_requests TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT SELECT ON TABLE public.learner_transfer_source_links TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT SELECT ON TABLE public.learner_transfer_destination_links TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.request_learner_transfer(
  p_sending_organisation_id uuid,
  p_source_enrolment_id uuid,
  p_receiving_organisation_id uuid,
  p_destination_grade integer,
  p_destination_academic_year integer,
  p_effective_at date,
  p_reason_code text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := sentinel_private.current_user_id();
  v_source public.learner_enrolments%ROWTYPE;
  v_today date;
  v_time_zone text;
  v_request_id uuid;
  v_reference text;
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_sending_organisation_id) THEN
    RAISE EXCEPTION 'Sending institution learner-transfer authority is required' USING ERRCODE = '42501';
  END IF;
  IF p_sending_organisation_id = p_receiving_organisation_id THEN
    RAISE EXCEPTION 'A learner transfer requires two different institutions' USING ERRCODE = '22023';
  END IF;
  IF p_destination_grade NOT BETWEEN 1 AND 9 OR p_destination_academic_year NOT BETWEEN 2000 AND 2100 THEN
    RAISE EXCEPTION 'Destination grade or academic year is outside the supported range' USING ERRCODE = '22023';
  END IF;
  IF p_reason_code IS NULL OR p_reason_code NOT IN ('family_relocation','school_change','placement_change','other') THEN
    RAISE EXCEPTION 'A valid learner-transfer reason code is required' USING ERRCODE = '22023';
  END IF;
  SELECT (pg_catalog.now() AT TIME ZONE organisation.time_zone)::date, organisation.time_zone
    INTO v_today, v_time_zone
  FROM public.organisations organisation
  WHERE organisation.id = p_sending_organisation_id AND organisation.status = 'active';
  IF v_today IS NULL THEN RAISE EXCEPTION 'Sending institution not found or inactive' USING ERRCODE = 'P0002'; END IF;
  PERFORM 1 FROM public.organisations
  WHERE id = p_receiving_organisation_id AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'Receiving institution not found or inactive' USING ERRCODE = 'P0002'; END IF;

  SELECT enrolment.* INTO v_source
  FROM public.learner_enrolments enrolment
  WHERE enrolment.id = p_source_enrolment_id
    AND enrolment.organisation_id = p_sending_organisation_id
    AND enrolment.status = 'active'
    AND sentinel_private.can_manage_learner_records(enrolment.tenant_organisation_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'An active source learner enrolment is required' USING ERRCODE = '23514'; END IF;
  IF p_effective_at IS NULL OR p_effective_at < v_today OR p_effective_at <= v_source.starts_at
    OR (v_source.ends_at IS NOT NULL AND p_effective_at >= v_source.ends_at) THEN
    RAISE EXCEPTION 'Transfer effective date must be today or later and fall after the source enrolment start' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.learner_transfer_source_links source_link
    JOIN public.learner_transfer_requests transfer ON transfer.id = source_link.transfer_request_id
    WHERE source_link.source_enrolment_id = p_source_enrolment_id
      AND source_link.sending_organisation_id = p_sending_organisation_id
      AND transfer.status IN ('requested','accepted','released')
  ) THEN
    RAISE EXCEPTION 'This enrolment already has an open learner transfer request' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.learner_transfer_requests(
    sending_organisation_id, receiving_organisation_id, source_grade, destination_grade,
    destination_academic_year, effective_at, reason_code, requested_by
  ) VALUES (
    p_sending_organisation_id, p_receiving_organisation_id, v_source.grade, p_destination_grade,
    p_destination_academic_year, p_effective_at, p_reason_code, v_actor_id
  ) RETURNING id, transfer_reference INTO v_request_id, v_reference;

  INSERT INTO public.learner_transfer_source_links(
    transfer_request_id, sending_organisation_id, source_learner_id, source_enrolment_id
  ) VALUES (v_request_id, p_sending_organisation_id, v_source.learner_id, v_source.id);

  INSERT INTO public.audit_events(actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_sending_organisation_id, 'learner.transfer_requested', 'learner_transfer_request', v_request_id::text,
    jsonb_build_object('transferReference',v_reference,'receivingOrganisationId',p_receiving_organisation_id,
      'sourceGrade',v_source.grade,'destinationGrade',p_destination_grade,
      'destinationAcademicYear',p_destination_academic_year,'effectiveAt',p_effective_at,'reasonCode',p_reason_code));
  RETURN v_request_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.request_learner_transfer(uuid,uuid,uuid,integer,integer,date,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.request_learner_transfer(uuid,uuid,uuid,integer,integer,date,text) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.accept_learner_transfer(p_receiving_organisation_id uuid, p_transfer_request_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_actor_id uuid := sentinel_private.current_user_id(); v_request public.learner_transfer_requests%ROWTYPE; v_now timestamptz := pg_catalog.now();
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_receiving_organisation_id) THEN
    RAISE EXCEPTION 'Receiving institution learner-transfer authority is required' USING ERRCODE = '42501';
  END IF;
  SELECT request.* INTO v_request FROM public.learner_transfer_requests request
  WHERE request.id = p_transfer_request_id AND request.receiving_organisation_id = p_receiving_organisation_id
  FOR UPDATE;
  IF NOT FOUND OR v_request.status <> 'requested' THEN
    RAISE EXCEPTION 'Only a requested transfer addressed to this institution can be accepted' USING ERRCODE = '23514';
  END IF;
  UPDATE public.learner_transfer_requests
  SET status = 'accepted', accepted_by = v_actor_id, accepted_at = v_now, updated_at = v_now
  WHERE id = p_transfer_request_id;
  INSERT INTO public.audit_events(actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_receiving_organisation_id, 'learner.transfer_accepted', 'learner_transfer_request', p_transfer_request_id::text,
    jsonb_build_object('transferReference',v_request.transfer_reference,'sendingOrganisationId',v_request.sending_organisation_id));
  RETURN v_now;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.accept_learner_transfer(uuid,uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.accept_learner_transfer(uuid,uuid) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.reject_learner_transfer(
  p_receiving_organisation_id uuid, p_transfer_request_id uuid, p_rejection_code text
) RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_actor_id uuid := sentinel_private.current_user_id(); v_request public.learner_transfer_requests%ROWTYPE; v_now timestamptz := pg_catalog.now();
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_receiving_organisation_id) THEN
    RAISE EXCEPTION 'Receiving institution learner-transfer authority is required' USING ERRCODE = '42501';
  END IF;
  IF p_rejection_code IS NULL OR p_rejection_code NOT IN ('not_eligible','missing_documentation','capacity_unavailable','other') THEN
    RAISE EXCEPTION 'A valid transfer rejection code is required' USING ERRCODE = '22023';
  END IF;
  SELECT request.* INTO v_request FROM public.learner_transfer_requests request
  WHERE request.id = p_transfer_request_id AND request.receiving_organisation_id = p_receiving_organisation_id
  FOR UPDATE;
  IF NOT FOUND OR v_request.status <> 'requested' THEN
    RAISE EXCEPTION 'Only a requested transfer addressed to this institution can be rejected' USING ERRCODE = '23514';
  END IF;
  UPDATE public.learner_transfer_requests
  SET status = 'rejected', rejection_code = p_rejection_code, rejected_by = v_actor_id, rejected_at = v_now, updated_at = v_now
  WHERE id = p_transfer_request_id;
  INSERT INTO public.audit_events(actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_receiving_organisation_id, 'learner.transfer_rejected', 'learner_transfer_request', p_transfer_request_id::text,
    jsonb_build_object('transferReference',v_request.transfer_reference,'rejectionCode',p_rejection_code));
  RETURN v_now;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.reject_learner_transfer(uuid,uuid,text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.reject_learner_transfer(uuid,uuid,text) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.cancel_learner_transfer(p_sending_organisation_id uuid, p_transfer_request_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE v_actor_id uuid := sentinel_private.current_user_id(); v_request public.learner_transfer_requests%ROWTYPE; v_now timestamptz := pg_catalog.now();
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_sending_organisation_id) THEN
    RAISE EXCEPTION 'Sending institution learner-transfer authority is required' USING ERRCODE = '42501';
  END IF;
  SELECT request.* INTO v_request FROM public.learner_transfer_requests request
  WHERE request.id = p_transfer_request_id AND request.sending_organisation_id = p_sending_organisation_id
  FOR UPDATE;
  IF NOT FOUND OR v_request.status NOT IN ('requested','accepted') THEN
    RAISE EXCEPTION 'Only a requested or accepted transfer can be cancelled before release' USING ERRCODE = '23514';
  END IF;
  UPDATE public.learner_transfer_requests
  SET status = 'cancelled', cancelled_by = v_actor_id, cancelled_at = v_now, updated_at = v_now
  WHERE id = p_transfer_request_id;
  INSERT INTO public.audit_events(actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_sending_organisation_id, 'learner.transfer_cancelled', 'learner_transfer_request', p_transfer_request_id::text,
    jsonb_build_object('transferReference',v_request.transfer_reference,'receivingOrganisationId',v_request.receiving_organisation_id));
  RETURN v_now;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.cancel_learner_transfer(uuid,uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.cancel_learner_transfer(uuid,uuid) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.release_learner_transfer(p_sending_organisation_id uuid, p_transfer_request_id uuid)
RETURNS date
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := sentinel_private.current_user_id();
  v_request public.learner_transfer_requests%ROWTYPE;
  v_source_link public.learner_transfer_source_links%ROWTYPE;
  v_source public.learner_enrolments%ROWTYPE;
  v_today date;
  v_time_zone text;
  v_effective_at_ts timestamptz;
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_sending_organisation_id) THEN
    RAISE EXCEPTION 'Sending institution learner-transfer authority is required' USING ERRCODE = '42501';
  END IF;
  SELECT (pg_catalog.now() AT TIME ZONE organisation.time_zone)::date, organisation.time_zone
    INTO v_today, v_time_zone
  FROM public.organisations organisation
  WHERE organisation.id = p_sending_organisation_id AND organisation.status = 'active';
  SELECT request.* INTO v_request FROM public.learner_transfer_requests request
  WHERE request.id = p_transfer_request_id AND request.sending_organisation_id = p_sending_organisation_id
  FOR UPDATE;
  IF NOT FOUND OR v_request.status <> 'accepted' THEN
    RAISE EXCEPTION 'Only an accepted transfer can be released by the sending institution' USING ERRCODE = '23514';
  END IF;
  IF v_request.effective_at > v_today THEN
    RAISE EXCEPTION 'A transfer cannot be released before its effective date in the sending institution timezone' USING ERRCODE = '23514';
  END IF;
  SELECT source_link.* INTO v_source_link FROM public.learner_transfer_source_links source_link
  WHERE source_link.transfer_request_id = p_transfer_request_id
    AND source_link.sending_organisation_id = p_sending_organisation_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source transfer link not found' USING ERRCODE = 'P0002'; END IF;
  SELECT enrolment.* INTO v_source FROM public.learner_enrolments enrolment
  WHERE enrolment.id = v_source_link.source_enrolment_id
    AND enrolment.learner_id = v_source_link.source_learner_id
    AND enrolment.organisation_id = p_sending_organisation_id
    AND enrolment.status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Source enrolment is no longer active' USING ERRCODE = '23514'; END IF;
  IF v_request.effective_at <= v_source.starts_at
    OR (v_source.ends_at IS NOT NULL AND v_request.effective_at >= v_source.ends_at) THEN
    RAISE EXCEPTION 'Transfer effective date is outside the source enrolment period' USING ERRCODE = '23514';
  END IF;
  v_effective_at_ts := v_request.effective_at::timestamp AT TIME ZONE v_time_zone;

  UPDATE public.learner_class_placements placement
  SET status = CASE WHEN placement.starts_at >= v_effective_at_ts THEN 'cancelled' ELSE 'ended' END,
      ends_at = CASE WHEN placement.starts_at >= v_effective_at_ts THEN placement.starts_at ELSE v_effective_at_ts END,
      reason = CASE WHEN placement.starts_at >= v_effective_at_ts
        THEN 'Transfer took effect before the scheduled class placement began'
        ELSE 'Learner transfer to another institution' END
  WHERE placement.enrolment_id = v_source.id AND placement.status = 'active';

  UPDATE public.learner_enrolments
  SET status = 'transferred', ends_at = v_request.effective_at, updated_at = pg_catalog.now()
  WHERE id = v_source.id;

  INSERT INTO public.learner_progression_events(
    tenant_organisation_id, learner_id, event_type, from_grade, to_grade, effective_at, actor_user_id, reason_code
  ) VALUES (
    p_sending_organisation_id, v_source.learner_id, 'transferred_out', v_source.grade,
    v_request.destination_grade, v_request.effective_at, v_actor_id, v_request.reason_code
  );

  UPDATE public.learner_transfer_requests
  SET status = 'released', released_by = v_actor_id, released_at = pg_catalog.now(), updated_at = pg_catalog.now()
  WHERE id = p_transfer_request_id;

  INSERT INTO public.audit_events(actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_sending_organisation_id, 'learner.transfer_released', 'learner_transfer_request', p_transfer_request_id::text,
    jsonb_build_object('transferReference',v_request.transfer_reference,'effectiveAt',v_request.effective_at,
      'sourceEnrolmentId',v_source.id,'sourceLearnerId',v_source.learner_id));
  RETURN v_request.effective_at;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.release_learner_transfer(uuid,uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.release_learner_transfer(uuid,uuid) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.complete_learner_transfer(
  p_receiving_organisation_id uuid,
  p_transfer_request_id uuid,
  p_destination_learner_id uuid,
  p_destination_enrolment_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := sentinel_private.current_user_id();
  v_request public.learner_transfer_requests%ROWTYPE;
  v_destination public.learner_enrolments%ROWTYPE;
  v_profile public.learner_profiles%ROWTYPE;
  v_today date;
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_receiving_organisation_id) THEN
    RAISE EXCEPTION 'Receiving institution learner-transfer authority is required' USING ERRCODE = '42501';
  END IF;
  SELECT (pg_catalog.now() AT TIME ZONE organisation.time_zone)::date INTO v_today
  FROM public.organisations organisation
  WHERE organisation.id = p_receiving_organisation_id AND organisation.status = 'active';
  SELECT request.* INTO v_request FROM public.learner_transfer_requests request
  WHERE request.id = p_transfer_request_id AND request.receiving_organisation_id = p_receiving_organisation_id
  FOR UPDATE;
  IF NOT FOUND OR v_request.status <> 'released' THEN
    RAISE EXCEPTION 'Only a released transfer addressed to this institution can be completed' USING ERRCODE = '23514';
  END IF;
  IF v_request.effective_at > v_today THEN
    RAISE EXCEPTION 'A transfer cannot be completed before its effective date in the receiving institution timezone' USING ERRCODE = '23514';
  END IF;
  SELECT profile.* INTO v_profile FROM public.learner_profiles profile
  WHERE profile.id = p_destination_learner_id
    AND profile.tenant_organisation_id = p_receiving_organisation_id
    AND profile.status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'An active local learner profile is required' USING ERRCODE = '23514'; END IF;
  SELECT enrolment.* INTO v_destination FROM public.learner_enrolments enrolment
  WHERE enrolment.id = p_destination_enrolment_id
    AND enrolment.learner_id = p_destination_learner_id
    AND enrolment.tenant_organisation_id = p_receiving_organisation_id
    AND enrolment.organisation_id = p_receiving_organisation_id
  FOR UPDATE;
  IF NOT FOUND OR v_destination.status <> 'active'
    OR v_destination.grade <> v_request.destination_grade
    OR v_destination.academic_year <> v_request.destination_academic_year
    OR v_destination.starts_at <> v_request.effective_at
    OR v_destination.class_id IS NOT NULL THEN
    RAISE EXCEPTION 'Destination enrolment must be active, unassigned, and match the approved grade, year and effective date' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.learner_transfer_destination_links link
    WHERE link.transfer_request_id = p_transfer_request_id
  ) THEN RAISE EXCEPTION 'This transfer already has a destination learner link' USING ERRCODE = '23514'; END IF;

  INSERT INTO public.learner_transfer_destination_links(
    transfer_request_id, receiving_organisation_id, destination_learner_id, destination_enrolment_id
  ) VALUES (p_transfer_request_id, p_receiving_organisation_id, p_destination_learner_id, p_destination_enrolment_id);

  INSERT INTO public.learner_progression_events(
    tenant_organisation_id, learner_id, event_type, from_grade, to_grade, effective_at, actor_user_id, reason_code
  ) VALUES (
    p_receiving_organisation_id, p_destination_learner_id, 'transferred_in', v_request.source_grade,
    v_request.destination_grade, v_request.effective_at, v_actor_id, v_request.reason_code
  );

  UPDATE public.learner_transfer_requests
  SET status = 'completed', completed_by = v_actor_id, completed_at = pg_catalog.now(), updated_at = pg_catalog.now()
  WHERE id = p_transfer_request_id;

  INSERT INTO public.audit_events(actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_receiving_organisation_id, 'learner.transfer_completed', 'learner_transfer_request', p_transfer_request_id::text,
    jsonb_build_object('transferReference',v_request.transfer_reference,'destinationLearnerId',p_destination_learner_id,
      'destinationEnrolmentId',p_destination_enrolment_id,'effectiveAt',v_request.effective_at));
  RETURN p_destination_learner_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.complete_learner_transfer(uuid,uuid,uuid,uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.complete_learner_transfer(uuid,uuid,uuid,uuid) TO sentinel_learner_runtime;
