# Sentinel — Domain Model & Core Workflow Design

**Status:** Conceptual design for discovery and technical validation  
**Coverage:** Grades 1–9, regular and applicable adapted curriculum pathways  
**Decision posture:** Proposed domain boundaries and invariants; validate with institutional owners before schema implementation.

## 1. Domain design objective

Sentinel is one connected education platform, not a collection of disconnected registers. Each capability must use shared canonical identities, organisation structures, curriculum references and audit controls. Domain boundaries protect ownership and business rules; they must not create duplicated copies of the same facts.

The model must support multiple education authorities and institutions; delegated organisational scopes; academic years, terms, cohorts, classes and streams; learners with continuous histories across enrolments and schools; teachers with time-bounded appointments and assignments; KICD curriculum versions and adapted pathways; internal, school-based, inter-school, zonal and external assessment; results, moderation, approvals, publication, analysis and interventions; privacy, safeguarding and traceable correction.

## 2. Bounded contexts and authoritative ownership

| Context | Owns | Must not own |
|---|---|---|
| Identity & Access | User accounts, authentication links, roles, permissions, sessions | Learner academic identity or employment history |
| Organisation | Institutions, administrative hierarchy, school structures, academic periods | Person identity or assessment marks |
| People & Workforce | Person identity, staff profiles, authorised credentials, employment/engagement, assignments | Login credentials or school master records |
| Learner Records | Learner identity, admission, enrolment, guardianship links, progression, transfer history | Assessment scoring rules or curriculum definitions |
| Curriculum | Curriculum editions, pathways, grades, learning areas, strands, outcomes, competencies, values, PCIs, rubrics | Learner results |
| Teaching & Learning | Teaching allocations, class groups, plans and learning activity evidence where validated | Canonical teacher/learner identities |
| Assessment | Events, instruments, items, blueprint, outcome mappings, scoring schemes, attempts and marks | Curriculum source definitions or identity records |
| Results & Progress | Validated results, performance levels, longitudinal evidence and mastery calculations | Original assessment instrument definitions |
| Intervention | Identified needs, support plans, actions, reviews and outcomes | Official grades or autonomous high-stakes decisions |
| Analytics & Reporting | Derived aggregates, metrics, snapshots, lineage and reports | Authoritative master data |
| Governance & Audit | Approvals, audit events, data quality cases, retention and export controls | Business facts owned by other contexts |
| Integration & Exchange | External identifiers, mappings, import/export jobs, delivery and reconciliation state | Competing copies of canonical records |

A modular monolith is the default deployment shape. Contexts communicate through explicit application services and domain contracts. Split deployment only when operational evidence justifies it.

## 3. Canonical conceptual entities

### Organisation and academic structure
- Organisation: authority, institution or organisational unit with type and parent relationship.
- School: school identity linked to governing organisation and administrative location.
- SchoolUnit: campus, department or institution-specific unit if required.
- AcademicYear, Term and AcademicCalendar: time periods and institutional calendar definitions.
- ClassGroup: grade, stream, school, academic year and effective dates.
- AdministrativeArea: county, sub-county, zone, cluster or configured administrative geography.
- OrganisationMembership: time-bounded relationship between a user/person and an organisation.

The hierarchy must be configurable and effective-dated. Do not assume every institution uses the same intermediate hierarchy or that a school belongs to only one reporting grouping for all historical periods.

### Person, learner and staff
- Person: canonical human identity with minimal required attributes.
- PersonIdentifier: governed identifiers, issuer, validity dates and verification state.
- LearnerProfile: learner-specific attributes and status.
- LearnerAdmission: admission event and source institution.
- LearnerEnrolment: learner-to-school relationship, grade/class placement, start/end dates and status.
- LearnerTransfer: transfer event with sending/receiving institution and effective date.
- GuardianRelationship: relationship and permitted contact/access scope, subject to policy.
- StaffProfile: professional/workforce attributes the institution is authorised to process.
- EmploymentOrEngagement: time-bounded relationship with an employer/institution.
- TeacherAssignment: school, class, learning area, role, effective dates and approval.
- TeachingLoad: derived or approved workload allocation; avoid duplicate manual totals.

Person identity is separate from learner and staff roles. A person may hold multiple roles over time. School assignment, learner enrolment and teacher allocation are time-bounded relationships, not mutable fields on the person record. Do not auto-merge records based on similar names. Candidate identity matches require authorised identifiers and governed review with an audit trail.

