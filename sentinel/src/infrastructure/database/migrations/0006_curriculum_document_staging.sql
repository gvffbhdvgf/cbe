CREATE TABLE IF NOT EXISTS public.curriculum_design_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_code varchar(120) NOT NULL UNIQUE,
  grade_offering_id uuid NOT NULL REFERENCES public.curriculum_grade_offerings(id) ON DELETE RESTRICT,
  source_id uuid NOT NULL REFERENCES public.curriculum_sources(id) ON DELETE RESTRICT,
  title varchar(300) NOT NULL,
  publication_label varchar(180),
  first_published_year integer,
  source_file_label varchar(240),
  page_count integer,
  checksum_sha256 varchar(64),
  availability_status varchar(24) NOT NULL DEFAULT 'identified' CHECK (availability_status IN ('identified','downloaded','extracted','reviewed','approved','superseded')),
  review_status varchar(24) NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','in_review','approved','rejected')),
  rights_status varchar(24) NOT NULL DEFAULT 'not_assessed' CHECK (rights_status IN ('not_assessed','confirmed','restricted')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.curriculum_source_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.curriculum_design_documents(id) ON DELETE RESTRICT,
  parent_id uuid REFERENCES public.curriculum_source_nodes(id) ON DELETE RESTRICT,
  node_type varchar(32) NOT NULL CHECK (node_type IN ('strand','sub_strand','general_outcome','specific_outcome','learning_experience','inquiry_question','core_competency','value','pci','csl_activity','assessment_rubric','rubric_criterion')),
  node_code varchar(80) NOT NULL,
  title varchar(300) NOT NULL,
  source_page integer,
  display_order integer NOT NULL DEFAULT 0,
  extraction_status varchar(24) NOT NULL DEFAULT 'catalogued' CHECK (extraction_status IN ('catalogued','extracted','reviewed','approved','rejected')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT curriculum_source_nodes_document_type_code_unique UNIQUE (document_id,node_type,node_code)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS curriculum_design_documents_offering_idx ON public.curriculum_design_documents (grade_offering_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS curriculum_source_nodes_parent_idx ON public.curriculum_source_nodes (parent_id,display_order);
--> statement-breakpoint
INSERT INTO public.curriculum_sources (source_code,title,source_type,url,authority_status,notes)
VALUES ('KICD-CRE-GRADE-6-DESIGN-PDF-2024-06','Primary School Curriculum Design — Christian Religious Education — Grade 6','curriculum_design_pdf','https://kicd.ac.ke/wp-content/uploads/2024/06/CRE-GRADE-6-DESIGN-APRIL-2024.pdf','official','The PDF cover states First Published in 2021; the file name/path indicates an April 2024 file. Exact revision/currentness must be confirmed before promoting content to approved.')
ON CONFLICT (source_code) DO UPDATE SET title=excluded.title,url=excluded.url,authority_status=excluded.authority_status,notes=excluded.notes;
--> statement-breakpoint
INSERT INTO public.curriculum_design_documents (document_code,grade_offering_id,source_id,title,publication_label,first_published_year,source_file_label,availability_status,review_status,rights_status,notes)
SELECT 'KICD-CRE-G6-2024-PDF',o.id,s.id,'Primary School Curriculum Design — Christian Religious Education — Grade 6','File label: April 2024; cover: First Published in 2021',2021,'CRE-GRADE-6-DESIGN-APRIL-2024.pdf','identified','pending','not_assessed','Document identified from the official KICD Grade 6 CRE source. Verify whether the 2024 file represents the current revised design; do not treat as approved until edition and rights review are complete.'
FROM public.curriculum_grade_offerings o
JOIN public.curriculum_learning_areas a ON a.id=o.learning_area_id
JOIN public.curriculum_editions e ON e.id=o.edition_id
JOIN public.curriculum_pathways p ON p.id=o.pathway_id
JOIN public.curriculum_sources s ON s.source_code='KICD-CRE-GRADE-6-DESIGN-PDF-2024-06'
WHERE e.edition_code='CBC-REGULAR-CATALOGUE-2024' AND p.pathway_code='regular' AND o.grade=6 AND a.area_code='cre'
ON CONFLICT (document_code) DO UPDATE SET source_id=excluded.source_id,grade_offering_id=excluded.grade_offering_id,publication_label=excluded.publication_label,notes=excluded.notes;
--> statement-breakpoint
INSERT INTO public.curriculum_source_nodes (document_id,node_type,node_code,title,source_page,display_order,extraction_status,notes)
SELECT d.id,'strand',v.node_code,v.title,v.source_page,v.display_order,'catalogued','Heading only from the source table of contents; no full copyrighted body text transcribed.'
FROM public.curriculum_design_documents d
CROSS JOIN (VALUES
('1.0','Creation',1,1),
('2.0','The Bible',8,2),
('3.0','The Life of Jesus Christ',19,3),
('4.0','The Church',34,4),
('5.0','Christian Living Today',41,5)
) AS v(node_code,title,source_page,display_order)
WHERE d.document_code='KICD-CRE-G6-2024-PDF'
ON CONFLICT (document_id,node_type,node_code) DO UPDATE SET title=excluded.title,source_page=excluded.source_page,display_order=excluded.display_order;
--> statement-breakpoint
INSERT INTO public.curriculum_source_nodes (document_id,parent_id,node_type,node_code,title,display_order,extraction_status,notes)
SELECT d.id,parent.id,'sub_strand',v.node_code,v.title,v.display_order,'catalogued','Heading only from the source summary table; no outcome or learning-experience text transcribed.'
FROM public.curriculum_design_documents d
CROSS JOIN (VALUES
('1.0','1.1','My purpose',1),('1.0','1.2','Marriage and Family',2),('1.0','1.3','Leisure',3),
('2.0','2.1','The Inspired Word of God',1),('2.0','2.2','The Ten Commandments',2),('2.0','2.3','Samson defeats the Philistines',3),('2.0','2.4','Faith in God (Elisha)',4),('2.0','2.5','Jacob Meeting an Angel',5),
('3.0','3.1','The call of the Disciples',1),('3.0','3.2','The Temptations of Jesus Christ',2),('3.0','3.3','Miracles of Jesus Christ (The Roman Officer’s Servant)',3),('3.0','3.4','Faith in God',4),('3.0','3.5','Lazarus is raised from Dead',5),('3.0','3.6','The Hidden Treasure',6),('3.0','3.7','The Rich Man and Lazarus',7),
('4.0','4.1','The Apostles Creed',1),('4.0','4.2','Standing Firm in Faith',2),('4.0','4.3','Church Unity',3),
('5.0','5.1','Friendship Formation',1),('5.0','5.2','Human Sexuality',2),('5.0','5.3','Sanctity of Life',3),('5.0','5.4','Alcohol, drug and Substance Abuse',4)
) AS v(parent_code,node_code,title,display_order)
JOIN public.curriculum_source_nodes parent ON parent.document_id=d.id AND parent.node_type='strand' AND parent.node_code=v.parent_code
WHERE d.document_code='KICD-CRE-G6-2024-PDF'
ON CONFLICT (document_id,node_type,node_code) DO UPDATE SET parent_id=excluded.parent_id,title=excluded.title,display_order=excluded.display_order;
