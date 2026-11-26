ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY organisations_platform_admin_select
  ON public.organisations
  FOR SELECT TO sentinel_learner_runtime
  USING (sentinel_private.is_platform_administrator());
--> statement-breakpoint
GRANT SELECT ON TABLE public.organisations TO sentinel_learner_runtime;
