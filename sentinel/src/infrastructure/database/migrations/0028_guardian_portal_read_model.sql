-- A guardian can only see learners connected to their verified, active
-- guardian profile and a separately verified, active relationship. Progress
-- is limited to published result summaries; raw responses and marker notes
-- are never exposed by this function.
CREATE OR REPLACE FUNCTION sentinel_private.get_guardian_portal_summary()
RETURNS TABLE (
  relationship_id uuid,
  organisation_id uuid,
  organisation_name text,
  learner_id uuid,
  learner_reference text,
  learner_name text,
  relationship_type text,
  grade integer,
  academic_year integer,
  can_view_progress boolean,
  can_receive_messages boolean,
  published_progress jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, sentinel_private
AS $function$
DECLARE
  v_actor_id uuid;
BEGIN
  v_actor_id := sentinel_private.current_user_id();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    relationship.id,
    organisation.id,
    organisation.name::text,
    learner.id,
    learner.learner_reference::text,
    concat_ws(' ',
      COALESCE(NULLIF(learner_person.preferred_name, ''), learner_person.legal_first_name),
      learner_person.legal_middle_name,
      learner_person.legal_last_name
    )::text,
    relationship.relationship_type::text,
    current_enrolment.grade,
    current_enrolment.academic_year,
    relationship.can_view_progress,
    relationship.can_receive_messages,
    CASE
      WHEN relationship.can_view_progress THEN COALESCE(progress.items, '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  FROM public.guardian_profiles guardian
  INNER JOIN public.guardian_relationships relationship
    ON relationship.tenant_organisation_id = guardian.tenant_organisation_id
   AND relationship.guardian_person_id = guardian.person_id
  INNER JOIN public.learner_profiles learner
    ON learner.tenant_organisation_id = relationship.tenant_organisation_id
   AND learner.id = relationship.learner_id
   AND learner.status = 'active'
  INNER JOIN public.people learner_person
    ON learner_person.tenant_organisation_id = learner.tenant_organisation_id
   AND learner_person.id = learner.person_id
  INNER JOIN public.organisations organisation
    ON organisation.id = relationship.tenant_organisation_id
   AND organisation.status = 'active'
  LEFT JOIN LATERAL (
    SELECT
      enrolment.id,
      enrolment.grade,
      enrolment.academic_year
    FROM public.learner_enrolments enrolment
    WHERE enrolment.tenant_organisation_id = learner.tenant_organisation_id
      AND enrolment.learner_id = learner.id
      AND enrolment.status = 'active'
      AND enrolment.starts_at <= CURRENT_DATE
      AND (enrolment.ends_at IS NULL OR enrolment.ends_at > CURRENT_DATE)
    ORDER BY enrolment.academic_year DESC, enrolment.starts_at DESC, enrolment.created_at DESC
    LIMIT 1
  ) current_enrolment ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'eventTitle', published.event_title,
        'learningArea', published.learning_area,
        'grade', published.grade,
        'academicYear', published.academic_year,
        'percentage', published.percentage,
        'performanceLevel', published.performance_level_code,
        'publishedAt', published.published_at
      )
      ORDER BY published.published_at DESC
    ) AS items
    FROM (
      SELECT
        event.title AS event_title,
        learning_area.name AS learning_area,
        event.grade,
        event.academic_year,
        result.percentage,
        result.performance_level_code,
        result.latest_decision_at AS published_at
      FROM public.assessment_attempts attempt
      INNER JOIN public.assessment_events event
        ON event.id = attempt.event_id
       AND event.organisation_id = attempt.organisation_id
      INNER JOIN public.curriculum_learning_areas learning_area
        ON learning_area.id = attempt.learning_area_id
      INNER JOIN public.assessment_result_lifecycle result
        ON result.attempt_id = attempt.id
       AND result.organisation_id = attempt.organisation_id
       AND result.lifecycle_status = 'published'
      WHERE attempt.enrolment_id = current_enrolment.id
        AND attempt.tenant_organisation_id = learner.tenant_organisation_id
        AND attempt.status = 'submitted'
      ORDER BY result.latest_decision_at DESC
      LIMIT 20
    ) published
  ) progress ON true
  WHERE guardian.user_id = v_actor_id
    AND guardian.tenant_organisation_id = relationship.tenant_organisation_id
    AND guardian.status = 'active'
    AND guardian.verification_status = 'verified'
    AND guardian.verified_at IS NOT NULL
    AND relationship.status = 'active'
    AND relationship.verification_status = 'verified'
    AND (relationship.can_view_progress OR relationship.can_receive_messages)
    AND relationship.starts_at <= now()
    AND (relationship.ends_at IS NULL OR relationship.ends_at > now())
  ORDER BY organisation.name, learner.learner_reference;

  INSERT INTO public.audit_events (
    actor_user_id,
    organisation_id,
    action,
    resource_type,
    resource_id,
    metadata
  )
  SELECT
    v_actor_id,
    relationship.tenant_organisation_id,
    'guardian.portal_viewed',
    'guardian_relationship',
    relationship.id,
    jsonb_build_object(
      'learner_id', relationship.learner_id,
      'can_view_progress', relationship.can_view_progress,
      'can_receive_messages', relationship.can_receive_messages
    )
  FROM public.guardian_profiles guardian
  INNER JOIN public.guardian_relationships relationship
    ON relationship.tenant_organisation_id = guardian.tenant_organisation_id
   AND relationship.guardian_person_id = guardian.person_id
  WHERE guardian.user_id = v_actor_id
    AND guardian.status = 'active'
    AND guardian.verification_status = 'verified'
    AND relationship.status = 'active'
    AND relationship.verification_status = 'verified'
    AND (relationship.can_view_progress OR relationship.can_receive_messages)
    AND relationship.starts_at <= now()
    AND (relationship.ends_at IS NULL OR relationship.ends_at > now());
END;
$function$;

REVOKE ALL ON FUNCTION sentinel_private.get_guardian_portal_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sentinel_private.get_guardian_portal_summary() TO sentinel_learner_runtime;
