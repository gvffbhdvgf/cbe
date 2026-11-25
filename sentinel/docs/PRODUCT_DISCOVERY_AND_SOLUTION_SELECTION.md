# Sentinel — Product Discovery, Design Thinking & Solution Selection

**Status:** Discovery framework and scope baseline (draft)  
**Date:** 25 November 2026

## 1. Product intent

Sentinel is a comprehensive, enterprise-grade education management and intelligence platform supporting the full learning journey from Grade 1 through Grade 9. Grade 6 and Grade 9 assessment records already reviewed are reference evidence for validating real-world data, assessment workflows and reporting—not boundaries on product scope.

The platform should connect the operational work of schools and education administrators with curriculum, teaching, learning, assessment, institutional improvement and accountable decision-making. It must reduce fragmented systems, repeated data capture, inconsistent identities, manual reconciliation and disconnected reporting.

This document establishes a discovery and decision method. It does not pretend that unvalidated workflows, regulations, user roles or feature priorities have already been approved.

## 2. Product scope to investigate

The following are capability domains to validate with real users and institutions. They are not a commitment to build every proposed feature in the first release.

1. **Institution and organisation management:** education authority, county/sub-county/zone/cluster, school, campus, academic year, term, class/stream and organisational relationships.
2. **Learner management:** identity, admission, enrolment, guardians, class placement, transfers, progression, attendance where required, learner support and longitudinal history.
3. **Teacher and workforce management:** teacher identity, qualifications/credentials where authorised, employment/engagement, school assignment, teaching allocation, subjects/learning areas, class responsibilities, workload and professional development workflows.
4. **Curriculum intelligence:** versioned Grade 1–9 curriculum, learning areas, strands, sub-strands, learning outcomes, competencies, values, PCIs, learning experiences and assessment rubrics; retain official source/version provenance.
5. **Teaching and learning operations:** schemes/plans, lesson preparation, learning resources, classroom evidence and follow-up workflows, subject to institutional validation.
6. **Assessment management:** internal formative and summative assessments, school-based assessments, inter-school/zonal assessments, external/national assessments, assessment calendars, instruments, item banks, moderation, marking, imports, validation, approval and publication.
7. **Learner progress and intervention:** performance history, outcome evidence, learning gaps, support plans, responsible educators, follow-up and impact review.
8. **Inter-school and system analytics:** comparisons across classes, schools, clusters, zones and administrative levels; cohort trends, curriculum coverage, assessment participation, equity/coverage views and denominator-aware reporting.
9. **Governance and security:** identity and access management, role/attribute/scope permissions, approvals, audit trails, privacy controls, data lifecycle, retention, exports and incident handling.
10. **Platform administration and integration:** configuration, reference data, import/export, APIs, notifications, reporting, observability, backup/recovery and integrations with approved external systems.

## 3. Design-thinking discovery cycle

Use a continuous, evidence-led cycle:

### Empathise
- Interview and observe learners (age-appropriate and safeguarded), teachers, school leaders, assessment coordinators, curriculum support personnel, administrators and authorised guardians.
- Observe actual work: enrolment, teacher allocation, assessment creation, marking, moderation, result approval, transfers, intervention and report preparation.
- Capture user goals, workarounds, constraints, incentives, accessibility needs, connectivity and device realities.
- Do not treat a stakeholder's proposed feature as proof of the underlying problem.

### Define
- Convert observations into evidence-backed problem statements.
- Identify the affected user, context, frequency, severity, current workaround, cost/risk and desired outcome.
- Distinguish root causes from symptoms; map handoffs, duplicate entry, bottlenecks and failure points.
- State assumptions and confidence explicitly.

### Ideate
- Generate multiple materially different solution options before selecting one.
- Consider process simplification, policy or workflow change, better data standards, integration, automation and software features—not software alone.
- Include low-connectivity and assisted workflows.
- Challenge whether a proposed capability should be centralised, delegated, automated or removed.

### Prototype
- Start with low-cost journey maps, service blueprints, data-flow diagrams, paper sketches and clickable UI prototypes.
- Prototype high-risk workflows first: learner identity/transfer, teacher assignment, assessment setup, marking/moderation, result publication, imports and cross-school reporting.
- Use synthetic or properly de-identified data in prototypes.

### Test and learn
- Test task completion, error rates, time-on-task, comprehension, accessibility, trust and recovery from mistakes.
- Test with representative users and realistic data volumes/connectivity.
- Record evidence, revise assumptions and repeat.
- Do not call a prototype validated merely because stakeholders like its appearance.

## 4. Problem and value register

Maintain a traceable register with these fields:

- Problem ID and concise problem statement
- User/stakeholder segment and affected workflow
- Evidence/source, date and confidence
- Frequency, severity and reach
- Current workaround and operational cost
- Root-cause hypothesis
- Desired user and institutional outcome
- Baseline metric and target metric
- Constraints, risks and dependencies
- Candidate solution options
- Validation method and result
- Decision, rationale, owner and review date

A problem without evidence remains a hypothesis. A solution without a measurable intended outcome remains an idea.

## 5. Solution selection algorithm

Use a transparent weighted decision model to rank candidate solutions after discovery. First apply hard gates; then score viable options.

### Hard gates
Reject or redesign an option if it:
- Violates child safeguarding, privacy, security or applicable law.
- Creates unacceptable institutional or learner harm.
- Depends on data or authority the institution cannot lawfully provide.
- Cannot be operated, supported or recovered within realistic constraints.
- Introduces unacceptable lock-in or a critical single point of failure without mitigation.

### Weighted score
Score each surviving option from 1 (poor) to 5 (excellent), with evidence and confidence recorded. Initial weights are proposed and must be calibrated with stakeholders:

