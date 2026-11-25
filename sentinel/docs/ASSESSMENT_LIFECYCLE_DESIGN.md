# Sentinel — Assessment Lifecycle Design

**Status:** Partially implemented foundation. Domain contracts, migrations 0012–0013, assessment RLS, an immutable eligible-enrolment roster, controlled event scheduling and a read-only events API are implemented; remaining write workflows are pending.
**Scope:** First vertical slice for internal school-based assessment. Inter-school, zonal and external assessment exchange follow after the core lifecycle and governance contracts are proven.

## 1. Current repository and database facts

The current Sentinel PostgreSQL schema contains organisation, identity, learner, class, enrolment, guardian, audit, curriculum and assessment lifecycle tables. Assessment migration 0012 added programmes, instrument versions, tasks, outcome mappings, events, attempts, responses, results and decisions. Migration 0013 added a frozen eligible-enrolment roster and a controlled scheduling operation.

The learner model provides tenant-scoped learner profiles and effective-dated enrolments. The curriculum model provides versioned design documents and source nodes. Source-node types already reserve `specific_outcome`, `general_outcome`, `assessment_rubric` and `rubric_criterion`, but the current Grade 6 CRE sample contains only strand/sub-strand headings. It must not be treated as a verified outcome bank.

## 2. Core domain model

| Aggregate / record | Purpose | Key relationships |
|---|---|---|
| Assessment programme | Defines the governed assessment context (e.g. school-based formative or summative) | Tenant organisation; programme type and scope |
| Assessment event | A scheduled assessment occurrence for a grade, learning area and academic period | Programme; tenant; grade; learning area; academic year/term |
| Instrument version | Immutable version of an assessment instrument and its scoring contract | Event; version number; approval state |
| Task / item | A question, practical task, observation or performance task within an instrument | Instrument version; response type; score maximum |
| Outcome mapping | Records why a task measures a particular curriculum outcome | Task; exact curriculum source node/version; mapping review decision |
| Scoring scheme | Versioned scoring rules and performance-level definitions | Instrument version; maximum/normalisation rules |
| Assessment attempt | One learner's participation in one instrument version | Learner enrolment; event; instrument version; attempt number |
| Response / evidence | Captured answer, observation or submitted evidence for one task | Attempt; task; capture actor/time; marking state |
| Result | Approved score/performance summary for an attempt | Attempt; scoring scheme version; moderation and approval decisions |
| Moderation / decision | Append-only review, approval, rejection or correction decision | Result/attempt; actor; reason; timestamp |
| Import batch | Staged external or spreadsheet ingestion with row-level reconciliation | Source file metadata; batch status; row errors; audit events |

Use relational columns for identifiers, scope, state, dates and score values. Use JSONB only for genuinely variable response payloads and captured scoring evidence, not as a substitute for core relational integrity.

## 3. Non-negotiable invariants

1. **Tenant and enrolment integrity:** An attempt must reference an enrolment belonging to the same tenant and organisation as the assessment event. Grade and academic year must match the event, and the enrolment must be present in the event’s immutable eligibility snapshot. Do not accept a learner profile ID where an enrolment ID is required.
2. **Version provenance:** Every attempt and result references one exact instrument version and one exact scoring-scheme version. Editing an instrument after an attempt exists creates a new version.
3. **Curriculum provenance:** Outcome mappings reference an exact curriculum document/source-node version. Only reviewed/approved `specific_outcome` records can be used for official outcome-level reporting. Strand/sub-strand headings are not learning outcomes.
4. **Separate measures:** Raw response, awarded task score, total score, performance level and inferred mastery are distinct values. A mark is not automatically mastery.
5. **Immutable history:** Submitted attempts, published results and moderation decisions are not overwritten. Corrections create a superseding version or append-only correction record with actor, reason and prior value.
6. **Controlled state transitions:** Draft, scheduled, open, closed, marking, moderated, approved, published, corrected and archived transitions are server-side use cases with explicit preconditions.
7. **Auditability:** Creation, submission, marking, moderation, approval, publication, import, correction and export emit audit events.
8. **Scope security:** Database RLS and server-side authorization both enforce tenant/organisation scope. A valid session alone is not assessment authority.
9. **Denominator clarity:** Reporting distinguishes eligible learners, participants, submitted attempts, valid results and approved/published results.
10. **No unapproved external data:** External assessment connectors require documented contracts, data authority, validation rules and reconciliation before activation.

