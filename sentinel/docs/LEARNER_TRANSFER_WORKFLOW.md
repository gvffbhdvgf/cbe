# Sentinel — Learner Transfer Workflow

**Status:** Approved implementation direction for the development/Preview slice; legal and institutional policy review remains a release gate.

## 1. Problem and boundary

A learner may move between institutions. Sentinel must preserve the sending institution's historical enrolment, class placement, assessment and audit records while allowing the receiving institution to admit the learner without inheriting routine access to the sending institution's tenant.

The current identity model scopes `people`, `learner_profiles`, enrolments and assessment evidence to an institution tenant. A transfer must therefore **not** move or re-parent the source Person/LearnerProfile, and must not make source assessment history readable by the receiving institution.

## 2. Privacy-preserving identity exchange

- A transfer request contains workflow metadata only: opaque transfer reference, sending and receiving institutions, destination grade/year, effective date, and a controlled reason code.
- It does not contain the learner's name, date of birth, learner reference, assessment data, guardian data or free-text narrative.
- A source-only link table maps the request to the source learner/enrolment. Its RLS policy permits only the sending institution's authorised learner-record managers to read it.
- A destination-only link table maps a completed request to the receiving institution's local learner/enrolment. Its RLS policy permits only the receiving institution's authorised managers to read it.
- The recipient identifies the learner using the opaque transfer reference and authorised transfer documents shared through the institution's approved channel. The recipient creates or reuses a local Person/LearnerProfile; Sentinel does not silently copy PII or historical records across tenants.
- Sharing a transfer reference is not a substitute for the sending institution's lawful basis, guardian notice/consent where required, data-sharing agreement, retention controls or applicable Kenyan education/privacy requirements.

## 3. State machine

`requested → accepted → released → completed`

Alternative transitions:

- `requested → rejected` by the receiving institution, with a controlled rejection code.
- `requested → cancelled` by the sending institution.
- `accepted → cancelled` by the sending institution, but only before release.
- No cancellation after release in the first slice; released-but-not-completed transfers remain visible to both parties for resolution.

### Stage ownership

1. **Request — sending institution.** An authorised records manager selects an active source enrolment, receiving institution, destination grade/year, effective date and reason code. The source enrolment remains active.
2. **Accept/reject — receiving institution.** An authorised records manager sees only the request metadata and sender institution. Acceptance does not disclose the source learner ID or source record. Rejection requires a controlled reason code.
3. **Release — sending institution.** On or after the effective date, the sender closes the source enrolment as `transferred`, ends current class placement(s), records a `transferred_out` progression event and audit event, and changes the request to `released`.
4. **Complete — receiving institution.** The receiver creates or reuses a local learner profile and creates an active local enrolment for the agreed grade/year/effective date. Sentinel records `transferred_in`, links the destination records in the receiver-only table, and marks the request `completed`.

## 4. Integrity and operational rules

- Sending and receiving organisations must be distinct and active.
- Source enrolment must be active and belong to the sending institution.
- There may be only one open transfer request for a source enrolment at a time.
- Destination grade is Grades 1–9; academic year is bounded to 2000–2100.
- Effective date is validated against the sending institution's IANA timezone and must be after the source enrolment start. Release is prohibited before the effective date.
- If the source has a class placement spanning the effective date, it is ended at the institution-local effective instant. Future scheduled placements are cancelled as history, not deleted.
- A completed destination enrolment must match the request's receiving institution, grade, academic year and effective date. A learner cannot have two active enrolments in the receiving tenant.
- Optional class placement is a separate audited operation after admission; the transfer completion step does not bypass class capacity controls.
- Use controlled reason codes only in the transfer workflow. Do not collect free-text sensitive narratives.
- All state transitions are SECURITY DEFINER functions with explicit organisation-manager checks, row locks, PUBLIC execution revoked, narrow runtime EXECUTE grants and audit events. Runtime table access is SELECT-only.
- RLS on the request row permits the sender or receiver to read workflow metadata. Source and destination link tables have separate tenant-only RLS policies.

## 5. Non-goals for the first slice

- Copying assessments, results, interventions, guardian relationships, medical/support details or attachments between institutions.
- Cross-tenant Person identity resolution or automatic national identifier matching.
- Automated guardian consent, inter-institution document exchange or statutory transfer-certificate issuance.
- Automatically releasing source records on acceptance.
- Treating an accepted request as proof of learner identity or legal authority.

## 6. Required verification

- Sender can create, cancel and release only its own source transfer.
- Receiver can see metadata and accept/reject only transfers addressed to it.
- Receiver cannot query source link rows or source learner/assessment records.
- Sender cannot query destination link rows or destination learner records.
- Repeated acceptance, release or completion is rejected idempotently without duplicate enrolments/events.
- Expired/invalid dates, wrong tenant IDs, inactive organisations, duplicate open transfers and mismatched destination grade/year are rejected.
- Source history remains intact; source enrolment and placements are ended, not deleted.
- Full two-institution journey is exercised on a disposable Neon child branch with synthetic identities only.
- Production release remains blocked on legal/privacy review, data-sharing agreements, DPIA/retention decisions and institutional policy approval.
