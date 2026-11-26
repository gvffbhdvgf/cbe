CREATE TABLE public.curriculum_pathway_grade_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.curriculum_editions(id) ON DELETE RESTRICT,
  pathway_id uuid NOT NULL REFERENCES public.curriculum_pathways(id) ON DELETE RESTRICT,
  grade integer NOT NULL,
  source_id uuid NOT NULL REFERENCES public.curriculum_sources(id) ON DELETE RESTRICT,
  availability_status varchar(32) NOT NULL DEFAULT 'document_listed',
  evidence_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT curriculum_pathway_grade_levels_edition_pathway_grade_unique UNIQUE (edition_id, pathway_id, grade),
  CONSTRAINT curriculum_pathway_grade_levels_grade_check CHECK (grade BETWEEN 1 AND 9),
  CONSTRAINT curriculum_pathway_grade_levels_availability_check CHECK (availability_status IN ('document_listed','document_available','awaiting_publication','catalogue_discrepancy','not_confirmed'))
);
--> statement-breakpoint
CREATE INDEX curriculum_pathway_grade_levels_pathway_grade_idx
  ON public.curriculum_pathway_grade_levels(pathway_id, grade);
--> statement-breakpoint
UPDATE public.curriculum_pathways p
SET source_id=s.id
FROM public.curriculum_sources s
WHERE s.source_code='KICD-SNE-CATALOGUE-2026'
  AND p.pathway_code IN ('adapted_hearing_impairment','adapted_physical_impairment','adapted_visual_impairment');
--> statement-breakpoint
INSERT INTO public.curriculum_pathway_grade_levels (
  edition_id,pathway_id,grade,source_id,availability_status,evidence_note
)
SELECT
  e.id,p.id,g.grade,s.id,'document_listed',
  'Listed in the official KICD SNE catalogue for this impairment category and grade. Grade-level learning areas and design content remain to be verified; no regular-curriculum outcomes are inferred.'
FROM public.curriculum_editions e
JOIN public.curriculum_sources s ON s.source_code='KICD-SNE-CATALOGUE-2026'
JOIN public.curriculum_pathways p ON p.pathway_code IN ('adapted_hearing_impairment','adapted_physical_impairment','adapted_visual_impairment')
CROSS JOIN generate_series(1,9) AS g(grade)
WHERE e.edition_code='CBC-SNE-CATALOGUE-2026'
ON CONFLICT (edition_id,pathway_id,grade) DO UPDATE
SET source_id=EXCLUDED.source_id,
    availability_status=EXCLUDED.availability_status,
    evidence_note=EXCLUDED.evidence_note;
