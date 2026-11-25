# Sentinel — UX Navigation and User Journeys

**Status:** Initial information architecture for prototype testing; not a final UI specification.

## 1. Experience principles

- Organise around user tasks and decisions, not database tables.
- Show only capabilities authorised for the current user.
- Make scope visible: institution, class, assessment, period and data-as-of.
- Keep learner identity and history consistent across modules.
- Prefer guided workflows, validation and recovery over giant forms.
- Show status, owner, next action and exceptions.
- Support keyboard, screen readers, responsive layouts and plain language.
- Test low-bandwidth and constrained devices before selecting offline sync.
- Dashboards must show coverage and uncertainty; avoid false precision.
- Charts need textual summaries and accessible data alternatives.

## 2. Proposed global navigation

- Home: role-specific tasks, approvals, events and quality alerts.
- My work: assigned tasks, deadlines, reviews and follow-ups.
- People: learner and workforce records within scope.
- Organisation: institutions, schools, units, classes and periods.
- Curriculum: KICD editions, pathways, learning areas, outcomes and adoption.
- Teaching & learning: classes, allocations, activities and curriculum coverage.
- Assessment: calendar, instruments, attempts, marking, moderation and publication.
- Progress & support: learner progress, reviewed needs and interventions.
- Insights: school/cluster/zone reports, denominators, coverage and data quality.
- Data exchange: imports, reconciliation, exports and integrations.
- Governance: roles, approvals, audit, privacy requests, retention and configuration.

Capability-based navigation is not an access control boundary.

## 3. Role-based home concepts

| User | Home priorities |
|---|---|
| Platform operator | Service health, jobs, integrations and security events; no learner dashboard by default |
| Authority administrator | Organisation coverage, onboarding, delegated access and approved aggregates |
| School leader | Learner/staff overview, admissions/transfers, assessment calendar and approvals |
| Records officer | Admission queue, identity resolution, enrolment changes, incomplete records |
| Teacher | Assigned classes, learning plans, assessments, learners for review and follow-ups |
| Assessment coordinator | Readiness, instruments, import batches, exceptions, moderation, publication gates |
| Marker/moderator | Assigned queue, progress, exceptions and review tasks |
| Curriculum specialist | Edition ingestion, source review, outcome mapping and adoption |
| Learner | Age-appropriate own learning information |
| Guardian | Verified linked learner summary and permitted notices |
| DPO/auditor | Privacy cases, access reviews, export approvals and compliance evidence |

## 4. Critical journeys

### A. Institution and academic-year setup
Select authorised organisation; confirm profile/calendar/reporting units; create classes/streams; assign staff/delegates; review completeness; publish period; preserve previous periods.

### B. Learner admission and transfer
Search existing identity using permitted identifiers; show masked candidate matches; create or resolve duplicate case; record admission; create effective-dated enrolment; assign grade/class/pathway; for transfer close old and open new enrolment; obtain required approval. History remains intact.

### C. Teacher allocation
Verify staff engagement; assign school/role/subject/class; check overlaps, qualifications where policy requires, and workload; approve; expose only active classes; revoke access when assignment ends.

### D. Curriculum edition adoption
Register official source/checksum; ingest grade, learning area, pathway and nodes; specialist reviews wording, hierarchy and dates; record mapping gaps; approve immutable edition; record school adoption; reference exact edition in teaching and assessment.

### E. Assessment to publication
Define event/cohort/period/grade; version instrument and scoring; map items to reviewed curriculum nodes; validate readiness; administer and record attempts; allocate marking; moderate; reconcile participation and source totals; independent approver publishes immutable snapshot.

### F. Import and reconciliation
Create batch; quarantine/scan/profile; preview inserts, updates, duplicates and rejects; resolve mappings; approve; idempotently commit; reconcile source counts; close or escalate.

### G. Learning support
Teacher reviews evidence and curriculum context; confirms/amends/dismisses possible need; creates plan, goal, activity, owner and review date; records comparable follow-up evidence; educator decides next action. No algorithmic diagnosis.

### H. Analytics
Select authorised geography, grade, period, learning area and assessment; show eligible, participating and valid-result populations separately; expose coverage, missingness, data quality and as-of time; compare only comparable cohorts/scoring/versions; suppress small groups; govern exports.

## 5. Content hierarchy

**People:** Learners (profile, enrolments, history, guardians, progress); Staff (profile, engagement, qualifications, assignments).

**Organisation:** Authority/institution directory; schools/units; academic periods; classes/streams.

**Curriculum:** Source register; editions/pathways; grades/learning areas; strands/sub-strands/outcomes/rubrics; adoption/coverage.

**Assessment:** Calendar/events; instruments/item bank; scoring; administration/attempts; marking/moderation; reconciliation; approval/publication.

**Progress & support:** Learner timeline; outcome evidence; review queue; intervention plans; follow-up.

**Insights:** Institution reports; cluster/zone summaries; participation/coverage; data quality; export centre.

**Governance:** Users/roles/delegation; approvals; audit/access review; privacy requests; retention/configuration.

## 6. Interaction and accessibility requirements

- Persistent scope breadcrumb and current-period indicator.
- Search only within authorised scope; mask sensitive identifiers.
- Forms support draft, field errors, validation summary and safe resume.
- High-impact actions require confirmation, reason and approval as applicable.
- Bulk actions preview counts and masked sample rows.
- Tables support keyboard, sorting, filtering, pagination and labels.
- Charts include text summary, data table and denominator context.
- Avoid colour-only, hover-only or drag-only interaction.
- Preserve work through transient network failure and show queued state accurately.
- Offline support requires conflict, encryption, device-loss and sync policy.

## 7. Prototype test plan

Test with school leaders, records officers, teachers, assessment coordinators, markers/moderators and authority users:

1. Find learner and verify enrolment without exposing another school.
2. Transfer learner while preserving history.
3. Allocate teacher and detect workload conflict.
4. Find exact curriculum edition/outcome used in assessment.
5. Import a file with duplicates, invalid scores and missing identifiers; recover.
6. Moderate and publish only after approval.
7. Create/review intervention without treating missing data as failure.
8. Produce inter-school comparison with denominators and disclosure controls.

Measure task completion, time, error rate, confidence, accessibility barriers, support burden and unintended disclosure. Use synthetic/de-identified data.

## 8. Decisions still open

User language/localisation; device and bandwidth mix; learner/guardian access by age; mobile vs desktop task dominance; offline requirements; organisation hierarchy and delegation; trusted actionable dashboard measures.

Do not begin high-fidelity screens until journeys are tested and the external implementation brief is reconciled.
