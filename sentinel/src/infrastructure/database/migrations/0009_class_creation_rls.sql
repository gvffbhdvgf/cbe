GRANT INSERT ON TABLE public.classes TO sentinel_learner_runtime;
--> statement-breakpoint
DROP POLICY IF EXISTS classes_tenant_insert ON public.classes;
--> statement-breakpoint
CREATE POLICY classes_tenant_insert ON public.classes FOR INSERT TO sentinel_learner_runtime WITH CHECK (organisation_id = tenant_organisation_id AND created_by = sentinel_private.current_user_id() AND sentinel_private.can_manage_learner_records(tenant_organisation_id));
