-- Assessment lifecycle foundation. This migration is additive and scoped to the isolated development branch.
-- Assessment writes remain unavailable to the runtime role until controlled server-side
-- operations are introduced; this prevents callers from bypassing lifecycle transitions.

ALTER TABLE public.learner_enrolments
  ADD CONSTRAINT learner_enrolments_assessment_scope_unique
  UNIQUE (tenant_organisation_id, organisation_id, id, grade, academic_year);
--> statement-breakpoint

CREATE TABLE public.assessment_programmes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  programme_code varchar(64) NOT NULL,
  title varchar(180) NOT NULL,
  programme_type varchar(24) NOT NULL CHECK (programme_type IN ('formative','summative','diagnostic')),
  status varchar(16) NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_programmes_tenant_scope_check CHECK (tenant_organisation_id = organisation_id),
  CONSTRAINT assessment_programmes_scope_id_unique UNIQUE (tenant_organisation_id, organisation_id, id),
  CONSTRAINT assessment_programmes_code_unique UNIQUE (tenant_organisation_id, organisation_id, programme_code)
);
--> statement-breakpoint

CREATE TABLE public.assessment_instrument_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE RESTRICT,
  learning_area_id uuid NOT NULL REFERENCES public.curriculum_learning_areas(id) ON DELETE RESTRICT,
  grade integer NOT NULL CHECK (grade BETWEEN 1 AND 9),
  instrument_code varchar(64) NOT NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  title varchar(180) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','retired')),
  created_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_instruments_tenant_scope_check CHECK (tenant_organisation_id = organisation_id),
  CONSTRAINT assessment_instruments_scope_id_unique UNIQUE (tenant_organisation_id, organisation_id, id),
  CONSTRAINT assessment_instruments_scope_grade_area_unique UNIQUE (tenant_organisation_id, organisation_id, id, grade, learning_area_id),
  CONSTRAINT assessment_instruments_code_version_unique UNIQUE (tenant_organisation_id, organisation_id, instrument_code, version_number),
  CONSTRAINT assessment_instruments_approval_check CHECK ((status <> 'approved') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
--> statement-breakpoint

CREATE TABLE public.assessment_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL,
  organisation_id uuid NOT NULL,
  instrument_version_id uuid NOT NULL,
  task_code varchar(40) NOT NULL,
  title varchar(200) NOT NULL,
  response_type varchar(24) NOT NULL CHECK (response_type IN ('text','numeric','boolean','choice','observation','evidence')),
  maximum_score numeric(10,2) NOT NULL CHECK (maximum_score > 0 AND maximum_score <= 100000),
  required boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_tasks_instrument_fk FOREIGN KEY (tenant_organisation_id, organisation_id, instrument_version_id)
    REFERENCES public.assessment_instrument_versions (tenant_organisation_id, organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT assessment_tasks_scope_id_unique UNIQUE (tenant_organisation_id, organisation_id, id, instrument_version_id),
  CONSTRAINT assessment_tasks_code_unique UNIQUE (tenant_organisation_id, organisation_id, instrument_version_id, task_code)
);
--> statement-breakpoint

CREATE TABLE public.assessment_task_outcome_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL,
  organisation_id uuid NOT NULL,
  task_id uuid NOT NULL,
  instrument_version_id uuid NOT NULL,
  curriculum_source_node_id uuid NOT NULL REFERENCES public.curriculum_source_nodes(id) ON DELETE RESTRICT,
  status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  reviewed_at timestamptz,
  review_note text,
  created_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_task_outcome_task_fk FOREIGN KEY (tenant_organisation_id, organisation_id, task_id, instrument_version_id)
    REFERENCES public.assessment_tasks (tenant_organisation_id, organisation_id, id, instrument_version_id) ON DELETE RESTRICT,
  CONSTRAINT assessment_task_outcome_review_check CHECK (status <> 'approved' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
  CONSTRAINT assessment_task_outcome_unique UNIQUE (tenant_organisation_id, organisation_id, task_id, curriculum_source_node_id)
);
--> statement-breakpoint

CREATE FUNCTION sentinel_private.validate_assessment_outcome_mapping()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_valid boolean;
BEGIN
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.assessment_instrument_versions AS instrument
    JOIN public.assessment_tasks AS task
      ON task.instrument_version_id = instrument.id
     AND task.tenant_organisation_id = instrument.tenant_organisation_id
     AND task.organisation_id = instrument.organisation_id
    JOIN public.curriculum_source_nodes AS node
      ON node.id = NEW.curriculum_source_node_id
    JOIN public.curriculum_design_documents AS document
      ON document.id = node.document_id
    JOIN public.curriculum_grade_offerings AS offering
      ON offering.id = document.grade_offering_id
    WHERE task.id = NEW.task_id
      AND instrument.id = NEW.instrument_version_id
      AND instrument.tenant_organisation_id = NEW.tenant_organisation_id
      AND instrument.organisation_id = NEW.organisation_id
      AND node.node_type = 'specific_outcome'
      AND node.extraction_status = 'approved'
      AND document.review_status = 'approved'
      AND document.rights_status = 'confirmed'
      AND offering.grade = instrument.grade
      AND offering.learning_area_id = instrument.learning_area_id
  ) INTO v_valid;

  IF NOT v_valid THEN
    RAISE EXCEPTION 'Outcome mapping requires an approved specific outcome from a rights-cleared curriculum document for the same grade and learning area'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.reviewed_by IS NULL OR NEW.reviewed_at IS NULL THEN
    RAISE EXCEPTION 'Approved outcome mappings require reviewer identity and timestamp'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER assessment_outcome_mapping_validation
