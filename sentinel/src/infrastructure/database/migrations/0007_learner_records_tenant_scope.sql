CREATE TABLE IF NOT EXISTS public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  legal_first_name varchar(120) NOT NULL,
  legal_middle_name varchar(120),
  legal_last_name varchar(120) NOT NULL,
  preferred_name varchar(120),
  date_of_birth date,
  created_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT people_tenant_person_unique UNIQUE (tenant_organisation_id,id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.learner_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  person_id uuid NOT NULL UNIQUE,
  learner_reference varchar(48) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learner_profiles_tenant_reference_unique UNIQUE (tenant_organisation_id,learner_reference),
  CONSTRAINT learner_profiles_tenant_id_unique UNIQUE (tenant_organisation_id,id),
  CONSTRAINT learner_profiles_tenant_person_fkey FOREIGN KEY (tenant_organisation_id,person_id) REFERENCES public.people(tenant_organisation_id,id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  academic_year integer NOT NULL CHECK (academic_year BETWEEN 2000 AND 2100),
  grade integer NOT NULL CHECK (grade BETWEEN 1 AND 9),
  class_code varchar(40) NOT NULL,
  display_name varchar(120) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classes_org_year_grade_code_unique UNIQUE (organisation_id,academic_year,grade,class_code),
  CONSTRAINT classes_tenant_org_id_grade_year_unique UNIQUE (tenant_organisation_id,organisation_id,id,grade,academic_year)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.learner_enrolments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  learner_id uuid NOT NULL,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  grade integer NOT NULL CHECK (grade BETWEEN 1 AND 9),
  academic_year integer NOT NULL CHECK (academic_year BETWEEN 2000 AND 2100),
  class_id uuid,
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','ended','transferred','withdrawn')),
  starts_at date NOT NULL DEFAULT CURRENT_DATE,
  ends_at date,
  created_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learner_enrolments_effective_dates_check CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT learner_enrolments_tenant_learner_fkey FOREIGN KEY (tenant_organisation_id,learner_id) REFERENCES public.learner_profiles(tenant_organisation_id,id) ON DELETE RESTRICT,
  CONSTRAINT learner_enrolments_tenant_class_fkey FOREIGN KEY (tenant_organisation_id,organisation_id,class_id,grade,academic_year) REFERENCES public.classes(tenant_organisation_id,organisation_id,id,grade,academic_year) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS learner_enrolments_one_active_per_learner_idx ON public.learner_enrolments (tenant_organisation_id,learner_id) WHERE status='active';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS people_tenant_name_idx ON public.people (tenant_organisation_id,legal_last_name,legal_first_name);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS learner_profiles_tenant_status_idx ON public.learner_profiles (tenant_organisation_id,status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS classes_org_grade_year_idx ON public.classes (organisation_id,grade,academic_year);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS learner_enrolments_org_grade_year_idx ON public.learner_enrolments (organisation_id,grade,academic_year,status);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.guardian_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  learner_id uuid NOT NULL,
  guardian_person_id uuid NOT NULL,
  relationship_type varchar(40) NOT NULL,
  verification_status varchar(20) NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected')),
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  can_view_progress boolean NOT NULL DEFAULT false,
  can_receive_messages boolean NOT NULL DEFAULT false,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guardian_relationships_effective_dates_check CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT guardian_relationships_learner_guardian_unique UNIQUE (tenant_organisation_id,learner_id,guardian_person_id,relationship_type),
  CONSTRAINT guardian_relationships_tenant_learner_fkey FOREIGN KEY (tenant_organisation_id,learner_id) REFERENCES public.learner_profiles(tenant_organisation_id,id) ON DELETE RESTRICT,
  CONSTRAINT guardian_relationships_tenant_guardian_fkey FOREIGN KEY (tenant_organisation_id,guardian_person_id) REFERENCES public.people(tenant_organisation_id,id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS guardian_relationships_learner_idx ON public.guardian_relationships (tenant_organisation_id,learner_id,status);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.learner_progression_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  learner_id uuid NOT NULL,
  event_type varchar(24) NOT NULL CHECK (event_type IN ('admitted','promoted','repeated','transferred_in','transferred_out','withdrawn','graduated','reinstated')),
  from_grade integer CHECK (from_grade IS NULL OR from_grade BETWEEN 1 AND 9),
  to_grade integer CHECK (to_grade IS NULL OR to_grade BETWEEN 1 AND 9),
  effective_at date NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  reason_code varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learner_progression_tenant_learner_fkey FOREIGN KEY (tenant_organisation_id,learner_id) REFERENCES public.learner_profiles(tenant_organisation_id,id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS learner_progression_tenant_learner_idx ON public.learner_progression_events (tenant_organisation_id,learner_id,effective_at);
