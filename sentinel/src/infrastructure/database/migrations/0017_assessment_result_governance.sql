-- Governed moderation, approval and publication decisions.
-- Result rows remain immutable; the current lifecycle state is derived from append-only decisions.

CREATE FUNCTION sentinel_private.can_manage_assessment_governance(target_organisation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT sentinel_private.current_user_id() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organisations AS organisation
      WHERE organisation.id = target_organisation_id
        AND organisation.status = 'active'
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.platform_administrators AS administrator
        WHERE administrator.user_id = sentinel_private.current_user_id()
          AND administrator.status = 'active'
      )
      OR EXISTS (
        SELECT 1 FROM public.organisation_memberships AS membership
        WHERE membership.organisation_id = target_organisation_id
          AND membership.user_id = sentinel_private.current_user_id()
          AND membership.role IN ('organisation_admin','school_admin')
          AND membership.status = 'active'
          AND membership.starts_at <= pg_catalog.now()
          AND (membership.ends_at IS NULL OR membership.ends_at > pg_catalog.now())
      )
    )
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.can_manage_assessment_governance(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.can_manage_assessment_governance(uuid) TO sentinel_learner_runtime;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.record_assessment_result_decision(
  p_result_id uuid,
  p_decision_type text,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_attempt public.assessment_attempts%ROWTYPE;
  v_event public.assessment_events%ROWTYPE;
  v_result public.assessment_results%ROWTYPE;
  v_latest_decision text;
  v_decision_actor uuid;
  v_decision_id uuid;
  v_now timestamptz := pg_catalog.now();
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR pg_catalog.length(pg_catalog.btrim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required for every assessment result decision' USING ERRCODE = '22023';
  END IF;
  IF p_decision_type NOT IN (
    'moderation_approved','moderation_rejected','correction_requested',
    'result_approved','result_published'
  ) THEN
    RAISE EXCEPTION 'Unsupported assessment result decision type' USING ERRCODE = '22023';
  END IF;

  SELECT attempt.* INTO v_attempt
  FROM public.assessment_attempts AS attempt
  INNER JOIN public.assessment_results AS result
    ON result.attempt_id = attempt.id
   AND result.tenant_organisation_id = attempt.tenant_organisation_id
   AND result.organisation_id = attempt.organisation_id
  WHERE result.id = p_result_id
    AND sentinel_private.can_access_assessment_data(attempt.organisation_id)
  FOR UPDATE OF attempt;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment result not found or access denied' USING ERRCODE = 'P0002';
  END IF;

  SELECT result_record.* INTO v_result
  FROM public.assessment_results AS result_record
  WHERE result_record.id = p_result_id
    AND result_record.attempt_id = v_attempt.id
    AND result_record.tenant_organisation_id = v_attempt.tenant_organisation_id
    AND result_record.organisation_id = v_attempt.organisation_id
  FOR UPDATE;
  IF NOT FOUND OR v_result.status <> 'marked' THEN
    RAISE EXCEPTION 'Only marked assessment results can receive governance decisions' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.assessment_results AS newer
    WHERE newer.attempt_id = v_attempt.id
      AND newer.tenant_organisation_id = v_attempt.tenant_organisation_id
      AND newer.organisation_id = v_attempt.organisation_id
      AND newer.result_version > v_result.result_version
  ) THEN
    RAISE EXCEPTION 'A superseded assessment result cannot receive further decisions' USING ERRCODE = '23514';
  END IF;

  SELECT event_record.* INTO v_event
  FROM public.assessment_events AS event_record
  WHERE event_record.id = v_attempt.event_id
    AND event_record.organisation_id = v_attempt.organisation_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment event not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT decision.decision_type, decision.actor_user_id
  INTO v_latest_decision, v_decision_actor
  FROM public.assessment_result_decisions AS decision
  WHERE decision.result_id = v_result.id
    AND decision.attempt_id = v_attempt.id
    AND decision.organisation_id = v_attempt.organisation_id
  ORDER BY decision.decided_at DESC, decision.id DESC
  LIMIT 1;

  IF p_decision_type IN ('result_approved','result_published')
     AND NOT sentinel_private.can_manage_assessment_governance(v_attempt.organisation_id) THEN
    RAISE EXCEPTION 'Only an organisation or school administrator may approve or publish assessment results' USING ERRCODE = '42501';
  END IF;

  IF p_decision_type IN ('moderation_approved','moderation_rejected') THEN
    IF NOT v_event.moderation_required OR v_event.status <> 'marking' OR v_attempt.status <> 'marked' THEN
      RAISE EXCEPTION 'Moderation decisions require a marked result in an event that requires moderation' USING ERRCODE = '23514';
    END IF;
    IF v_latest_decision IS NOT NULL THEN
      RAISE EXCEPTION 'This result already has a moderation decision; use a governed correction request if needed' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.assessment_response_marks AS mark
      WHERE mark.attempt_id = v_attempt.id
        AND mark.tenant_organisation_id = v_attempt.tenant_organisation_id
        AND mark.organisation_id = v_attempt.organisation_id
        AND mark.marked_by = v_actor_id
    ) THEN
      RAISE EXCEPTION 'A marker cannot moderate their own assessment result' USING ERRCODE = '42501';
    END IF;
  ELSIF p_decision_type = 'correction_requested' THEN
    IF v_event.status <> 'marking' OR v_attempt.status <> 'marked' OR v_latest_decision <> 'moderation_rejected' THEN
      RAISE EXCEPTION 'A correction can only be requested for a result rejected during moderation' USING ERRCODE = '23514';
    END IF;
  ELSIF p_decision_type = 'result_approved' THEN
    IF v_event.status NOT IN ('marking','moderated') OR v_attempt.status NOT IN ('marked','moderated') THEN
      RAISE EXCEPTION 'Result approval requires a marked result and a completed event marking stage' USING ERRCODE = '23514';
    END IF;
    IF v_event.moderation_required AND v_latest_decision <> 'moderation_approved' THEN
      RAISE EXCEPTION 'Moderation approval is required before result approval' USING ERRCODE = '23514';
    END IF;
    IF NOT v_event.moderation_required AND v_latest_decision IS NOT NULL THEN
      RAISE EXCEPTION 'This result has an unresolved governance decision' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.assessment_response_marks AS mark
      WHERE mark.attempt_id = v_attempt.id
        AND mark.tenant_organisation_id = v_attempt.tenant_organisation_id
        AND mark.organisation_id = v_attempt.organisation_id
        AND mark.marked_by = v_actor_id
    ) OR (v_event.moderation_required AND v_decision_actor = v_actor_id) THEN
      RAISE EXCEPTION 'The result approver must be independent of its marker and moderator' USING ERRCODE = '42501';
    END IF;
  ELSIF p_decision_type = 'result_published' THEN
    IF v_event.status <> 'approved' OR v_attempt.status <> 'approved' OR v_latest_decision <> 'result_approved' THEN
      RAISE EXCEPTION 'Only an approved result in an approved event can be published' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.assessment_response_marks AS mark
      WHERE mark.attempt_id = v_attempt.id
        AND mark.tenant_organisation_id = v_attempt.tenant_organisation_id
        AND mark.organisation_id = v_attempt.organisation_id
        AND mark.marked_by = v_actor_id
    ) OR v_decision_actor = v_actor_id THEN
      RAISE EXCEPTION 'The publisher must be independent of the marker and approver' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.assessment_result_decisions (
    tenant_organisation_id, organisation_id, attempt_id, result_id,
    decision_type, reason, actor_user_id, decided_at
  ) VALUES (
    v_attempt.tenant_organisation_id, v_attempt.organisation_id, v_attempt.id, v_result.id,
    p_decision_type, pg_catalog.btrim(p_reason), v_actor_id, v_now
  ) RETURNING id INTO v_decision_id;

  IF p_decision_type = 'moderation_approved' THEN
    UPDATE public.assessment_attempts SET status = 'moderated', updated_at = v_now WHERE id = v_attempt.id;
    IF NOT EXISTS (
      SELECT 1 FROM public.assessment_attempts AS attempt
      WHERE attempt.event_id = v_event.id
        AND attempt.tenant_organisation_id = v_event.tenant_organisation_id
        AND attempt.organisation_id = v_event.organisation_id
        AND attempt.status NOT IN ('moderated','approved','voided')
    ) THEN
      UPDATE public.assessment_events SET status = 'moderated', updated_at = v_now WHERE id = v_event.id;
    END IF;
  ELSIF p_decision_type = 'result_approved' THEN
    UPDATE public.assessment_attempts SET status = 'approved', updated_at = v_now WHERE id = v_attempt.id;
    IF NOT EXISTS (
      SELECT 1 FROM public.assessment_attempts AS attempt
      WHERE attempt.event_id = v_event.id
        AND attempt.tenant_organisation_id = v_event.tenant_organisation_id
        AND attempt.organisation_id = v_event.organisation_id
        AND attempt.status NOT IN ('approved','voided')
    ) THEN
      UPDATE public.assessment_events SET status = 'approved', updated_at = v_now WHERE id = v_event.id;
    END IF;
  ELSIF p_decision_type = 'result_published' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.assessment_attempts AS attempt
      JOIN LATERAL (
        SELECT result_record.id
        FROM public.assessment_results AS result_record
        WHERE result_record.attempt_id = attempt.id
          AND result_record.tenant_organisation_id = attempt.tenant_organisation_id
          AND result_record.organisation_id = attempt.organisation_id
        ORDER BY result_record.result_version DESC
        LIMIT 1
      ) AS latest_result ON true
      WHERE attempt.event_id = v_event.id
        AND attempt.tenant_organisation_id = v_event.tenant_organisation_id
        AND attempt.organisation_id = v_event.organisation_id
        AND attempt.status <> 'voided'
        AND NOT EXISTS (
          SELECT 1 FROM public.assessment_result_decisions AS decision
          WHERE decision.result_id = latest_result.id
            AND decision.attempt_id = attempt.id
            AND decision.decision_type = 'result_published'
        )
    ) THEN
      UPDATE public.assessment_events SET status = 'published', updated_at = v_now WHERE id = v_event.id;
    END IF;
  END IF;

  INSERT INTO public.audit_events (
    actor_user_id, organisation_id, action, resource_type, resource_id, metadata
  ) VALUES (
    v_actor_id, v_attempt.organisation_id, 'assessment.result_decision_recorded',
    'assessment_result_decision', v_decision_id::text,
    jsonb_build_object(
      'resultId', v_result.id, 'attemptId', v_attempt.id,
      'decisionType', p_decision_type, 'reason', pg_catalog.btrim(p_reason),
      'decidedAt', v_now
    )
  );

  RETURN v_decision_id;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE VIEW public.assessment_result_lifecycle
