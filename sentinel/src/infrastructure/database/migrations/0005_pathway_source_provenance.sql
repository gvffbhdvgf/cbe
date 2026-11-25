ALTER TABLE public.curriculum_pathways ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES public.curriculum_sources(id) ON DELETE RESTRICT;
--> statement-breakpoint
INSERT INTO public.curriculum_sources (source_code,title,source_type,url,authority_status,notes) VALUES ('KICD-REGULAR-CURRICULUM-INDEX-2026','Regular Curriculum Designs index','curriculum_design_catalogue','https://kicd.ac.ke/cbc-materials/curriculum-designs/regular-curriculum-designs/','official_catalogue','Top-level KICD index for regular curriculum designs by education level and grade.') ON CONFLICT (source_code) DO NOTHING;
--> statement-breakpoint
UPDATE public.curriculum_pathways p SET source_id=s.id FROM public.curriculum_sources s WHERE p.pathway_code='regular' AND s.source_code='KICD-REGULAR-CURRICULUM-INDEX-2026';
--> statement-breakpoint
UPDATE public.curriculum_pathways p SET source_id=s.id FROM public.curriculum_sources s WHERE p.pathway_code IN ('adapted_hearing_impairment','adapted_physical_impairment','adapted_visual_impairment','prevocational','vocational') AND s.source_code='KICD-SNE-CATALOGUE-2026';
--> statement-breakpoint
UPDATE public.curriculum_pathways p SET source_id=s.id FROM public.curriculum_sources s WHERE p.pathway_code IN ('accelerated_enriched','specialized','intervention') AND s.source_code='KICD-BASIC-EDUCATION-FRAMEWORK-2019';
