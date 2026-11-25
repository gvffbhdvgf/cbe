INSERT INTO public.curriculum_sources (source_code,title,source_type,url,authority_status,notes)
VALUES (
  'KICD-CRE-GRADE-6-DESIGN-REVISED-2024-10',
  'Primary School Education Curriculum Design — Christian Religious Education — Grade 6 (Revised 2024)',
  'curriculum_design_pdf',
  'https://kicd.ac.ke/wp-content/uploads/2024/10/CRE-GRADE-6-DESIGN-Revised.pdf',
  'official',
  'Official KICD PDF cover states First Published in 2021 and Revised 2024 (ISBN 978-9914-724-78-3). The foreword says KICD reviewed and rationalised curriculum designs in 2024. The PDF rights notice reserves reproduction and transcription rights; substantive text remains untranscribed pending rights review.'
)
ON CONFLICT (source_code) DO UPDATE SET title=excluded.title,url=excluded.url,authority_status=excluded.authority_status,notes=excluded.notes;
--> statement-breakpoint
UPDATE public.curriculum_design_documents
SET notes = 'Older June 2024 file; cover says First Published in 2021 but does not state Revised 2024. Retained for historical comparison. The official October 2024 Revised PDF is now the current source candidate; this older file is not approved for outcome ingestion.'
WHERE document_code = 'KICD-CRE-G6-2024-PDF';
--> statement-breakpoint
INSERT INTO public.curriculum_design_documents (
  document_code,grade_offering_id,source_id,title,publication_label,first_published_year,source_file_label,availability_status,review_status,rights_status,notes
)
SELECT
  'KICD-CRE-G6-REVISED-2024',
  offering.id,
  source.id,
  'Primary School Education Curriculum Design — Christian Religious Education — Grade 6',
  'First Published 2021; Revised 2024',
  2021,
  'CRE-GRADE-6-DESIGN-Revised.pdf',
  'identified',
  'pending',
  'not_assessed',
  'Official revised 2024 source candidate. The Grade Six Designs catalogue lists CRE, and the PDF cover states Revised 2024. Verify that the catalogue page links to this exact PDF and complete rights review before substantive outcome extraction or approval.'
FROM public.curriculum_grade_offerings AS offering
JOIN public.curriculum_learning_areas AS area ON area.id = offering.learning_area_id
JOIN public.curriculum_editions AS edition ON edition.id = offering.edition_id
JOIN public.curriculum_pathways AS pathway ON pathway.id = offering.pathway_id
JOIN public.curriculum_sources AS source ON source.source_code = 'KICD-CRE-GRADE-6-DESIGN-REVISED-2024-10'
WHERE edition.edition_code = 'CBC-REGULAR-CATALOGUE-2024'
  AND pathway.pathway_code = 'regular'
  AND offering.grade = 6
  AND area.area_code = 'cre'
ON CONFLICT (document_code) DO UPDATE SET
  source_id = excluded.source_id,
  grade_offering_id = excluded.grade_offering_id,
  publication_label = excluded.publication_label,
  notes = excluded.notes;
--> statement-breakpoint
INSERT INTO public.curriculum_source_nodes (document_id,node_type,node_code,title,source_page,display_order,extraction_status,metadata,notes)
SELECT document.id,'strand',v.node_code,v.title,v.source_page,v.display_order,'catalogued','{"indexingMode":"heading_only"}'::jsonb,
  'Heading only from the official revised 2024 source. No specific learning outcome, learning experience or rubric body text transcribed.'
FROM public.curriculum_design_documents AS document
CROSS JOIN (VALUES
  ('1.0','Creation',1,1),
  ('2.0','The Bible',8,2),
  ('3.0','The Life of Jesus Christ',17,3),
  ('4.0','The Church',32,4),
  ('5.0','Christian Living',39,5)
) AS v(node_code,title,source_page,display_order)
WHERE document.document_code='KICD-CRE-G6-REVISED-2024'
ON CONFLICT (document_id,node_type,node_code) DO UPDATE SET title=excluded.title,source_page=excluded.source_page,display_order=excluded.display_order,notes=excluded.notes;
--> statement-breakpoint
INSERT INTO public.curriculum_source_nodes (document_id,parent_id,node_type,node_code,title,display_order,extraction_status,metadata,notes)
SELECT document.id,parent.id,'sub_strand',v.node_code,v.title,v.display_order,'catalogued','{"printedPage":"xii","indexingMode":"heading_only"}'::jsonb,
  'Heading only from the revised 2024 summary of strands and sub-strands. No substantive outcome or learning-experience text transcribed.'
FROM public.curriculum_design_documents AS document
CROSS JOIN (VALUES
  ('1.0','1.1','My Purpose',1),('1.0','1.2','Marriage and Family',2),('1.0','1.3','Leisure',3),
  ('2.0','2.1','The Inspired Word of God',1),('2.0','2.2','The Ten Commandments',2),('2.0','2.3','Samson defeats the Philistines',3),('2.0','2.4','Faith in God (Elisha)',4),('2.0','2.5','Jacob wrestles an Angel',5),
  ('3.0','3.1','The call of the Disciples',1),('3.0','3.2','The Temptations of Jesus Christ',2),('3.0','3.3','Miracles of Jesus Christ (The Roman Officer’s Servant)',3),('3.0','3.4','Faith in God',4),('3.0','3.5','Lazarus is raised from Dead',5),('3.0','3.6','The Hidden Treasure',6),('3.0','3.7','The Rich Man and Lazarus',7),
  ('4.0','4.1','The Apostles’ Creed',1),('4.0','4.2','Standing Firm in Faith',2),('4.0','4.3','Church Unity',3),
  ('5.0','5.1','Friendship Formation',1),('5.0','5.2','Human Sexuality',2),('5.0','5.3','Sanctity of Life',3),('5.0','5.4','Alcohol, drug and Substance Abuse',4)
) AS v(parent_code,node_code,title,display_order)
JOIN public.curriculum_source_nodes AS parent
  ON parent.document_id=document.id AND parent.node_type='strand' AND parent.node_code=v.parent_code
WHERE document.document_code='KICD-CRE-G6-REVISED-2024'
ON CONFLICT (document_id,node_type,node_code) DO UPDATE SET parent_id=excluded.parent_id,title=excluded.title,display_order=excluded.display_order,metadata=excluded.metadata,notes=excluded.notes;