### Curriculum
- CurriculumAuthority: issuing authority and source catalogue.
- CurriculumEdition: official version, publication date, effective period, status and source reference.
- CurriculumPathway: regular or applicable adapted pathway, with scope and governance rules.
- EducationLevel and Grade: ordered progression levels and grade identifiers.
- LearningArea: versioned learning area/subject definition.
- Strand and SubStrand: hierarchical curriculum structure.
- LearningOutcome: general or specific outcome, stable local key within its edition, description and source location.
- CoreCompetency, Value and PertinentContemporaryIssue: controlled curriculum concepts.
- LearningExperience: suggested activity/experience linked to relevant outcomes.
- KeyInquiryQuestion: curriculum question linked to a sub-strand/outcome as appropriate.
- AssessmentRubric and RubricCriterion: criteria, levels/descriptors and provenance.
- CurriculumCrosswalk: reviewed mapping between editions, pathways or local labels.

Curriculum content must be versioned and immutable once approved for operational use. Corrections create a new revision or superseding edition; they must not silently rewrite historical results. Preserve exact official wording and source provenance. Distinguish imported source text from reviewed platform interpretation.

Special Needs Education designs must be represented as curriculum pathways/editions and their applicable structures, not as separate duplicate learner identities or a single generic disability flag. Access to sensitive learner support information must be separately governed and minimised.

### Teaching and learning
Potential entities, subject to workflow validation: TeachingPlan/SchemeOfWork, LessonPlan, LearningActivity, LearningResource, ClassroomEvidence, TeacherReflection and CurriculumCoverageRecord. Plans and classroom evidence should reference curriculum outcomes and class/teacher assignments. Teachers should not re-enter learner or curriculum master data already held elsewhere.

### Assessment
- AssessmentProgramme: recurring or governed assessment programme.
- AssessmentEvent: specific assessment instance, type, scope, period, owner and status.
- AssessmentInstrument: paper, task, practical activity or other instrument.
- AssessmentSection and AssessmentItem: structural components/questions/tasks.
- AssessmentBlueprint: planned coverage, weighting and intended outcomes.
- ItemOutcomeMapping: reviewed link from item/task to one or more versioned learning outcomes, with rationale and reviewer.
- ScoringScheme: versioned maximum scores, weights, grading/performance rules and rounding policy.
- AssessmentRegistration: eligible learner/class/school participation.
- AssessmentAttempt: learner participation/attempt and status.
- MarkEntry: raw score and marker/provenance.
- ModerationRecord: review, sampling, adjustments and rationale.
- ResultApproval: approval stage, actor, timestamp and scope.
- ResultPublication: publication event and audience/scope.
- ImportBatch, ImportRow and ReconciliationCase: ingestion provenance, row-level validation and resolution.

Assessment types must be configurable, including internal formative, internal summative, school-based, inter-school, zonal and external/national assessment. Do not hard-code one exam format or assume every assessment is a written paper.

### Progress and intervention
- PerformanceResult: validated score/result tied to an attempt and scoring context.
- OutcomeEvidence: evidence associated with a versioned outcome and assessment/activity source.
- ProgressSnapshot: derived view over a defined learner/time/outcome scope.
- MasteryEstimate: explicitly labelled interpretation, method/version and confidence—not a raw mark.
- LearningNeed: educator-reviewed need or gap with evidence and review date.
- InterventionPlan: intended support, owner, target outcomes and dates.
- InterventionActivity: action taken and resources.
- InterventionReview: follow-up evidence, educator decision and next review.

Intervention recommendations must remain reviewable and educator-led. The platform must not autonomously assign official grades, deny progression or make other high-stakes learner decisions.

## 4. Critical relationship and lifecycle rules

1. A Person can have a learner profile, staff profile, guardian relationship or multiple roles without duplicate person records.
2. A learner may have multiple sequential enrolments and transfers; historical assessments remain attached to the correct enrolment and assessment context.
3. A teacher may have multiple time-bounded school and teaching assignments; workload is calculated from approved assignments and timetable rules.
4. A class group exists within a school and academic period; learners join through enrolment/placement relationships.
5. An assessment event may target one or many schools/classes and one or many grades/learning areas, subject to programme rules.
6. Every assessment attempt resolves to a learner identity, relevant enrolment, assessment event and scoring scheme version.
7. Every curriculum outcome mapping resolves to a specific curriculum edition and pathway.
8. A published result is immutable as a publication snapshot. Corrections are new, reasoned, authorised revisions with prior values preserved.
9. Analytics are derived from authoritative data and carry data-as-of time, filters, denominator, coverage and lineage.
10. Imports are idempotent within a declared source and import scope. Duplicate detection must not destroy valid repeated attempts or legitimate multi-source records.
11. Organisation-scope checks happen server-side on every protected query and mutation.
12. Deletion, archival and anonymisation follow approved retention/legal rules; referential history must not be broken by casual hard deletion.