BEFORE INSERT OR UPDATE ON public.assessment_task_outcome_mappings
FOR EACH ROW EXECUTE FUNCTION sentinel_private.validate_assessment_outcome_mapping();
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.validate_assessment_outcome_mapping() FROM PUBLIC;
--> statement-breakpoint

CREATE TABLE public.assessment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL,
  organisation_id uuid NOT NULL,
  programme_id uuid NOT NULL,
  instrument_version_id uuid NOT NULL,
  grade integer NOT NULL CHECK (grade BETWEEN 1 AND 9),
  learning_area_id uuid NOT NULL REFERENCES public.curriculum_learning_areas(id) ON DELETE RESTRICT,
  academic_year integer NOT NULL CHECK (academic_year BETWEEN 2000 AND 2100),
  title varchar(180) NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','scheduled','open','closed','marking','moderated','approved','published','corrected','archived')),
  moderation_required boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_events_tenant_scope_check CHECK (tenant_organisation_id = organisation_id),
  CONSTRAINT assessment_events_period_check CHECK (ends_at > starts_at),
  CONSTRAINT assessment_events_programme_fk FOREIGN KEY (tenant_organisation_id, organisation_id, programme_id)
    REFERENCES public.assessment_programmes (tenant_organisation_id, organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT assessment_events_instrument_fk FOREIGN KEY (tenant_organisation_id, organisation_id, instrument_version_id, grade, learning_area_id)
    REFERENCES public.assessment_instrument_versions (tenant_organisation_id, organisation_id, id, grade, learning_area_id) ON DELETE RESTRICT,
  CONSTRAINT assessment_events_scope_unique UNIQUE (tenant_organisation_id, organisation_id, id, instrument_version_id, grade, learning_area_id, academic_year)
);
--> statement-breakpoint

CREATE TABLE public.assessment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL,
  organisation_id uuid NOT NULL,
  event_id uuid NOT NULL,
  enrolment_id uuid NOT NULL,
  instrument_version_id uuid NOT NULL,
  grade integer NOT NULL,
  learning_area_id uuid NOT NULL,
  academic_year integer NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number > 0),
  status varchar(16) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_progress','submitted','marked','moderated','approved','voided')),
  captured_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_attempts_event_fk FOREIGN KEY (tenant_organisation_id, organisation_id, event_id, instrument_version_id, grade, learning_area_id, academic_year)
    REFERENCES public.assessment_events (tenant_organisation_id, organisation_id, id, instrument_version_id, grade, learning_area_id, academic_year) ON DELETE RESTRICT,
  CONSTRAINT assessment_attempts_enrolment_fk FOREIGN KEY (tenant_organisation_id, organisation_id, enrolment_id, grade, academic_year)
    REFERENCES public.learner_enrolments (tenant_organisation_id, organisation_id, id, grade, academic_year) ON DELETE RESTRICT,
  CONSTRAINT assessment_attempts_tenant_scope_id_unique UNIQUE (tenant_organisation_id, organisation_id, id),
  CONSTRAINT assessment_attempts_scope_id_unique UNIQUE (tenant_organisation_id, organisation_id, id, instrument_version_id),
  CONSTRAINT assessment_attempts_event_enrolment_attempt_unique UNIQUE (tenant_organisation_id, organisation_id, event_id, enrolment_id, attempt_number)
);
--> statement-breakpoint