WITH (security_invoker = true)
AS
SELECT
  result_record.*,
  CASE latest.decision_type
    WHEN 'moderation_approved' THEN 'moderated'
    WHEN 'moderation_rejected' THEN 'moderation_rejected'
    WHEN 'correction_requested' THEN 'correction_requested'
    WHEN 'result_approved' THEN 'approved'
    WHEN 'result_published' THEN 'published'
    WHEN 'result_superseded' THEN 'superseded'
    ELSE result_record.status
  END AS lifecycle_status,
  latest.decision_type AS latest_decision_type,
  latest.actor_user_id AS latest_decision_actor_id,
  latest.decided_at AS latest_decision_at
FROM public.assessment_results AS result_record
LEFT JOIN LATERAL (
  SELECT decision.decision_type, decision.actor_user_id, decision.decided_at
  FROM public.assessment_result_decisions AS decision
  WHERE decision.result_id = result_record.id
  ORDER BY decision.decided_at DESC, decision.id DESC
  LIMIT 1
) AS latest ON true;
--> statement-breakpoint
REVOKE ALL ON TABLE public.assessment_result_lifecycle FROM PUBLIC, sentinel_learner_runtime;
--> statement-breakpoint
GRANT SELECT ON TABLE public.assessment_result_lifecycle TO sentinel_learner_runtime;
--> statement-breakpoint

REVOKE ALL ON FUNCTION sentinel_private.record_assessment_result_decision(uuid, text, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.record_assessment_result_decision(uuid, text, text) TO sentinel_learner_runtime;
