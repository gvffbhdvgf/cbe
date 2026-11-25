# Sentinel — KICD Curriculum Catalogue Register

**Reference date:** 25 November 2026  
**Scope:** Regular CBC curriculum, Grades 1–9, plus the KICD Special Needs Education catalogue  
**Status:** Official-source catalogue metadata imported; detailed curriculum design content and outcome mappings are not yet imported or approved.

## 1. Data and authority rules

Sentinel distinguishes the official curriculum design catalogue from approved course materials, complementary materials, policy frameworks and assessment instruments. A textbook/material submission list is not treated as a curriculum design. Every catalogue item is linked to its KICD source URL, retrieval date, source type, authority status and curriculum edition. An official catalogue listing does not prove that every underlying PDF is available, current or approved for every learner pathway.

The first edition records use the status `catalogued`, not `verified`. A curriculum specialist must validate exact document revision, approval/effective dates and local implementation before the edition is promoted to `verified` or used for high-stakes analytics.

## 2. Regular curriculum catalogue

### Grades 1–3 — Lower Primary

The current KICD Lower Primary design page lists eight learning-area designs:

1. Creative Activities
2. Christian Religious Education (CRE)
3. English Activities
4. Environmental Activities
5. Hindu Religious Education (HRE)
6. Islamic Religious Education (IRE)
7. Kiswahili
8. Mathematics

