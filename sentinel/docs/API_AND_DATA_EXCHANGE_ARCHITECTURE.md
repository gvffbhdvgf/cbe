# Sentinel — API and Data Exchange Architecture

**Status:** Proposed; external contracts and institutional authority remain unverified.

## 1. Principles

- API contracts follow bounded contexts and canonical ownership.
- Every request is authenticated, authorised by resource/action/scope, validated and audited where sensitive.
- Tenant and organisation scope come from trusted server-side identity, never client-supplied tenant IDs.
- Imports are staged, previewable, idempotent and reconcilable.
- External data is untrusted until validated; files are quarantined and scanned.
- Exports are purpose-bound, minimised, approved where required, encrypted and time-limited.
- Long-running operations use observable background jobs and safe retries.
- Keep a modular monolith initially; network microservices are not required for internal module boundaries.

## 2. Logical API boundaries

| API area | Owns | Example operations |
|---|---|---|
| Identity & Access | Accounts, roles, delegation, policy | Read profile; request/approve role grant |
| Organisation | Institutions, units, academic periods | Create unit; list scoped schools |
| People & Workforce | Person/staff profiles and assignments | Search staff; assign teacher |
| Learner Records | Learner, admission, enrolment, transfer | Admit; transfer; resolve duplicate case |
| Curriculum | Editions, pathways, outcomes | Register/import/review/publish edition |
| Teaching & Learning | Classes, allocations, activities | Create class; record activity |
| Assessment | Events, instruments, items, scoring, attempts | Create event; allocate marker |
| Results & Progress | Marks, moderation, approvals, snapshots | Record mark; moderate; publish |
| Intervention | Reviewed plans and follow-ups | Create plan; record review |
| Analytics | Governed aggregates | Request scoped summary with denominators |
| Integration & Exchange | Import/export and connectors | Preview, commit and reconcile batch |
| Governance & Audit | Corrections, privacy, audit, retention | Raise case; retrieve authorised audit |

## 3. Contract conventions

- HTTPS only; JSON for application APIs; multipart/resumable or signed object upload for files.
- Stable external contracts use /api/v1; internal module interfaces version with application release.
- Validate request and response schemas at boundaries.
- Opaque IDs do not prove access; every lookup re-evaluates scope.
- Standard error envelope: code, safe message, correlationId and optional field details.
- Never return stack traces, SQL, internal paths, tokens or unnecessary child data.
- Cursor pagination with stable ordering and maximum page sizes.
- Optimistic concurrency/version checks for mutable records.
- Idempotency keys for commands and webhook events.
- Record actor, scope, policy version and correlation ID for sensitive transitions.
- Apply rate limits, request-size limits and abuse detection.

Candidate error codes: VALIDATION_FAILED, SCOPE_DENIED, CONFLICT, DUPLICATE_CANDIDATE, IMPORT_QUARANTINED, APPROVAL_REQUIRED, STALE_VERSION, RATE_LIMITED.

## 4. Import lifecycle

1. Register source system/organisation, data owner, purpose, classification, expected schema and authority.
2. Upload to private quarantine using short-lived signed upload; enforce size/type limits, malware scan and checksum.
3. Profile encoding, sheets, headers, row counts, formulas and suspicious content. Never execute macros/formulas.
4. Select a versioned mapping template; preview source-to-canonical mappings and transformations.
5. Preview masked sample rows, expected inserts/updates, duplicate candidates, skipped rows and aggregate impact.
6. Validate schema, required fields, code lists, dates, grade/period, school scope, learner/enrolment, assessment eligibility, score bounds and cross-row constraints.
7. Quarantine invalid/ambiguous rows; do not auto-commit identity conflicts or out-of-scope corrections.
8. Obtain authorised approval of purpose, mapping, counts, exceptions and target scope.
9. Commit transactionally in chunks with idempotency and row-level outcomes.
10. Reconcile received, accepted, rejected, duplicate, skipped and committed counts against source totals.
11. Close/lock batch; preserve lineage and approvals; correct through a new governed batch.
12. Monitor state, retries, failures, duration and operator actions.