## 5. Core end-to-end workflows

### A. Institution setup and academic-year rollover
1. Authorised administrator creates or verifies organisation hierarchy and school profile.
2. Configure academic year, terms, grades, learning areas and class groups.
3. Assign authorised users and organisational scopes.
4. Validate reference data and resolve duplicates before opening the year.
5. Rollover creates new class/enrolment placement records while preserving prior-year history.
6. Reconciliation identifies learners with missing placement, conflicting status or incomplete records.

### B. Learner admission, progression and transfer
1. Search for an existing learner using governed identifiers and authorised matching.
2. If no confirmed match exists, create a new learner identity and record admission source.
3. Create enrolment with school, grade, class, academic period and effective date.
4. Record progression as a new time-bounded placement, not overwriting the old one.
5. For transfer, record sending/receiving institution, effective date and required approval/evidence.
6. Preserve prior enrolments, assessment attempts and interventions.
7. Restrict guardian access to explicitly authorised relationships and current policy.

### C. Teacher onboarding and teaching allocation
1. Create or match a staff/person record under the authorised workforce owner.
2. Record engagement/employment relationship and required verification.
3. Assign school, role, learning area, grade and class with effective dates.
4. Validate qualifications/permissions where policy requires them.
5. Compute workload from assignments and timetable rules; flag conflicts and overload.
6. Record approvals and history; changes do not erase prior assignments.

### D. Curriculum publication and adoption
1. Register official source, edition, publication/effective dates and grade/pathway coverage.
2. Ingest source structure into staging; preserve source file and page/section provenance.
3. Validate hierarchy, identifiers, duplicate nodes, missing descriptions and relationships.
4. Curriculum specialist reviews wording, structure and crosswalks.
5. Approve and publish an immutable edition.
6. Schools adopt applicable editions/pathways for an academic period.
7. New editions do not silently alter historical assessment mappings.

### E. Assessment creation and administration
1. Assessment owner creates event with purpose, type, scope, dates and responsible organisation.
2. Select grades, learning areas, eligible classes/schools and assessment format.
3. Define blueprint, items/tasks, scoring scheme and moderation policy.
4. Map items to curriculum outcomes using reviewed, version-specific mappings.
5. Validate timetable, learner eligibility and instrument completeness.
6. Administer and capture attendance/attempt status where required.
7. Mark, moderate and resolve anomalies.
8. Approve results and publish only to authorised audiences.

### F. Results import and reconciliation
1. Create import batch with source organisation, assessment, source version and uploader.
2. Preview file structure and proposed field mappings before writing records.
3. Validate identity, enrolment, grade, school, assessment, score range and duplicate semantics.
4. Quarantine invalid/ambiguous rows; show row-level explanations.
5. Commit valid rows idempotently with source lineage.
6. Compare imported row counts and totals with school/category/cluster aggregates.
7. Assign discrepancies to a named reviewer and record resolution.
8. Lock or approve the batch; retain original source and correction history.

### G. Inter-school and system analytics
1. User selects an authorised geography/organisation scope, period, grade and assessment.
2. System resolves eligible population, participating population and valid-result population separately.
3. Display numerator, denominator, participation/coverage and data-quality caveats.
4. Compare like-for-like assessment, scoring rules, curriculum versions and cohort definitions.
5. Suppress or aggregate small groups according to approved disclosure rules.
6. Allow drill-down only within user's authorised scope.
7. Exports retain filters, data-as-of time, lineage and export audit event.

### H. Learning support and intervention
1. Teacher reviews assessment/activity evidence and identifies a possible learning need.
2. Evidence is linked to relevant curriculum outcomes; system may surface patterns for review.
3. Educator confirms, amends or dismisses the suggested need.
4. Assign intervention owner, activities, target outcomes and review date.
5. Capture follow-up evidence and educator reflection.
6. Evaluate progress using comparable evidence and document next action.
7. Do not treat absence of evidence as proof of inability or low mastery.

### I. Data correction and governance
1. User raises correction case with affected record, reason and evidence.
2. System checks authority and scope; sensitive changes require approval.
3. Record old/new values, actor, time, reason, source and approval.
4. Recompute affected derived analytics and mark stale snapshots.
5. Notify affected authorised users where policy requires.
6. Preserve audit history and prevent unauthorised erasure.