## 4. Initial workflow

1. An authorised assessment officer creates an event for a grade, learning area and academic period.
2. The officer creates or selects an instrument version and defines task types, score maxima and scoring scheme.
3. Tasks are mapped to approved curriculum outcomes where available. If no verified outcomes exist, the event may proceed with an explicit unmapped status, but cannot claim outcome-level coverage.
4. The event is reviewed and scheduled through `sentinel_private.schedule_assessment_event`. Scheduling requires an approved instrument and active programme, snapshots active learner profiles with active enrolments effective on the event start date, records the eligibility denominator and actor in audit history, and changes the event status atomically. The snapshot is immutable; the attempt foreign key rejects anyone outside it. The event date is interpreted in UTC until an organisation timezone is modelled.
5. An authorised teacher captures or imports attempts against current enrolments. The system validates tenant, school, grade, year, event window and duplicate-attempt rules.
6. Responses are marked against the exact scoring scheme. Raw responses remain distinguishable from awarded scores.
7. Results enter moderation where required. Moderators record decisions without silently changing original marks.
8. An authorised approver publishes the result set. Published reports display coverage, denominators, data-quality warnings and as-of time.
9. Corrections use a reasoned superseding record and trigger recalculation of derived reports while retaining the original publication lineage.

## 5. First release boundary

Implement first:
- tenant-scoped school-based assessment programmes and events;
- instrument versioning and task definitions;
- versioned scoring schemes and performance levels;
- learner attempts linked to enrolments;
- response capture and marking;
- reviewed outcome mappings (enabled only when approved outcome records exist);
- moderation/approval decisions and publication state;
- audit events and denominator-aware school summaries.

Defer:
- inter-school/zonal standardisation and external national assessment connectors;
- automated marking of high-stakes responses;
- predictive learner-risk scores or automated progression decisions;
- AI-generated scores or official competency judgements;
- broad offline conflict resolution until pilot connectivity and sync requirements are measured.

## 6. Implementation sequence and exit criteria

1. **Domain contracts — implemented:** Event/attempt lifecycle, enrolment scope, scoring and immutability contracts have 13 focused unit tests.
2. **Database schema and migrations — implemented on development:** Migration 0012 adds nine relational tables, composite tenant/grade/year/instrument/enrolment constraints, forced RLS, approved-outcome mapping validation, append-only result/decision history and instrument locking. Migration 0013 adds the immutable eligible-enrolment roster, a roster FK on attempts, forced RLS and the audited `schedule_assessment_event` SECURITY DEFINER operation. The runtime role has SELECT-only table access; scheduling is exposed only through the controlled function.
3. **Read API — implemented:** GET /api/organisations/{organisationId}/assessments/events has both application role preflight and database RLS. Only platform administrators, organisation administrators, school administrators and assessors may read assessment data; teachers/viewers remain denied pending class assignment modelling.
4. **Controlled application use cases — pending:** Event creation, instrument versioning, attempt capture, marking, moderation, approval and publication. No direct client writes.
5. **API and UI — pending:** Build authorised workflows with server-side scope checks, clear validation feedback and accessible forms.
6. **Synthetic integration tests — pending:** Exercise scheduling with effective-dated eligible/ineligible enrolments, empty rosters, non-approved instruments, inactive programmes, concurrent scheduling, attempts outside the roster, two tenants, mismatched grade/year, duplicate attempts, stale instrument versions, unapproved outcomes, correction history and RLS denial.
7. **Reporting — pending:** Reconcile eligible, participating, submitted, valid and approved denominators against source attempts.

Exit only when every published result can be traced to learner enrolment, assessment event, immutable instrument/scoring version, curriculum mapping status, marking evidence and approval history, and cross-tenant negative tests pass.

## 7. Open decisions before external assessment

- Who is the legal owner/controller of each assessment dataset and who may approve publication?
- Which academic-period model is authoritative across schools?
- Which programme types require moderation and double marking?
- What are the correction windows and approval authorities after publication?
- What external assessment file/API contracts are authorised, and which identifiers are stable?
- Which retention and disclosure rules apply to raw responses, learner work and published reports?

These decisions should be validated with institutional owners before enabling inter-school or external assessment ingestion.
