# Sentinel — Product Requirements (Draft)

**Status:** Draft for discovery and validation  
**Source of truth:** Sentinel Notion Product & Engineering Blueprint; external implementation brief and source assessment files remain to be verified.

## Problem statement
Education teams need a reliable way to connect curriculum expectations, assessment evidence, learner progress and follow-up interventions. A marks register alone does not provide a complete learning-improvement workflow.

## Outcomes
1. Capture assessment evidence accurately and traceably.
2. Relate assessment tasks to versioned curriculum outcomes.
3. Understand learner progress over time.
4. Identify and manage learning-support interventions.
5. Provide trustworthy school, cluster and zone reporting.
6. Protect children's personal data through scoped access and auditable handling.

## Primary actors
- Education administrator
- Zonal or cluster coordinator
- School leader
- Teacher / assessment officer
- Learner or guardian (only where approved use cases require access)

## Functional requirements
### Organisation and access
- Represent county, sub-county, zone, cluster and school relationships.
- Assign users roles and organisational scopes.
- Enforce server-side tenant and scope checks on every protected operation.

### Curriculum
- Store curriculum versions and effective dates.
- Represent grades, learning areas, strands, sub-strands, outcomes, competencies, values, PCIs and rubrics where present in the official source.
- Preserve source provenance for imported curriculum records.

### Assessment
- Create assessment events and instruments.
- Configure scoring rules and performance levels.
- Map questions/tasks to curriculum outcomes.
- Import structured results with preview, validation and row-level errors.
- Preserve import batch, source file metadata and correction history.

### Learners and progress
- Maintain a stable learner identity separate from school enrolment.
- Preserve enrolment and transfer history.
- Record assessment attempts and outcome evidence.
- Distinguish raw marks, performance levels and outcome mastery.

### Interventions
- Record identified learning needs.
- Assign an intervention owner, plan, activities and dates.
- Capture follow-up evidence and educator review.

### Reporting
- Report by school, cluster, zone, grade, learning area and assessment period.
- Display denominators, coverage and data-quality warnings.
- Restrict small-group disclosure where individuals could be identified.

### Governance
- Record auditable changes, approvals, imports and exports.
- Support controlled export and retention policies.

## Non-functional requirements
- Security: least privilege, secure sessions, encryption in transit and at rest, audit trails.
- Privacy: data minimisation, purpose limitation, retention and controlled disclosure.
- Reliability: backups, restore tests, idempotent imports and recoverable background jobs.
- Accessibility: responsive interfaces and accessible interaction patterns.
- Performance: define measurable service targets during discovery and pilot.
- Maintainability: modular domain boundaries, migrations, automated tests and documented operations.
- Offline resilience: validate connectivity conditions in pilot schools before selecting an offline-sync design.

## MVP boundary — proposed
1. Organisation hierarchy and scoped access.
2. Curriculum repository for the pilot grades and learning areas.
3. Assessment creation and result import/capture.
4. Validation and reconciliation reports.
5. School and zone summaries.
6. Basic learner progress history.
7. Audit logging.

Intervention workflows and advanced analytics can follow once the assessment data model and pilot workflow are proven.

## Acceptance criteria to define during discovery
- A result can be traced to learner, enrolment, assessment, scoring rule and curriculum version.
- Invalid imports are rejected or quarantined with actionable row-level feedback.
- Aggregates reconcile to source records and show explicit denominators.
- Users cannot read or modify records outside their authorised organisational scope.
- Corrections are auditable.
- A learner transfer does not erase historical results.


## Expanded enterprise capability scope — discovery baseline

The product covers Grades 1–9. Grade 6 and Grade 9 source datasets are reference evidence only.

In addition to the initial assessment and learner-progress requirements, discovery must cover:
- Institution, administrative hierarchy, school units, academic years, terms, classes and streams.
- Canonical person identity, learner admission/enrolment/progression/transfer and governed guardian relationships.
- Teacher/workforce profiles, employment/engagement, school assignments, teaching allocations and workload, subject to data authority.
- Teaching and learning operations such as schemes/plans, lesson preparation, learning activities, classroom evidence and curriculum coverage where validated.
- KICD curriculum editions and pathways, including regular and applicable adapted/Special Needs Education designs.
- Internal formative/summative, school-based, inter-school, zonal and external/national assessments.
- Assessment instruments, blueprints, items/tasks, outcome mappings, scoring schemes, marking, moderation, approvals, publication and imports.
- Learner progress, educator-reviewed learning needs, interventions, follow-up and impact review.
- Inter-school and system analytics with eligible/participating/valid-result denominators, coverage, lineage and disclosure controls.
- Governance, approvals, audit, privacy, retention, controlled exports, data quality and integration management.

## Cross-domain invariants

- One canonical Person identity; learner/staff profiles and relationships extend it.
- Learner enrolments and teacher assignments are effective-dated and preserve history.
- School and administrative hierarchy is configurable and historically traceable.
- Curriculum editions/pathways are immutable once approved for operational use; mappings refer to exact versions.
- Raw marks, performance levels and outcome mastery estimates are distinct.
- Assessment results retain attempt, scoring and curriculum provenance.
- Analytics are derived read models, not competing sources of truth.
- Imports are idempotent, previewable, reconcilable and traceable.
- Organisation-scope enforcement is server-side for every protected operation.
- AI-generated analysis is assistive and reviewable; official learner decisions remain with authorised educators.

Detailed conceptual model, relationship invariants and workflow sequences: [DOMAIN_MODEL_AND_WORKFLOWS.md](https://github.com/gvffbhdvgf/cbe/blob/sentinel/bootstrap/sentinel/docs/DOMAIN_MODEL_AND_WORKFLOWS.md).