## 6. Redundancy and consistency controls

- One canonical Person record; role-specific profiles extend rather than copy identities.
- One canonical School/Organisation record; module references point to it.
- One curriculum catalogue per authority/edition/pathway; local labels use crosswalks.
- One assessment definition and scoring context per assessment event/version.
- Results store foreign keys and source provenance, not repeated copies of full curriculum or school records.
- Reporting tables/materialised views are rebuildable projections, never authoritative master records.
- Use database uniqueness and foreign-key constraints for stable identity and relationship rules.
- Use transaction boundaries for admission, transfer, result approval and publication.
- Use idempotency keys for imports and external event processing.
- Use explicit status/state machines instead of contradictory boolean flags.
- Store effective dates and audit timestamps separately; distinguish valid time from record/transaction time where corrections matter.
- Define data ownership and update authority for every shared entity before implementation.

## 7. Initial solution priority hypotheses

These are hypotheses to test, not final release commitments.

| Candidate capability | Likely value | Main risk/unknown | Discovery priority |
|---|---|---|---|
| Canonical organisation, person and enrolment records | Removes duplicate entry and enables connected workflows | Identity governance and source quality | Very high |
| Role/scope access and audit foundation | Protects child and institutional records | Actual authority matrix and safeguarding policy | Very high |
| Curriculum versioning for Grades 1–9 and pathways | Enables valid planning and assessment interpretation | Complete official source ingestion and expert review | Very high |
| Assessment setup, import, validation and reconciliation | Reduces errors and improves trusted results | Source formats and moderation workflow diversity | Very high |
| Teacher/staff assignments and workload | Supports workforce visibility and teaching allocation | Workforce data authority and policy | High |
| Inter-school analytics with denominator/coverage | Supports evidence-based improvement | Comparable assessment definitions and disclosure rules | High |
| Learner progress and intervention | Converts results into learning support | Educator workflow, evidence quality and workload | High |
| Advanced AI insights | May reduce analysis effort | Bias, explainability, privacy and evidence validity | Later, after reliable data foundation |

## 8. Decisions required before physical schema and production implementation

- Confirm legal entity/data-controller and processor responsibilities, data-sharing agreements and applicable retention rules.
- Confirm whether the platform is multi-tenant across independent institutions, one authority with many schools, or both.
- Approve canonical organisation hierarchy and whether schools can participate in multiple reporting groupings.
- Define teacher/workforce data authority and what records may be stored.
- Define guardian access, learner access and safeguarding boundaries by grade/age and policy.
- Confirm assessment event taxonomy, external assessment data exchange and official result ownership.
- Confirm curriculum version authority, adoption dates, regular/adapted pathway rules and approval process.
- Confirm connectivity, devices, offline requirements, expected volumes, peak concurrency and support model.
- Confirm integration contracts and identifiers for existing education systems.
- Set measurable availability, recovery, performance, privacy and audit requirements.

## 9. KICD source catalogue baseline

The official KICD catalogue presents regular curriculum designs by education level: Lower Primary Grades 1–3, Upper Primary Grades 4–6 and Junior School Grades 7–9. KICD also exposes adapted Special Needs Education designs across multiple grades and categories.

Official catalogue references:
- Regular designs: https://kicd.ac.ke/cbc-materials/curriculum-designs/regular-curriculum-designs/
- Lower Primary: https://kicd.ac.ke/cbc-materials/lower-primary/
- Upper Primary: https://kicd.ac.ke/cbc-materials/curriculum-designs/upper-primary-designs/
- Junior School: https://kicd.ac.ke/cbc-materials/curriculum-designs/junior-school-designs/
- Special Needs Education: https://kicd.ac.ke/cbc-materials/curriculum-designs/sne-curriculum-designs/

The catalogue is a discovery index, not a complete structured data feed. Each design must be registered by official source, grade, learning area, pathway, edition, publication/effective date and content provenance. Do not assume a current catalogue page proves which version a school used historically.

## 10. Implementation readiness checklist

A domain/workflow is ready to move into physical schema and code only when:
- Named owner and users have validated the workflow.
- Business states, transitions and exceptions are documented.
- Canonical entities and authoritative data owner are agreed.
- Identifiers, uniqueness and duplicate resolution rules are approved.
- Privacy classification, access scopes and audit requirements are defined.
- Source/import/integration contracts and correction semantics are known.
- Historical migration and reconciliation are planned.
- Acceptance tests cover success, invalid input, concurrency, failure and recovery.
- Operational monitoring, support and rollback are defined.
