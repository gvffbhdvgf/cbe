# Sentinel — Assessment Evidence Audit (Discovery Draft)

**Source cohort:** Navakholo East Zonal (N.E.W. Sub-County Assessment), Term 2 2026  
**Administration dates:** 20–24 July 2026  
**Release date:** 4 September 2026  
**Grades reviewed:** 6 and 9  
**Status:** Preliminary source audit; not an approved statistical publication

## 1. Source inventory

The following user-provided source records were located in the connected file library:

- `EAST ZONE GRADE 6 AND 9 RESULTS 2 2026.pdf` — combined report, 41 pages.
- `EAST ZONE GRADE 6 AND 9 RESULTS 2 2026.docx` — editable combined report.
- `GRADE 6 EAST ZONE COMBINED STUDENTS RESULTS.pdf` — Grade 6 learner marklist, 38 pages.
- `EAST ZONAL EXAMS.docx` — Grade 9 report, 19 pages.
- Additional Grade 6 and Grade 9 source variants were also located. Their authority/version relationship must be established before importing.

The report preface identifies five clusters: Navakholo, Welusina, Namuchembuche, Sisiluma and Muchesima; and says 21 public and 5 private schools participated. The report says the assessment was administered 20–24 July 2026 and released 4 September 2026.

## 2. Grade 6 — confirmed aggregate figures and reconciliation issues

### Category summary (combined report, printed page 41)

| Category | Learner roll | EE | ME | AE | BE |
|---|---:|---:|---:|---:|---:|
| Public | 1,301 | 8 | 511 | 714 | 68 |
| Private | 105 | 40 | 61 | 4 | 0 |
| **Category total** | **1,406** | **48** | **572** | **718** | **68** |

The category-level performance-level counts sum correctly to their respective rolls: public 1,301; private 105; combined 1,406. The category table reports 620 learners in EE+ME (approximately 44.1% of 1,406).

### Conflicting cluster roll totals

The report contains more than one cluster-roll presentation:

- Printed page 40 cluster ranking: Navakholo 203, Welusina 278, Namuchembuche 385, Muchesima 377, Sisiluma 165. These sum to **1,408**.
- Printed page 41 performance-level table: Sisiluma 164, Welusina 278, Namuchembuche 385, Navakholo 203, Muchesima 375; the printed total is **1,405**. These five displayed values also sum to 1,405.
- The category summary gives **1,406**.

This is not a single isolated one-learner difference: the two cluster presentations differ in both Sisiluma (164 vs 165) and Muchesima (377 vs 375), and the page 40 cluster values total 1,408. Do not select one version silently.

### Other Grade 6 observations

- The school performance tables list five private schools and 21 public schools, consistent with the preface's school counts.
- The learner-level marklist contains individual learner records. Treat it as sensitive child data; do not reproduce learner names or individual results in general product documentation, public dashboards, screenshots or sample fixtures.
- The Grade 6 report groups learning areas into five aggregate columns: Mathematics, English, Kiswahili, CA/SS/CRE and Science & Technology/Agriculture & Nutrition. These are reporting aggregates and must not be assumed to be exact KICD learning-area entities.

## 3. Grade 9 — confirmed structure and reconciliation issues

The Grade 9 report's printed page 19 shows cluster rolls:

| Cluster | Roll |
|---|---:|
| Navakholo | 191 |
| Welusina | 298 |
| Muchesima | 402 |
| Namuchembuche | 340 |
| Sisiluma | 171 |
| **Total** | **1,402** |

The cluster totals sum to the printed total of 1,402.

The Grade 9 report's school-level table (printed pages 13–16) presents four private schools and 21 public schools. The private school rolls shown on printed page 15 are 27, 8, 34 and 6, summing to **75**. The preface, however, describes five private schools participating across the zone. The fourth/fifth-school distinction and cohort scope require source-owner confirmation; do not infer that the Grade 9 cohort should contain the same number of private schools as Grade 6.

The Grade 9 performance-level table reports total 1,402 and EE+ME count 623 (approximately 44.4%). The report uses nine learning-area columns in its overall school performance table: Mathematics, English, Kiswahili, Social Studies, Integrated Science, Creative Arts & Sports, Pre-Technical Studies, Agriculture & Nutrition, and CRE. These labels must be mapped to the applicable official Grade 9 curriculum design and version before curriculum-outcome analytics are enabled.

The Grade 9 school table also contains at least one apparent ranking/ordering anomaly: school rows are not consistently sorted by the displayed total or position, and one row's displayed position differs from its sequence. Rankings should be recalculated from validated learner-level or school-level source records, not trusted as imported facts.

