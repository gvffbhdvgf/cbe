CREATE TABLE IF NOT EXISTS public.curriculum_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code varchar(100) NOT NULL UNIQUE,
  publisher varchar(180) NOT NULL DEFAULT 'Kenya Institute of Curriculum Development',
  title varchar(300) NOT NULL,
  source_type varchar(48) NOT NULL CHECK (source_type IN ('curriculum_design_catalogue','curriculum_design_pdf','framework','policy','approved_materials_addendum','materials_submission')),
  url text NOT NULL,
  published_at date,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  authority_status varchar(32) NOT NULL DEFAULT 'official_catalogue' CHECK (authority_status IN ('official','official_catalogue','needs_verification','superseded')),
  checksum_sha256 varchar(64),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.curriculum_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_code varchar(100) NOT NULL UNIQUE,
  title varchar(300) NOT NULL,
  framework varchar(80) NOT NULL DEFAULT 'CBC',
  edition_label varchar(180) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'catalogued' CHECK (status IN ('catalogued','verified','superseded','withdrawn')),
  approved_at date,
  effective_from date,
  effective_to date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.curriculum_pathways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_code varchar(80) NOT NULL UNIQUE,
  name varchar(180) NOT NULL,
  modality varchar(40) NOT NULL CHECK (modality IN ('regular','adapted','accelerated_enriched','specialized','intervention','prevocational','vocational')),
  category_code varchar(40),
  catalogue_status varchar(32) NOT NULL DEFAULT 'catalogued' CHECK (catalogue_status IN ('catalogued','awaiting_publication','not_confirmed')),
  description text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.curriculum_learning_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_code varchar(100) NOT NULL UNIQUE,
  name varchar(180) NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.curriculum_grade_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.curriculum_editions(id) ON DELETE RESTRICT,
  pathway_id uuid NOT NULL REFERENCES public.curriculum_pathways(id) ON DELETE RESTRICT,
  grade integer NOT NULL CHECK (grade BETWEEN 1 AND 9),
  learning_area_id uuid NOT NULL REFERENCES public.curriculum_learning_areas(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL REFERENCES public.curriculum_sources(id) ON DELETE RESTRICT,
  availability_status varchar(32) NOT NULL DEFAULT 'document_listed' CHECK (availability_status IN ('document_listed','document_available','awaiting_publication','catalogue_discrepancy','not_confirmed')),
  display_order integer NOT NULL DEFAULT 0,
  evidence_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT curriculum_grade_offerings_edition_pathway_grade_area_unique UNIQUE (edition_id,pathway_id,grade,learning_area_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS curriculum_grade_offerings_grade_pathway_idx ON public.curriculum_grade_offerings (grade,pathway_id,display_order);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS curriculum_grade_offerings_source_idx ON public.curriculum_grade_offerings (source_id);
