# Sentinel — Release Roadmap

**Status:** Proposed; validate with institutional owners. Scope is Grades 1–9. Grade 6/9 datasets are reference evidence only.

## Dependency sequence
1. Governance: data ownership, controller/processor roles, institutional authority.
2. Foundation: identity, scoped access, audit, organisation hierarchy, environments.
3. Canonical records: person, learner/staff profiles, schools, academic periods, enrolments and assignments.
4. Curriculum: versioned Grades 1–9 regular/adapted designs and source provenance.
5. Operations: learner lifecycle, teacher allocation, classes and academic rollover.
6. Assessment: events, instruments, scoring, marking, moderation, approval and publication.
7. Exchange: imports, validation, idempotency, reconciliation and external assessment connectors.
8. Intelligence: learner progress, inter-school analytics, denominators, reporting and exports.
9. Improvement: educator-led learning needs, interventions and follow-up.
10. Advanced: AI assistance and deeper integrations only after reliable data and governance.

## Vertical releases

**Foundation:** Authentication, roles, organisation-scoped permissions, school hierarchy, canonical person identity, academic periods, audit, data quality and observability. Exit when cross-scope negative tests pass and master records reconcile.

**Learner/workforce operations:** Admission, enrolment, placement, progression, transfer, teacher profiles, assignments, workload and academic-year rollover. Exit when learner transfer preserves history and assignments are effective-dated.

**Curriculum intelligence:** KICD source/version registry for Grades 1–9, regular and applicable adapted pathways, learning areas, strands, outcomes, competencies, values, PCIs, experiences, inquiry questions and rubrics where present. Exit when a curriculum specialist verifies an edition and historical results retain the correct version.

**Assessment lifecycle:** Internal, school-based and inter-school/zonal programmes; events, instruments, items, blueprints, scoring, outcome mapping, capture/import, validation, moderation, approval, publication and correction. Exit when every result traces to instrument, attempt, scoring version, curriculum mapping and approval.

**External exchange and intelligence:** External assessment exchange after contracts are approved; reconciliation; learner progress; inter-school analytics with eligible, participating and valid-result denominators; controlled exports. Exit when aggregates reconcile and reports show coverage, filters, as-of time and lineage.

**Learning improvement:** Educator-reviewed needs, intervention plans, owners, activities, reviews and follow-up evidence. AI may later suggest patterns with uncertainty and human review; it never makes official high-stakes decisions.

## Pilot and measurement

Choose representative but controlled institutions with varied connectivity. Across rollout, cover Grades 1–3, 4–6 and 7–9; the first technical pilot need not include every grade. Include an internal assessment and an import/reconciliation workflow. Use synthetic/de-identified data until live-data approvals and required DPIA are complete.

Measure duplicate identities; admission/transfer time; enrolment and teacher-assignment completeness; workload conflicts; import error/reconciliation time; time to approved publication; curriculum provenance; reports with correct denominators; intervention follow-up; user task success/time; security incidents and support burden. Set targets only after baseline measurement.

## Solution selection and release gates

Apply hard gates first: safeguarding, privacy, security, lawful authority, operability and acceptable risk. For viable options, score 1–5 using the weighted model in PRODUCT_DISCOVERY_AND_SOLUTION_SELECTION.md; document evidence/confidence; estimate effort, dependencies, lifecycle cost and reversibility; run sensitivity analysis. If ranking is fragile, gather evidence or run a reversible pilot. A high score cannot override a failed gate; accountable humans approve decisions.

Defer microservices, predictive learner-risk scores, automated interventions, AI grading/ranking/progression, biometrics, public learner leaderboards and broad offline sync until evidence, governance and operational need justify them.

Every release requires approved scope, privacy/threat review, access tests, migration/reconciliation plan, automated and manual tests, monitoring/support/backup readiness, release owner and rollback plan. Production promotion is controlled/manual, not every commit.
## Implementation status — 26 November 2026

### Completed in Preview/development
- Canonical staff profiles linked to Person records, with separate effective-dated staff engagements.
- Verified Teacher-account linking and a database-enforced staff/engagement precondition for teacher-to-class/learning-area allocation.
- Staff register and teaching assignment workspaces, with browser verification on the signed-in Preview.
- Staff tables are forced-RLS and runtime writes are function-only; no real staff data has been added.

### Remaining operational and governance deliverables
1. Guardian identity and relationship verification, with independent approval, evidence references and explicit progress/messaging permissions. The existing guardian relationship table remains fail-closed; no guardian records or runtime access policies are present.
2. Learner transfer requests with sending-institution approval, receiving-institution acceptance, effective dates, history preservation and guardian consent where applicable.
3. Governed learner-record corrections with reason, evidence, independent review and immutable before/after audit.
4. Academic-year rollover with a preview, class-capacity checks, exception handling and independent approval; do not silently promote every learner.
5. Teacher workload reporting after the institution's weekly-period/timetable model is agreed. Current teacher assignments do not yet store weekly periods, so workload totals must not be inferred.
6. External exchange staging, validation, reconciliation and provenance after identity, guardian and transfer controls are in place.

The current development institution has no verified Teacher memberships or guardian relationships. Its existing guardian table is forced-RLS and has no runtime privileges/policies, which keeps access fail-closed. Continue in Preview/development until the relevant governance, privacy, security and operational gates are approved. Production remains untouched.