Source: [KICD Lower Primary](https://kicd.ac.ke/cbc-materials/lower-primary/).

**Source discrepancy:** The KICD September 2026 Complementary Materials Submission Document includes Indigenous Language in the lower-primary materials scope, but the current Lower Primary curriculum-design page does not list it as a design. Sentinel stores Indigenous Language as `catalogue_discrepancy` for Grades 1–3, with the submission document as evidence. It is not treated as a confirmed curriculum-design offering until the authoritative design source is reconciled.

### Grades 4–6 — Upper Primary

Each grade-specific KICD design catalogue lists the following 15 learning areas:

- Agriculture
- Arabic
- Creative Arts
- Christian Religious Education (CRE)
- English
- French
- German
- Hindu Religious Education (HRE)
- Indigenous Language
- Islamic Religious Education (IRE)
- Kiswahili
- Mandarin
- Mathematics
- Science & Technology
- Social Studies

Sources: [Grade 4](https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-four-designs/), [Grade 5](https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-five-designs/), [Grade 6](https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-six-designs/), and [Upper Primary index](https://kicd.ac.ke/cbc-materials/curriculum-designs/upper-primary-designs/).

### Grades 7–9 — Junior School

Each grade-specific KICD design catalogue lists the following 16 learning areas:

- Agriculture
- Arabic
- Creative Arts
- Christian Religious Education (CRE)
- English
- French
- German
- Hindu Religious Education (HRE)
- Indigenous Language
- Integrated Science
- Islamic Religious Education (IRE)
- Kiswahili
- Mandarin
- Mathematics
- Pre-Technical Studies
- Social Studies

Sources: [Grade 7](https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/), [Grade 8](https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/), [Grade 9](https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/), and [Junior School index](https://kicd.ac.ke/cbc-materials/curriculum-designs/junior-school-designs/).

## 3. Special Needs Education pathways

The KICD SNE catalogue currently identifies adapted design categories for:

- Hearing impairment (HI)
- Physical impairment (PI)
- Visual impairment (VI)
- Prevocational curriculum designs
- Vocational-level designs

Source: [KICD SNE Curriculum Designs](https://kicd.ac.ke/cbc-materials/curriculum-designs/sne-curriculum-designs/).

The [Basic Education Curriculum Framework (2019)](https://kicd.ac.ke/wp-content/uploads/2019/08/BASIC-EDUCATION-CURRICULUM-FRAMEWORK-2019.pdf) describes differentiated provisions including regular curriculum with adaptations, accelerated and enriched curriculum, specialised curriculum and intervention programmes. These are represented as distinct modalities in Sentinel. They are not assumed to be interchangeable with impairment categories.

**Availability rule:** The SNE index does not guarantee that every grade-specific design document is published and complete. Some individual KICD catalogue pages expose placeholders or say documents are awaiting publication. Sentinel therefore registers pathways and source provenance but does not infer Grade 1–9 SNE learning-area offerings from the index alone. Each grade/pathway requires page-level source validation before import.

## 4. Curriculum design content model

The catalogue layer is only the entry point. The detailed design ingestion model must preserve, where present in each official document:

- National Goals of Education and learning-area essence statement
- General and specific learning outcomes
- Strands and sub-strands
- Suggested learning experiences
- Key inquiry questions
- Core competencies
- Pertinent and Contemporary Issues (PCIs)
- Values
- Community Service Learning (CSL)
- Assessment rubrics and evidence descriptors

Source examples: [KICD Grade 6 CRE revised design (2024)](https://kicd.ac.ke/wp-content/uploads/2024/10/CRE-GRADE-6-DESIGN-Revised.pdf) and [KICD Grade 8 English design (2024)](https://kicd.ac.ke/wp-content/uploads/2024/06/English-Grade-8-Design-Formatted-April-2024.pdf).

Do not infer missing outcomes, copy content across grades or pathways, or map a zonal assessment composite to a KICD learning area without documentary evidence and curriculum-specialist review.

## 5. Database implementation

The development database contains:

- `curriculum_sources` — source identity, type, URL, authority status and provenance
- `curriculum_editions` — versioned CBC edition metadata and verification state
- `curriculum_pathways` — regular, adapted, accelerated/enriched, specialised, intervention, prevocational and vocational modalities
- `curriculum_learning_areas` — canonical learning-area labels and codes
- `curriculum_grade_offerings` — grade/pathway/edition/source-linked catalogue entries and availability status

The current regular catalogue seed contains 120 grade offerings: 9 entries for each of Grades 1–3 (eight listed plus the flagged Indigenous Language discrepancy), 15 for each of Grades 4–6 and 16 for each of Grades 7–9. The SNE pathway catalogue is registered, but no SNE grade-level learning-area offering is treated as verified yet.

## 6. Pilot source-document register

The official [Grade 6 CRE Revised 2024 PDF](https://kicd.ac.ke/wp-content/uploads/2024/10/CRE-GRADE-6-DESIGN-Revised.pdf) is now identified as the current source candidate. Its cover states **First Published in 2021** and **Revised 2024** (ISBN 978-9914-724-78-3). The foreword says KICD reviewed and rationalised curriculum designs in 2024. The KICD Grade Six Designs catalogue lists CRE, although the exact embedded link to this PDF still needs direct confirmation. The PDF rights notice reserves reproduction/transcription rights; Sentinel records rights as `not_assessed` and review as `pending`.

The earlier [June 2024 CRE PDF](https://kicd.ac.ke/wp-content/uploads/2024/06/CRE-GRADE-6-DESIGN-APRIL-2024.pdf) is retained as a historical source candidate, not silently overwritten. The revised 2024 staging document indexes five strand headings and 22 sub-strand headings. Notable corrections include strand 5 `Christian Living` (not `Christian Living Today`), sub-strand 2.5 `Jacob wrestles an Angel` (not `Jacob Meeting an Angel`), and revised strand page references 1, 8, 17, 32 and 39. Only short headings and source provenance are stored; no specific outcome, learning-experience or rubric body text has been transcribed.

## 7. Separate material catalogues

The following sources are stored separately and must not be merged into the curriculum design hierarchy:

- [Addendum to Orange Book — December 2024](https://kicd.ac.ke/wp-content/uploads/2026/09/ADDENDUM-TO-ORANGE-BOOK-PP1-PP2-1-9-.pdf): approved rationalised learning-area course and complementary materials.
- [Complementary Materials Submission Document — September 2026](https://kicd.ac.ke/wp-content/uploads/2026/09/COMPLEMENTARY-MATERIALS-SUBMISSION-DOCUMENT-SEPTEMBER-2026.pdf): submission scope for complementary print materials.

These sources can inform availability and discrepancy review, but they do not replace the official curriculum design PDFs.

## 8. Next ingestion gates

1. Download each grade-specific regular design PDF from the KICD page and retain the original file, URL, retrieval date and SHA-256 checksum.
2. Confirm the official title, edition/revision, approval date and any effective date in the PDF foreword/preface.
3. Extract strands, sub-strands, outcomes, inquiry questions, experiences, competencies, PCIs, values, CSL and rubrics with page-level provenance.
4. Run structural validation for missing/duplicate codes, grade mismatches, repeated content and source extraction errors.
5. Have a curriculum specialist review and approve the extracted content before it becomes the active edition.
6. Repeat separately for HI, PI and VI, documenting each design's actual availability and differences; never copy regular outcomes as a substitute for an adapted design.
7. Keep assessment mapping separate and require paper/item/marking-scheme evidence before linking assessment results to learning outcomes.

---
**Approval boundary:** This register is a source-linked catalogue index. It is not a full transcription of KICD curriculum designs and is not an approved outcome-level mapping.