CREATE TABLE public.assessment_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL,
  organisation_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  task_id uuid NOT NULL,
  instrument_version_id uuid NOT NULL,
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  awarded_score numeric(10,2),
  captured_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  captured_at timestamptz NOT NULL DEFAULT now(),
  marked_by uuid REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  marked_at timestamptz,
  marker_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_responses_attempt_fk FOREIGN KEY (tenant_organisation_id, organisation_id, attempt_id, instrument_version_id)
    REFERENCES public.assessment_attempts (tenant_organisation_id, organisation_id, id, instrument_version_id) ON DELETE RESTRICT,
  CONSTRAINT assessment_responses_task_fk FOREIGN KEY (tenant_organisation_id, organisation_id, task_id, instrument_version_id)
    REFERENCES public.assessment_tasks (tenant_organisation_id, organisation_id, id, instrument_version_id) ON DELETE RESTRICT,
  CONSTRAINT assessment_responses_score_check CHECK (awarded_score IS NULL OR awarded_score >= 0),
  CONSTRAINT assessment_responses_mark_check CHECK ((marked_by IS NULL AND marked_at IS NULL) OR (marked_by IS NOT NULL AND marked_at IS NOT NULL)),
  CONSTRAINT assessment_responses_attempt_task_unique UNIQUE (tenant_organisation_id, organisation_id, attempt_id, task_id)
);
--> statement-breakpoint

CREATE TABLE public.assessment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL,
  organisation_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  instrument_version_id uuid NOT NULL,
  result_version integer NOT NULL DEFAULT 1 CHECK (result_version > 0),
  total_awarded_score numeric(10,2) NOT NULL CHECK (total_awarded_score >= 0),
  maximum_score numeric(10,2) NOT NULL CHECK (maximum_score > 0),
  percentage numeric(5,2) NOT NULL CHECK (percentage BETWEEN 0 AND 100),
  performance_level_code varchar(40),
  status varchar(16) NOT NULL CHECK (status IN ('marked','moderated','approved','published','superseded')),
  supersedes_result_id uuid,
  created_by uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_results_attempt_fk FOREIGN KEY (tenant_organisation_id, organisation_id, attempt_id, instrument_version_id)
    REFERENCES public.assessment_attempts (tenant_organisation_id, organisation_id, id, instrument_version_id) ON DELETE RESTRICT,
  CONSTRAINT assessment_results_supersedes_fk FOREIGN KEY (tenant_organisation_id, organisation_id, supersedes_result_id, attempt_id)
    REFERENCES public.assessment_results (tenant_organisation_id, organisation_id, id, attempt_id) ON DELETE RESTRICT,
  CONSTRAINT assessment_results_scope_id_unique UNIQUE (tenant_organisation_id, organisation_id, id, attempt_id),
  CONSTRAINT assessment_results_attempt_version_unique UNIQUE (tenant_organisation_id, organisation_id, attempt_id, result_version),
  CONSTRAINT assessment_results_score_total_check CHECK (total_awarded_score <= maximum_score),
  CONSTRAINT assessment_results_percentage_consistency_check CHECK (percentage = round((total_awarded_score / maximum_score) * 100, 2)),
  CONSTRAINT assessment_results_supersedes_check CHECK ((result_version = 1 AND supersedes_result_id IS NULL) OR (result_version > 1 AND supersedes_result_id IS NOT NULL))
);
--> statement-breakpoint

CREATE TABLE public.assessment_result_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_organisation_id uuid NOT NULL,
  organisation_id uuid NOT NULL,
  attempt_id uuid NOT NULL,
  result_id uuid,
  decision_type varchar(24) NOT NULL CHECK (decision_type IN ('moderation_approved','moderation_rejected','result_approved','result_published','correction_requested','result_superseded')),
  reason text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_result_decisions_attempt_fk FOREIGN KEY (tenant_organisation_id, organisation_id, attempt_id)
    REFERENCES public.assessment_attempts (tenant_organisation_id, organisation_id, id) ON DELETE RESTRICT,
  CONSTRAINT assessment_result_decisions_result_fk FOREIGN KEY (tenant_organisation_id, organisation_id, result_id, attempt_id)
    REFERENCES public.assessment_results (tenant_organisation_id, organisation_id, id, attempt_id) ON DELETE RESTRICT
);
--> statement-breakpoint

