# Sentinel — Canonical Data Ownership and Data Dictionary

**Status:** Conceptual baseline; data owners, identifiers and legal authority require institutional validation.

## 1. Design rules

- Store each fact once in its authoritative domain; reference it elsewhere by stable ID.
- Separate a person from roles, enrolments, employment and assignments.
- Preserve history with effective dates and audit/transaction time.
- Record source provenance for imported and corrected facts.
- Never merge people on name similarity alone.
- Reports, search indexes and analytics are rebuildable projections.
- Use governed reference data and versioning rather than uncontrolled free text.
- Minimise and scope child data; never use identifiable learner data in public fixtures/docs.

## 2. Candidate bounded-context ownership

| Domain | Canonical records | Proposed accountable owner (validate) |
|---|---|---|
| Identity & Access | Account, auth subject, role assignment, policy | Platform identity/security authority |
| Organisation | Legal/admin organisation, school, unit, hierarchy, calendar | Authorised institution/education authority |
| People & Workforce | Person, staff profile, engagement, qualification, assignment | Employer / workforce office |
| Learner Records | Learner identity, admission, enrolment, transfer, guardian link | Institution/learner records owner |
| Curriculum | Authority, edition, pathway, grade, learning area, outcome, rubric | KICD source steward + curriculum governance |
| Teaching & Learning | Class, timetable, teaching group, activity, coverage | School academic leadership |
| Assessment | Event, instrument, item, attempt, marking, scoring scheme | Assessment authority |
| Results & Progress | Mark, performance level, outcome evidence, approval, snapshot | Results authority |
| Intervention | Reviewed learning need, plan, activity, follow-up | Educator / school support owner |
| Integration & Exchange | Source, import batch, mapping, row outcome, export, API client | Data integration owner |
| Governance & Audit | Audit, correction, privacy request, retention rule | Controller/DPO/governance authority |

Owners are accountable for facts and authorised changes. Platform operators enforce controls but do not become institutional sources of truth.

## 3. Canonical conceptual dictionary

| Entity | Meaning / key attributes | Integrity rules |
|---|---|---|
| Organisation | Legal entity or recognised administrative unit | Stable internal ID; external IDs namespaced by issuer |
| OrganisationRelationship | Parent/child, membership or reporting relation with valid dates | No hierarchy cycles; history retained |
| School | Institution profile linked to organisation | Registration code unique within issuer; effective status |
| AcademicPeriod | Academic year, term or reporting period | Calendar-owned; overlap rules configurable |
| Person | One human identity | Opaque internal ID; name is not unique |
| PersonIdentifier | Value, issuer, type, validity, verification | Unique only where issuer guarantees it; sensitive |
| LearnerProfile | Learner attributes linked to Person | One canonical profile in governed identity domain |
| Admission | Admission event and decision | Immutable event with source and approver |
| Enrolment | Learner membership in institution/class/grade for period | Effective-dated; transfer closes old and opens new |
| GuardianRelationship | Verified relationship and permissions | Effective-dated; proof separate from access policy |
| StaffProfile | Workforce attributes linked to Person | Distinct from learner profile; minimum fields |
| Engagement | Employment/contract with organisation | Effective-dated and source-owned |
| StaffAssignment | Staff-to-school/role/subject/class | Effective-dated; allocation references assignment |
| CurriculumAuthority | Issuing authority/source | Provenance preserved |
| CurriculumEdition | Immutable source edition/version and dates | Supersede; do not overwrite approved edition |
| CurriculumPathway | Regular or approved adapted/SNE pathway | Versioned; learner association policy-governed |
| LearningArea | Official area within edition/grade | Code and label edition-specific |
| CurriculumNode | Strand, sub-strand, outcome, competency, value, PCI, experience, question, rubric | Typed hierarchy and source order |
| ClassGroup | Institution teaching group for grade/period | Unique within institution/period |
| TeachingAllocation | Staff + class + learning area + period | Conflict/workload checks |
| LearningActivity | Planned/recorded activity linked to curriculum | Author, class, date and evidence |
| AssessmentEvent | Assessment occasion, type, scope and dates | Authority, cohort, grade and period explicit |
| AssessmentInstrument | Versioned paper/task set | Immutable once administered; checksum |
| AssessmentItem | Question/task and maximum score | Stable within instrument version |
| ScoringScheme | Rules, scale and performance levels | Versioned; no silent retroactive changes |
| AssessmentAttempt | Learner + enrolment + event + instrument + status | Attempt uniqueness policy explicit |
| MarkingRecord | Raw score and marker evidence | Range validated; marker and version traceable |
| ModerationCase | Review, variance, adjudication and outcome | Separate from original mark |
| ResultApproval | Approval action and scope | Approver authority and separation of duties |
| PublishedResultSnapshot | Frozen approved result view | Immutable; correction creates successor |
| OutcomeEvidence | Evidence linked to curriculum node and learner | Source, method, confidence and reviewer |
| InterventionPlan | Educator-approved support plan | Need reviewed; not algorithmically definitive |
| InterventionActivity | Activity, owner, date and completion | Linked to plan and target outcome |
| FollowUpReview | Evidence and next action | Reviewer and comparable evidence recorded |
| ImportBatch | Source, uploader, mapping, checksum, status | Idempotency key and immutable source reference |
| ImportRowOutcome | Row key, validation and disposition | Quarantine ambiguous/invalid rows |
| ExportJob | Requester, purpose, filters, scope, format, expiry | Approval, audit and secure download |
| AuditEvent | Actor, action, resource, scope, time, reason | Append-only and access-controlled |
| CorrectionCase | Requested change, evidence, approver and outcome | Before/after and impact preserved |
| PrivacyRequest | Verified request, decision and fulfilment | Restricted case workflow |