### Import states

draft → uploaded → scanning → profiled → mapped → previewed → validated → awaiting_approval → committing → reconciling → completed.

Exception states: rejected, quarantined, failed_retryable, failed_terminal, cancelled. Transitions are explicit and audited.

### Idempotency and duplicates

Idempotency key binds tenant/source + source batch identity + content checksum + mapping version. Replaying a completed batch returns its outcome, not duplicate writes. Person, enrolment, assessment attempt and result rows have different uniqueness semantics. Suspected person duplicates become human review cases. Partial failures are visible and safely resumable.

## 5. Export lifecycle

- User selects permitted dataset, purpose, scope, filters and retention need.
- Server recalculates scope and permitted fields; client filters are not security boundaries.
- Apply minimisation, de-identification and small-cell suppression policy.
- Require elevated approval for bulk identifiable child data or cross-institution exports.
- Generate asynchronously; encrypt at rest in private object storage.
- Issue short-lived download link to authorised requester.
- Record request, approver, filters, record count, fields, checksum, download time and expiry.
- Expire/delete artifact under approved retention; retain only necessary audit metadata.
- Prevent export URLs from indexing or leaking through analytics/logging.

## 6. Integration patterns

- Documented REST for synchronous exchange.
- Signed webhooks with timestamp, signature verification and replay window.
- Scheduled batch exchange for systems without reliable APIs.
- Connector registry records owner, endpoint, auth method, scopes, schema version, limits, retry policy, purpose and expiry.
- Use transactional outbox for reliable domain-event publication.
- Consumers are idempotent and tolerate duplicates/out-of-order delivery.
- External system availability must not block unrelated local transactions.
- Reconcile acknowledgements and dead-letter events; replay is audited.

## 7. Candidate domain events

learner.admitted; learner.enrolment.transferred; learner.profile.corrected; staff.assignment.started; staff.assignment.ended; curriculum.edition.imported; curriculum.edition.published; assessment.event.created; assessment.attempt.recorded; assessment.mark.submitted; assessment.moderation.completed; result.approved; result.snapshot.published; result.corrected; intervention.created; intervention.followup.recorded; import.batch.completed; export.job.completed.

Events carry identifiers and minimum metadata, not unnecessary learner personal data. Consumers independently authorise referenced records.

## 8. File and object-storage controls

Private buckets only. Separate quarantine, accepted source, generated export and public non-sensitive asset areas. Enforce content sniffing, extension allowlist, size limits, checksum, malware scan and retention. Random object keys; no names/admission numbers in paths. Signed URLs are short-lived and purpose-specific. File metadata/lineage lives in database; object store is not a competing source of truth.

## 9. Observability

Track correlation ID, tenant/scope, source, mapping version, counts, duration, retry count and safe error codes. Redact personal data and secrets. Alert on abnormal export volume, denied scope access, reconciliation failures, queue backlog and import failure spikes. Pause, cancel, retry, quarantine release and replay are privileged audited actions.

## 10. Security and resilience tests

- Forged tenant/school IDs do not widen access.
- Cross-scope API reads, imports, exports and jobs are denied.
- Replayed imports do not duplicate records.
- Malicious files, formula injection, oversized files and invalid encodings are safely handled.
- Partial failure resumes without double writes.
- Invalid webhook signatures and replay are rejected.
- Exports enforce field minimisation, expiry and audit.
- Background jobs re-check scope at execution time.
- Rate limits prevent bulk scraping.
- Corrections preserve original lineage and snapshot history.

## 11. Decisions required

Confirm source systems, owners, APIs, identifiers and data-sharing agreements; accepted formats/templates/volumes; authoritative source per entity; import/export authority; retention, residency, encryption and scanning; queue/object storage based on volume/runtime/cost; external assessment contracts and official result ownership.

No endpoint, cloud resource, live import or external integration is provisioned by this document.
