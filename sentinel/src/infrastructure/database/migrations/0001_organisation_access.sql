CREATE TABLE IF NOT EXISTS public.platform_administrators (
  user_id text PRIMARY KEY,
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.organisation_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  user_id text NOT NULL,
  role varchar(32) NOT NULL CHECK (role IN ('organisation_admin','school_admin','teacher','assessor','viewer')),
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('invited','active','suspended','revoked')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at),
  UNIQUE (organisation_id, user_id, role)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS organisation_memberships_user_status_idx ON public.organisation_memberships (user_id, status, starts_at, ends_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS organisation_memberships_org_status_idx ON public.organisation_memberships (organisation_id, status);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id text NOT NULL,
  organisation_id uuid REFERENCES public.organisations(id) ON DELETE RESTRICT,
  action varchar(120) NOT NULL,
  resource_type varchar(80) NOT NULL,
  resource_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS audit_events_org_time_idx ON public.audit_events (organisation_id, occurred_at DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS audit_events_actor_time_idx ON public.audit_events (actor_user_id, occurred_at DESC);
