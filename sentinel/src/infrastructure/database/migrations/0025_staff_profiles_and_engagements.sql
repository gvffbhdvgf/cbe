-- Canonical person-linked staff profiles and effective-dated engagements.
CREATE TABLE public.staff_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  person_id uuid NOT NULL,
  staff_reference varchar(48) NOT NULL,
  staff_category varchar(32) NOT NULL,
  user_id uuid REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
  status varchar(16) NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_profiles_scope_check CHECK (tenant_organisation_id = organisation_id),
  CONSTRAINT staff_profiles_tenant_person_fkey FOREIGN KEY (tenant_organisation_id, person_id)
    REFERENCES public.people(tenant_organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT staff_profiles_tenant_org_id_unique UNIQUE (tenant_organisation_id, organisation_id, id),
  CONSTRAINT staff_profiles_org_reference_unique UNIQUE (organisation_id, staff_reference),
  CONSTRAINT staff_profiles_org_person_unique UNIQUE (organisation_id, person_id),
  CONSTRAINT staff_profiles_category_check CHECK (staff_category IN ('teacher','school_leader','administrator','support_staff','specialist','other')),
  CONSTRAINT staff_profiles_status_check CHECK (status IN ('active','inactive','archived'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX staff_profiles_org_user_unique
  ON public.staff_profiles (organisation_id, user_id) WHERE user_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX staff_profiles_org_category_status_idx
  ON public.staff_profiles (organisation_id, staff_category, status);
--> statement-breakpoint
CREATE TABLE public.staff_engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  staff_profile_id uuid NOT NULL,
  engagement_type varchar(24) NOT NULL,
  job_title varchar(120) NOT NULL,
  starts_on date NOT NULL,
  ends_on date,
  status varchar(16) NOT NULL DEFAULT 'planned',
  created_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_engagements_scope_check CHECK (tenant_organisation_id = organisation_id),
  CONSTRAINT staff_engagements_profile_fkey FOREIGN KEY (tenant_organisation_id, organisation_id, staff_profile_id)
    REFERENCES public.staff_profiles(tenant_organisation_id, organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT staff_engagements_period_check CHECK (ends_on IS NULL OR ends_on > starts_on),
  CONSTRAINT staff_engagements_type_check CHECK (engagement_type IN ('permanent','contract','casual','volunteer','internship','other')),
  CONSTRAINT staff_engagements_status_check CHECK (status IN ('planned','active','on_leave','ended','suspended')),
  CONSTRAINT staff_engagements_ended_check CHECK (status <> 'ended' OR ends_on IS NOT NULL),
  CONSTRAINT staff_engagements_tenant_org_id_unique UNIQUE (tenant_organisation_id, organisation_id, id)
);
--> statement-breakpoint
CREATE INDEX staff_engagements_profile_period_idx
  ON public.staff_engagements (tenant_organisation_id, organisation_id, staff_profile_id, starts_on, ends_on);
--> statement-breakpoint
ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.staff_profiles FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.staff_engagements ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.staff_engagements FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY staff_profiles_select
  ON public.staff_profiles FOR SELECT TO sentinel_learner_runtime
  USING (sentinel_private.can_manage_learner_records(organisation_id) OR user_id = sentinel_private.current_user_id());
--> statement-breakpoint
CREATE POLICY staff_engagements_select
  ON public.staff_engagements FOR SELECT TO sentinel_learner_runtime
  USING (
    sentinel_private.can_manage_learner_records(organisation_id)
    OR EXISTS (
      SELECT 1 FROM public.staff_profiles AS staff
      WHERE staff.tenant_organisation_id = staff_engagements.tenant_organisation_id
        AND staff.organisation_id = staff_engagements.organisation_id
        AND staff.id = staff_engagements.staff_profile_id
        AND staff.user_id = sentinel_private.current_user_id()
    )
  );
--> statement-breakpoint
REVOKE ALL ON TABLE public.staff_profiles FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON TABLE public.staff_profiles FROM sentinel_learner_runtime;
--> statement-breakpoint
REVOKE ALL ON TABLE public.staff_engagements FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON TABLE public.staff_engagements FROM sentinel_learner_runtime;
--> statement-breakpoint
GRANT SELECT ON TABLE public.staff_profiles TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT SELECT ON TABLE public.staff_engagements TO sentinel_learner_runtime;
--> statement-breakpoint
CREATE FUNCTION sentinel_private.create_staff_profile(
  p_organisation_id uuid,
  p_person_id uuid,
  p_first_name text,
  p_middle_name text,
  p_last_name text,
  p_preferred_name text,
  p_staff_reference text,
  p_staff_category text,
  p_job_title text,
  p_engagement_type text,
  p_starts_on date,
  p_ends_on date,
  p_confirm_distinct_person boolean
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := sentinel_private.current_user_id();
  v_person_id uuid := p_person_id;
  v_profile_id uuid;
  v_engagement_status varchar(16);
  v_time_zone text;
  v_today date;
  v_staff_reference varchar(48) := upper(btrim(p_staff_reference));
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Staff profile management authority is required' USING ERRCODE = '42501';
  END IF;
  SELECT time_zone INTO v_time_zone FROM public.organisations WHERE id = p_organisation_id AND status = 'active';
  IF v_time_zone IS NULL THEN RAISE EXCEPTION 'Organisation not found or inactive' USING ERRCODE = 'P0002'; END IF;
  v_today := (pg_catalog.now() AT TIME ZONE v_time_zone)::date;
  IF v_staff_reference IS NULL OR v_staff_reference !~ '^[A-Z0-9][A-Z0-9._/-]{1,47}$' THEN
    RAISE EXCEPTION 'A valid staff reference is required' USING ERRCODE = '22023';
  END IF;
  IF p_staff_category IS NULL OR p_staff_category NOT IN ('teacher','school_leader','administrator','support_staff','specialist','other') THEN
    RAISE EXCEPTION 'A valid staff category is required' USING ERRCODE = '22023';
  END IF;
  IF p_job_title IS NULL OR length(btrim(p_job_title)) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Job title must be between 2 and 120 characters' USING ERRCODE = '22023';
  END IF;
  IF p_engagement_type IS NULL OR p_engagement_type NOT IN ('permanent','contract','casual','volunteer','internship','other') THEN
    RAISE EXCEPTION 'A valid engagement type is required' USING ERRCODE = '22023';
  END IF;
  IF p_starts_on IS NULL OR (p_ends_on IS NOT NULL AND p_ends_on <= p_starts_on) THEN
    RAISE EXCEPTION 'A valid engagement date range is required' USING ERRCODE = '22023';
  END IF;

  IF v_person_id IS NULL THEN
    IF p_confirm_distinct_person IS NOT TRUE THEN RAISE EXCEPTION 'Confirm that this is a distinct person after checking the organisation register' USING ERRCODE = '22023'; END IF;
    IF p_first_name IS NULL OR length(btrim(p_first_name)) NOT BETWEEN 1 AND 120
      OR p_last_name IS NULL OR length(btrim(p_last_name)) NOT BETWEEN 1 AND 120
      OR (p_middle_name IS NOT NULL AND length(btrim(p_middle_name)) > 120)
      OR (p_preferred_name IS NOT NULL AND length(btrim(p_preferred_name)) > 120) THEN
      RAISE EXCEPTION 'Valid legal names are required when creating a new person' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.people(tenant_organisation_id,legal_first_name,legal_middle_name,legal_last_name,preferred_name,created_by)
    VALUES(p_organisation_id,btrim(p_first_name),nullif(btrim(p_middle_name),''),btrim(p_last_name),nullif(btrim(p_preferred_name),''),v_actor_id)
    RETURNING id INTO v_person_id;
  ELSE
    PERFORM 1 FROM public.people
    WHERE tenant_organisation_id = p_organisation_id AND id = v_person_id
    FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Person not found in this organisation' USING ERRCODE = 'P0002'; END IF;
  END IF;

  INSERT INTO public.staff_profiles(tenant_organisation_id,organisation_id,person_id,staff_reference,staff_category,status,created_by)
  VALUES(p_organisation_id,p_organisation_id,v_person_id,v_staff_reference,p_staff_category,'active',v_actor_id)
  RETURNING id INTO v_profile_id;

  v_engagement_status := CASE
    WHEN p_starts_on > v_today THEN 'planned'
    WHEN p_ends_on IS NOT NULL AND p_ends_on <= v_today THEN 'ended'
    ELSE 'active'
  END;
  INSERT INTO public.staff_engagements(tenant_organisation_id,organisation_id,staff_profile_id,engagement_type,job_title,starts_on,ends_on,status,created_by)
  VALUES(p_organisation_id,p_organisation_id,v_profile_id,p_engagement_type,btrim(p_job_title),p_starts_on,p_ends_on,v_engagement_status,v_actor_id);

  INSERT INTO public.audit_events(actor_user_id,organisation_id,action,resource_type,resource_id,metadata)
  VALUES(v_actor_id,p_organisation_id,'staff.profile_created','staff_profile',v_profile_id::text,
    jsonb_build_object('staffReference',v_staff_reference,'staffCategory',p_staff_category,'engagementType',p_engagement_type,'startsOn',p_starts_on,'endsOn',p_ends_on,'duplicateCheckConfirmed',p_confirm_distinct_person));
  RETURN v_profile_id;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION sentinel_private.link_staff_account(
  p_organisation_id uuid,
  p_staff_profile_id uuid,
  p_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := sentinel_private.current_user_id();
  v_profile public.staff_profiles%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Staff account-link management authority is required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_profile FROM public.staff_profiles
  WHERE id = p_staff_profile_id AND organisation_id = p_organisation_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Staff profile not found' USING ERRCODE = 'P0002'; END IF;
  IF v_profile.status <> 'active' OR v_profile.staff_category <> 'teacher' THEN
    RAISE EXCEPTION 'Only active teacher profiles can be linked to Teacher accounts' USING ERRCODE = '23514';
  END IF;
  IF v_profile.user_id IS NOT NULL AND v_profile.user_id <> p_user_id THEN
    RAISE EXCEPTION 'Staff profile is already linked to another account' USING ERRCODE = '23505';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM neon_auth."user" AS auth_user
    INNER JOIN public.organisation_memberships AS membership ON membership.user_id = auth_user.id
    WHERE auth_user.id = p_user_id AND auth_user."emailVerified" = true
      AND COALESCE(auth_user.banned,false) = false
      AND membership.organisation_id = p_organisation_id AND membership.role = 'teacher'
      AND membership.status = 'active' AND membership.starts_at <= now()
      AND (membership.ends_at IS NULL OR membership.ends_at > now())
  ) THEN
    RAISE EXCEPTION 'An active, verified Teacher membership is required' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.staff_profiles
    WHERE organisation_id = p_organisation_id AND user_id = p_user_id AND id <> p_staff_profile_id
  ) THEN RAISE EXCEPTION 'Teacher account is already linked to another staff profile' USING ERRCODE = '23505'; END IF;

  UPDATE public.staff_profiles SET user_id = p_user_id, updated_at = now() WHERE id = p_staff_profile_id;
  INSERT INTO public.audit_events(actor_user_id,organisation_id,action,resource_type,resource_id,metadata)
  VALUES(v_actor_id,p_organisation_id,'staff.account_linked','staff_profile',p_staff_profile_id::text,
    jsonb_build_object('teacherUserId',p_user_id,'staffReference',v_profile.staff_reference));
  RETURN p_staff_profile_id;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION sentinel_private.end_staff_engagement(
  p_organisation_id uuid,
  p_engagement_id uuid,
  p_ends_on date
) RETURNS date
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := sentinel_private.current_user_id();
  v_engagement public.staff_engagements%ROWTYPE;
  v_status varchar(16);
  v_time_zone text;
  v_today date;
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Staff engagement management authority is required' USING ERRCODE = '42501';
  END IF;
  SELECT time_zone INTO v_time_zone FROM public.organisations WHERE id = p_organisation_id AND status = 'active';
  IF v_time_zone IS NULL THEN RAISE EXCEPTION 'Organisation not found or inactive' USING ERRCODE = 'P0002'; END IF;
  v_today := (pg_catalog.now() AT TIME ZONE v_time_zone)::date;
  SELECT * INTO v_engagement FROM public.staff_engagements
  WHERE id = p_engagement_id AND organisation_id = p_organisation_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Staff engagement not found' USING ERRCODE = 'P0002'; END IF;
  IF v_engagement.status = 'ended' THEN RAISE EXCEPTION 'Staff engagement is already ended' USING ERRCODE = '23514'; END IF;
  IF p_ends_on IS NULL OR p_ends_on <= v_engagement.starts_on THEN
    RAISE EXCEPTION 'Engagement end date must be after its start date' USING ERRCODE = '22023';
  END IF;
  v_status := CASE WHEN p_ends_on <= v_today THEN 'ended' ELSE v_engagement.status END;
  UPDATE public.staff_engagements SET ends_on = p_ends_on, status = v_status, updated_at = now() WHERE id = p_engagement_id;
  INSERT INTO public.audit_events(actor_user_id,organisation_id,action,resource_type,resource_id,metadata)
  VALUES(v_actor_id,p_organisation_id,'staff.engagement_end_dated','staff_engagement',p_engagement_id::text,
    jsonb_build_object('endsOn',p_ends_on,'status',v_status));
  RETURN p_ends_on;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.create_staff_profile(uuid,uuid,text,text,text,text,text,text,text,text,date,date,boolean) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.link_staff_account(uuid,uuid,uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.end_staff_engagement(uuid,uuid,date) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.create_staff_profile(uuid,uuid,text,text,text,text,text,text,text,text,date,date,boolean) TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.link_staff_account(uuid,uuid,uuid) TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.end_staff_engagement(uuid,uuid,date) TO sentinel_learner_runtime;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION sentinel_private.create_teacher_class_assignment(
  p_organisation_id uuid, p_teacher_user_id uuid, p_class_id uuid, p_learning_area_id uuid,
  p_starts_on date, p_ends_on date DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_actor_id uuid := sentinel_private.current_user_id();
  v_time_zone text;
  v_starts_at timestamptz;
  v_assignment_id uuid;
  v_class public.classes%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL OR NOT sentinel_private.can_manage_learner_records(p_organisation_id) THEN
    RAISE EXCEPTION 'Teacher assignment management authority is required' USING ERRCODE = '42501';
  END IF;
  IF p_starts_on IS NULL OR (p_ends_on IS NOT NULL AND p_ends_on <= p_starts_on) THEN
    RAISE EXCEPTION 'A valid effective date range is required' USING ERRCODE = '22023';
  END IF;

  SELECT organisation.time_zone INTO v_time_zone
  FROM public.organisations AS organisation
  WHERE organisation.id = p_organisation_id AND organisation.status = 'active';
  IF v_time_zone IS NULL THEN RAISE EXCEPTION 'Organisation not found or inactive' USING ERRCODE = 'P0002'; END IF;
  v_starts_at := p_starts_on::timestamp AT TIME ZONE v_time_zone;

  SELECT class_record.* INTO v_class
  FROM public.classes AS class_record
  WHERE class_record.id = p_class_id
    AND class_record.tenant_organisation_id = p_organisation_id
    AND class_record.organisation_id = p_organisation_id
    AND class_record.status = 'active'
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active class not found in this organisation' USING ERRCODE = 'P0002'; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM neon_auth."user" AS auth_user
    INNER JOIN public.organisation_memberships AS membership
      ON membership.user_id = auth_user.id
    WHERE auth_user.id = p_teacher_user_id
      AND auth_user."emailVerified" = true
      AND COALESCE(auth_user.banned, false) = false
      AND membership.organisation_id = p_organisation_id
      AND membership.role = 'teacher'
      AND membership.status = 'active'
      AND membership.starts_at <= GREATEST(v_starts_at, pg_catalog.now())
      AND (membership.ends_at IS NULL OR membership.ends_at > GREATEST(v_starts_at, pg_catalog.now()))
  ) THEN
    RAISE EXCEPTION 'An active, verified teacher membership is required' USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.staff_profiles AS staff
    INNER JOIN public.staff_engagements AS engagement
      ON engagement.tenant_organisation_id = staff.tenant_organisation_id
      AND engagement.organisation_id = staff.organisation_id
      AND engagement.staff_profile_id = staff.id
    WHERE staff.organisation_id = p_organisation_id
      AND staff.user_id = p_teacher_user_id
      AND staff.staff_category = 'teacher'
      AND staff.status = 'active'
      AND engagement.status IN ('active', 'planned')
      AND engagement.starts_on <= p_starts_on
      AND (engagement.ends_on IS NULL OR engagement.ends_on > p_starts_on)
  ) THEN
    RAISE EXCEPTION 'An active teacher staff profile and engagement linked to this account are required' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.curriculum_learning_areas WHERE id = p_learning_area_id) THEN
    RAISE EXCEPTION 'Curriculum learning area not found' USING ERRCODE = '23503';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    p_organisation_id::text || ':' || p_teacher_user_id::text || ':' || p_class_id::text || ':' || p_learning_area_id::text, 0
  ));
  IF EXISTS (
    SELECT 1 FROM public.teacher_class_assignments AS existing
    WHERE existing.tenant_organisation_id = p_organisation_id
      AND existing.organisation_id = p_organisation_id
      AND existing.teacher_user_id = p_teacher_user_id
      AND existing.class_id = p_class_id
      AND existing.learning_area_id = p_learning_area_id
      AND existing.status = 'active'
      AND daterange(existing.starts_on, existing.ends_on, '[)')
          && daterange(p_starts_on, p_ends_on, '[)')
  ) THEN
    RAISE EXCEPTION 'An overlapping active teacher assignment already exists' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.teacher_class_assignments (
    tenant_organisation_id, organisation_id, teacher_user_id, class_id, learning_area_id,
    grade, academic_year, starts_on, ends_on, assigned_by
  ) VALUES (
    p_organisation_id, p_organisation_id, p_teacher_user_id, p_class_id, p_learning_area_id,
    v_class.grade, v_class.academic_year, p_starts_on, p_ends_on, v_actor_id
  ) RETURNING id INTO v_assignment_id;

  INSERT INTO public.audit_events (actor_user_id, organisation_id, action, resource_type, resource_id, metadata)
  VALUES (v_actor_id, p_organisation_id, 'teacher.class_assignment_created', 'teacher_class_assignment', v_assignment_id::text,
    jsonb_build_object('teacherUserId', p_teacher_user_id, 'classId', p_class_id, 'learningAreaId', p_learning_area_id,
      'grade', v_class.grade, 'academicYear', v_class.academic_year, 'startsOn', p_starts_on, 'endsOn', p_ends_on));
  RETURN v_assignment_id;
END;
$$;