## 4. Identifier strategy

- Internal keys: opaque UUID/ULID-style IDs; do not expose sequential database IDs.
- External identifiers: issuer, namespace, type, value, validity and verification stored separately.
- Do not assume a national or school identifier is globally unique without source confirmation.
- Names, birth dates, guardian contacts and school are attributes, not identity keys.
- Duplicate detection creates a human-reviewed case; no automatic fuzzy merge.
- Merges preserve source IDs, aliases, provenance and audit history.
- Imports use source-system key, source version/checksum and batch/idempotency key.

## 5. Time and history

Use valid time (when a fact was true) and transaction time (when Sentinel recorded/corrected it) where needed. Apply effective dating to organisation relationships, enrolments, guardian links, employment, assignments, class membership, curriculum adoption and role grants. Never rewrite past state to make current state appear correct.

## 6. Provenance and correction

For sourced facts retain source system/organisation, source record key, source document reference and checksum, import batch/mapping version, captured time, effective period, actor, validation, reconciliation status and correction reason/evidence/approver. Keep original marks, moderation, approval, publication and correction as separate events. Rebuild projections and supersede snapshots; never silently overwrite.

## 7. Data classification baseline

| Class | Examples | Handling |
|---|---|---|
| Public | Published curriculum source links | Public where source/licence permits |
| Internal | Non-sensitive configuration | Authenticated scoped access |
| Confidential | Staff records, unpublished assessments | Least privilege, audit, controlled export |
| Restricted child data | Learner IDs, marks, guardian links, support needs | Strong scope, minimisation, encryption, sensitive-read audit |
| Security secrets | Credentials, keys, recovery codes | Secret manager only |

Controller/DPO must approve final classification and retention.

## 8. Governed reference data

Maintain versioned catalogues for organisation types/relationships, institution status, grades/stages, class conventions, academic periods, assessment types/states, scoring scales, curriculum authorities/editions/pathways/node types, intervention states, import error codes and export purposes.

## 9. Schema-readiness gates

Confirm controllers/processors and sharing contracts; organisation hierarchy and tenant boundary; identifier issuers and duplicate workflow; learner/staff/guardian minimum data and retention; assessment/result correction semantics; curriculum ingestion and adoption; constraints/concurrency/deletion rules; DPIA/security controls; migration/reconciliation plan and synthetic fixtures; named domain-owner approval.

This is a conceptual dictionary, not a production schema or permission to import live learner data.