## 4. KICD curriculum alignment — design implications

KICD's official curriculum design resources organise Grade 6 under Upper Primary and Grade 9 under Junior School. The official Grade 6 design resources identify learning areas such as Mathematics, English, Kiswahili, Science & Technology, Agriculture, Social Studies, Creative Arts and Religious Education. Grade 9 is part of Junior School, with its own grade-specific designs and learning-area structure.

KICD curriculum designs include more than subject names: they provide general and specific learning outcomes, strands, sub-strands, suggested learning experiences, key inquiry questions, core competencies, Pertinent and Contemporary Issues (PCIs), values and assessment rubrics. Sentinel must therefore represent curriculum as structured, versioned content rather than a flat subject list.

Official starting points:
- KICD Regular Curriculum Designs: https://kicd.ac.ke/cbc-materials/curriculum-designs/regular-curriculum-designs/
- KICD Grade Six Designs: https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-six-designs/
- KICD Junior School Designs: https://kicd.ac.ke/cbc-materials/curriculum-designs/junior-school-designs/
- KICD Grade 6 IRE revised design (2024): https://kicd.ac.ke/wp-content/uploads/2024/10/IRE-GRADE-6-CURRICULUM-DESIGNS-Revised.pdf
- KICD National Curriculum Policy: https://kicd.ac.ke/wp-content/uploads/2019/05/National-curriculum-policy-revised-on-may-9-2019.pdf

Do not map a school report's shorthand subject columns to curriculum outcomes based only on similar wording. Confirm assessment instruments, learning-area coverage and the relevant KICD design version with curriculum stakeholders.

## 5. Product requirements derived from the evidence

1. **Source provenance:** every import records source file, source version, page/sheet, import batch, operator, timestamp and validation outcome.
2. **Reconciliation before publication:** compare learner-level counts, school totals, cluster totals, category totals, gender totals and performance-level totals. Block publication when configured integrity rules fail.
3. **Explicit discrepancy workflow:** show conflicting source values side by side; record resolution, evidence, approver and timestamp. Never silently overwrite a source value.
4. **Cohort and assessment identity:** Grade, term, year, assessment window, school participation and cohort must be independently represented. Grade 6 and Grade 9 are distinct cohorts.
5. **Curriculum versioning:** represent grade, learning area, strand, sub-strand, specific learning outcome, rubric, competency, value and PCI as versioned curriculum entities.
6. **Outcome-level assessment mapping:** each assessment item/task can map to one or more approved outcomes and rubric criteria, with mapping confidence and reviewer approval.
7. **Separate measures:** retain raw marks, derived performance levels and outcome mastery as different concepts. A subject aggregate score is not proof of mastery of every outcome.
8. **Denominator-aware analytics:** every percentage exposes numerator, denominator, coverage, exclusions and missing data.
9. **Privacy by design:** child-level data is restricted by role and organisation scope; aggregate public reporting suppresses identifying detail and small groups where appropriate.
10. **Intervention loop:** analytics should lead to teacher-reviewed learning-gap diagnoses, action plans, follow-up evidence and impact measurement.

## 6. Decisions not yet made

- Which source document/version is authoritative where combined PDF, DOCX and standalone marklists differ.
- Whether Grade 9 participation was four or five private schools, and why the preface states five.
- Reconciled Grade 6 cluster roll values (category total 1,406 vs conflicting cluster presentations of 1,405 and 1,408).
- Whether assessment subject aggregates align to current KICD learning areas or locally designed assessment composites.
- Exact learning outcomes, strands, sub-strands and rubrics assessed in the Term 2 2026 papers.
- Whether all learner records are complete, unique and correctly assigned to school and cluster.

## 7. Next validation actions

1. Obtain written confirmation from the zonal assessment council of the authoritative source files and the Grade 6 roll discrepancies.
2. Confirm Grade 9 private-school participation and cohort inclusion rules.
3. Compare the individual learner marklists against school, cluster and category summaries using controlled, privacy-preserving validation.
4. Obtain the actual Grade 6 and Grade 9 assessment papers, marking schemes and moderation records.
5. Obtain confirmation from the Curriculum Support Officer on the curriculum design versions and intended learning-area mappings.
6. Build an approved outcome-mapping register only after the source instruments and KICD designs have been reviewed.

---
**Handling note:** This document intentionally records aggregate evidence only. Do not add learner names, admission numbers, individual marks or other identifiable child data to this document.