| Criterion | Weight |
|---|---:|
| Learner and educator value / outcome impact | 25% |
| Problem severity and frequency addressed | 15% |
| Reach across schools, grades and workflows | 10% |
| Feasibility and delivery complexity | 10% |
| Data quality, interoperability and redundancy reduction | 10% |
| Security, privacy and safeguarding by design | 10% |
| Usability, accessibility and low-connectivity resilience | 10% |
| Lifecycle cost, operability and maintainability | 5% |
| Evidence confidence and testability | 5% |

Calculate: **weighted score = Σ(weight × rating / 5)**, producing a score out of 100. Keep risk gates separate; a high score cannot compensate for a failed gate.

For prioritisation, also estimate effort and dependencies. Use value-versus-effort as a secondary view, not the sole decision rule. Run sensitivity analysis on weights and uncertain ratings. If small weight changes reverse the ranking, the decision is fragile and should trigger more research or a reversible pilot.

Record the runner-up, rejected alternatives, uncertainty, assumptions and reason for selection. The algorithm informs accountable human decisions; it does not replace them.

## 6. Data architecture principles for less redundancy

- Establish canonical entities and authoritative ownership for each data domain.
- Separate a person's identity from time-bound relationships such as learner enrolment, teacher employment and school assignment.
- Use stable identifiers, controlled reference data and explicit effective dates.
- Avoid copying the same learner, teacher, school, curriculum or assessment master data into separate module-specific records.
- Use relational constraints, unique keys, foreign keys, validation and transaction boundaries to prevent duplicate and orphaned records.
- Model many-to-many relationships explicitly (for example teacher-to-learning-area assignments and assessment-item-to-outcome mappings).
- Preserve source records, provenance, import batches and correction history.
- Treat analytics projections, caches and reporting snapshots as derived/read models with refresh lineage—not competing sources of truth.
- Make imports idempotent, previewable, reconcilable and reversible where feasible.
- Do not merge people based only on similar names; use governed identity matching and human review for ambiguous matches.
- Retain assessment, scoring, curriculum and grading-policy versions with each result.
- Distinguish raw marks, grades/performance levels, learning-outcome evidence and mastery estimates.
- Make data quality visible: completeness, validity, timeliness, uniqueness, consistency and lineage.

## 7. Enterprise quality attributes

Validate and define measurable targets for:
- Security, privacy, child safeguarding and least privilege
- Tenant/organisation isolation and delegated administration
- Availability, recovery objectives, backups and disaster recovery
- Performance at expected peak periods (assessment entry, imports, result release)
- Accessibility and usability across supported devices
- Intermittent/low-bandwidth connectivity and safe retry behaviour
- Auditability, traceability and accountable approvals
- Interoperability, portability and exportability
- Maintainability, observability, testability and controlled releases
- Scalability across Grades 1–9 and multiple institutions

Targets must be based on expected usage, service commitments, risk and budget—not invented in advance.

## 8. Delivery approach

1. **Discovery and evidence:** obtain the original implementation brief, map stakeholders and workflows, validate policy and data sources.
2. **Product definition:** approve personas, journeys, problem register, outcomes, scope boundaries, non-functional requirements and release priorities.
3. **Domain and data design:** define bounded contexts, canonical entities, lifecycle rules, data ownership, integration contracts and audit model.
4. **Architecture and risk validation:** test key technical assumptions, privacy/security model, deployment approach and operational cost.
5. **Prototype and usability validation:** test critical workflows before committing to full implementation.
6. **Foundation release:** identity/access, organisation hierarchy, reference data, audit and core platform controls.
7. **Incremental capability releases:** deliver validated workflows in vertical slices, with migration, training and support.
8. **Pilot, measure and expand:** pilot with representative institutions, evaluate outcomes and quality, fix issues, then expand under controlled release gates.

Do not build every module as a separate microservice by default. Prefer clear domain boundaries and a maintainable architecture; select deployment boundaries only when evidence justifies them.

## 9. Current evidence boundaries and open decisions

- Grade 6 and Grade 9 records are reference evidence only; platform coverage is Grades 1–9.
- Existing assessment evidence is aggregate-oriented and has unresolved source discrepancies. It cannot by itself define all assessment workflows or curriculum mappings.
- Obtain the original Sentinel implementation brief and validate it against stakeholder needs.
- Confirm the actual institutional organisation hierarchy, user groups, permissions and delegated responsibilities.
- Confirm teacher-management scope, including what workforce records are authorised and who owns them.
- Confirm internal, school-based, inter-school, zonal and external assessment types, governance and integrations.
- Confirm which teaching/learning, attendance, guardian and communication workflows are in scope.
- Confirm legal basis, data controller/processor responsibilities, retention, consent/notice, cross-border hosting and data-sharing rules with appropriate institutional/legal owners.
- Confirm expected scale, concurrency, connectivity, supported devices, service levels, operating budget and support model.
- Validate KICD curriculum versions and map assessment items to outcomes only with source instruments and expert review.

## 10. Definition of ready for implementation

A capability is ready for implementation only when it has:
- A validated problem and named user/workflow
- An approved outcome and measurable acceptance criteria
- A tested user journey/prototype for material workflow changes
- Approved functional and non-functional requirements
- Domain model, ownership and data lifecycle rules
- Permission, privacy, audit and threat considerations
- Integration and migration strategy
- Failure, correction and recovery behaviour
- Test strategy, rollout plan, support owner and rollback path
- Documented decision rationale and unresolved risks

This framework is the working baseline for Sentinel discovery. It must evolve as institutional evidence is gathered.