CREATE FUNCTION sentinel_private.validate_assessment_response_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_maximum_score numeric(10,2);
BEGIN
  SELECT task.maximum_score INTO v_maximum_score
  FROM public.assessment_tasks AS task
  WHERE task.id = NEW.task_id
    AND task.tenant_organisation_id = NEW.tenant_organisation_id
    AND task.organisation_id = NEW.organisation_id
    AND task.instrument_version_id = NEW.instrument_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment task does not belong to the attempt instrument version'
      USING ERRCODE = '23503';
  END IF;
  IF NEW.awarded_score IS NOT NULL AND NEW.awarded_score > v_maximum_score THEN
    RAISE EXCEPTION 'Awarded score cannot exceed the task maximum score'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER assessment_response_score_validation
BEFORE INSERT OR UPDATE ON public.assessment_responses
FOR EACH ROW EXECUTE FUNCTION sentinel_private.validate_assessment_response_score();
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.validate_assessment_response_score() FROM PUBLIC;
--> statement-breakpoint

CREATE INDEX assessment_events_org_year_grade_idx ON public.assessment_events (organisation_id, academic_year, grade, status);
--> statement-breakpoint
CREATE INDEX assessment_attempts_event_status_idx ON public.assessment_attempts (tenant_organisation_id, organisation_id, event_id, status);
--> statement-breakpoint
CREATE INDEX assessment_attempts_enrolment_idx ON public.assessment_attempts (tenant_organisation_id, organisation_id, enrolment_id);
--> statement-breakpoint
CREATE INDEX assessment_responses_attempt_idx ON public.assessment_responses (tenant_organisation_id, organisation_id, attempt_id);
--> statement-breakpoint
CREATE INDEX assessment_results_attempt_idx ON public.assessment_results (tenant_organisation_id, organisation_id, attempt_id, result_version);
--> statement-breakpoint
CREATE INDEX assessment_task_outcomes_node_idx ON public.assessment_task_outcome_mappings (curriculum_source_node_id, status);
--> statement-breakpoint

CREATE OR REPLACE FUNCTION sentinel_private.can_access_assessment_data(target_organisation_id uuid)
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
          AND membership.role IN ('organisation_admin','school_admin','assessor')
          AND membership.status = 'active'
          AND membership.starts_at <= pg_catalog.now()
          AND (membership.ends_at IS NULL OR membership.ends_at > pg_catalog.now())
      )
    )
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.can_access_assessment_data(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sentinel_private.can_access_assessment_data(uuid) TO sentinel_learner_runtime;
--> statement-breakpoint

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'assessment_programmes','assessment_instrument_versions','assessment_tasks',
    'assessment_task_outcome_mappings','assessment_events','assessment_attempts',
    'assessment_responses','assessment_results','assessment_result_decisions'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO sentinel_learner_runtime USING (sentinel_private.can_access_assessment_data(organisation_id))', table_name || '_assessment_select', table_name);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO sentinel_learner_runtime', table_name);
  END LOOP;
END $$;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.prevent_assessment_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Assessment result and decision history is append-only'
    USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER assessment_results_append_only
BEFORE UPDATE OR DELETE ON public.assessment_results
FOR EACH ROW EXECUTE FUNCTION sentinel_private.prevent_assessment_history_mutation();
--> statement-breakpoint
CREATE TRIGGER assessment_decisions_append_only
BEFORE UPDATE OR DELETE ON public.assessment_result_decisions
FOR EACH ROW EXECUTE FUNCTION sentinel_private.prevent_assessment_history_mutation();
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.prevent_assessment_history_mutation() FROM PUBLIC;
--> statement-breakpoint

CREATE FUNCTION sentinel_private.prevent_instrument_version_mutation_after_use()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.assessment_attempts AS attempt
    WHERE attempt.instrument_version_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Instrument version is immutable after an assessment attempt exists; create a new version'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER assessment_instrument_version_lock
BEFORE UPDATE OR DELETE ON public.assessment_instrument_versions
FOR EACH ROW EXECUTE FUNCTION sentinel_private.prevent_instrument_version_mutation_after_use();
--> statement-breakpoint
REVOKE ALL ON FUNCTION sentinel_private.prevent_instrument_version_mutation_after_use() FROM PUBLIC;

