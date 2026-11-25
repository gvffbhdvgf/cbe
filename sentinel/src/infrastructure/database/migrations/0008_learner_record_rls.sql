-- Requires the environment-provisioned sentinel_learner_runtime NOLOGIN role.
-- The login role is separately provisioned per environment and inherits this role.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'sentinel_learner_runtime') THEN
    RAISE EXCEPTION 'Required role sentinel_learner_runtime does not exist';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'sentinel_learner_runtime'
      AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
  ) THEN
    RAISE EXCEPTION 'sentinel_learner_runtime must be NOLOGIN, NOBYPASSRLS and non-privileged';
  END IF;
END $$;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_session_jwt;
--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS sentinel_private;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION sentinel_private.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT auth.uid()
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION sentinel_private.can_manage_learner_records(target_organisation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT sentinel_private.current_user_id() IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.platform_administrators AS pa
        WHERE pa.user_id = sentinel_private.current_user_id()
          AND pa.status = 'active'
      )
      OR EXISTS (
        SELECT 1
        FROM public.organisation_memberships AS membership
        INNER JOIN public.organisations AS organisation
          ON organisation.id = membership.organisation_id
        WHERE membership.organisation_id = target_organisation_id
          AND membership.user_id = sentinel_private.current_user_id()
          AND membership.role IN ('organisation_admin', 'school_admin')
          AND membership.status = 'active'
          AND membership.starts_at <= pg_catalog.now()
          AND (membership.ends_at IS NULL OR membership.ends_at > pg_catalog.now())
          AND organisation.status = 'active'
      )
    )
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.current_user_id() FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.can_manage_learner_records(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT USAGE ON SCHEMA sentinel_private TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.current_user_id() TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.can_manage_learner_records(uuid) TO sentinel_learner_runtime;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM sentinel_learner_runtime;
--> statement-breakpoint
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM sentinel_learner_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE public.people TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE public.learner_profiles TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT SELECT ON TABLE public.classes TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE public.learner_enrolments TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT INSERT ON TABLE public.learner_progression_events TO sentinel_learner_runtime;
--> statement-breakpoint
GRANT INSERT ON TABLE public.audit_events TO sentinel_learner_runtime;
--> statement-breakpoint
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.people FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.learner_profiles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.learner_profiles FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.classes FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.learner_enrolments ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.learner_enrolments FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.guardian_relationships ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.guardian_relationships FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.learner_progression_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.learner_progression_events FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.audit_events FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS people_tenant_select ON public.people;
--> statement-breakpoint
CREATE POLICY people_tenant_select ON public.people FOR SELECT TO sentinel_learner_runtime USING (sentinel_private.can_manage_learner_records(tenant_organisation_id));
--> statement-breakpoint
DROP POLICY IF EXISTS people_tenant_insert ON public.people;
--> statement-breakpoint
CREATE POLICY people_tenant_insert ON public.people FOR INSERT TO sentinel_learner_runtime WITH CHECK (created_by = sentinel_private.current_user_id() AND sentinel_private.can_manage_learner_records(tenant_organisation_id));
--> statement-breakpoint
DROP POLICY IF EXISTS learner_profiles_tenant_select ON public.learner_profiles;
--> statement-breakpoint
CREATE POLICY learner_profiles_tenant_select ON public.learner_profiles FOR SELECT TO sentinel_learner_runtime USING (sentinel_private.can_manage_learner_records(tenant_organisation_id));
--> statement-breakpoint
DROP POLICY IF EXISTS learner_profiles_tenant_insert ON public.learner_profiles;
--> statement-breakpoint
CREATE POLICY learner_profiles_tenant_insert ON public.learner_profiles FOR INSERT TO sentinel_learner_runtime WITH CHECK (created_by = sentinel_private.current_user_id() AND sentinel_private.can_manage_learner_records(tenant_organisation_id));
--> statement-breakpoint
DROP POLICY IF EXISTS classes_tenant_select ON public.classes;
--> statement-breakpoint
CREATE POLICY classes_tenant_select ON public.classes FOR SELECT TO sentinel_learner_runtime USING (organisation_id = tenant_organisation_id AND sentinel_private.can_manage_learner_records(tenant_organisation_id));
--> statement-breakpoint
DROP POLICY IF EXISTS learner_enrolments_tenant_select ON public.learner_enrolments;
--> statement-breakpoint
CREATE POLICY learner_enrolments_tenant_select ON public.learner_enrolments FOR SELECT TO sentinel_learner_runtime USING (organisation_id = tenant_organisation_id AND sentinel_private.can_manage_learner_records(tenant_organisation_id));
--> statement-breakpoint
DROP POLICY IF EXISTS learner_enrolments_tenant_insert ON public.learner_enrolments;
--> statement-breakpoint
CREATE POLICY learner_enrolments_tenant_insert ON public.learner_enrolments FOR INSERT TO sentinel_learner_runtime WITH CHECK (organisation_id = tenant_organisation_id AND created_by = sentinel_private.current_user_id() AND sentinel_private.can_manage_learner_records(tenant_organisation_id));
--> statement-breakpoint
DROP POLICY IF EXISTS learner_progression_events_tenant_insert ON public.learner_progression_events;
--> statement-breakpoint
CREATE POLICY learner_progression_events_tenant_insert ON public.learner_progression_events FOR INSERT TO sentinel_learner_runtime WITH CHECK (actor_user_id = sentinel_private.current_user_id() AND sentinel_private.can_manage_learner_records(tenant_organisation_id));
--> statement-breakpoint
DROP POLICY IF EXISTS audit_events_learner_insert ON public.audit_events;
--> statement-breakpoint
CREATE POLICY audit_events_learner_insert ON public.audit_events FOR INSERT TO sentinel_learner_runtime WITH CHECK (actor_user_id = sentinel_private.current_user_id() AND organisation_id IS NOT NULL AND sentinel_private.can_manage_learner_records(organisation_id));
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'sentinel_learner_login') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM sentinel_learner_login';
    EXECUTE 'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM sentinel_learner_login';
    EXECUTE 'GRANT sentinel_learner_runtime TO sentinel_learner_login';
  END IF;
END $$;
