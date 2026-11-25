# Sentinel — Security & Privacy Threat Model

**Status:** Design baseline; institutional/legal review and DPIA must precede live learner-data processing.

## Kenyan privacy baseline

Official sources:
- Data Protection Act 2019: https://odpc.go.ke/wp-content/uploads/2024/02/TheDataProtectionAct__No24of2019.pdf
- General Regulations 2021: https://www.odpc.go.ke/wp-content/uploads/2024/03/THE-DATA-PROTECTION-GENERAL-REGULATIONS-2021-1.pdf
- ODPC Children's Data Guidance 2025: https://www.odpc.go.ke/wp-content/uploads/2025/11/ODPC-%E2%80%93-Guidance-Note-for-Processing-Childrens-Data.pdf
- ODPC DPIA guidance: https://www.odpc.go.ke/wp-content/uploads/2024/02/ODPC-Guidance-Note-on-Data-Protection-Impact-Assessment-1.pdf
- ODPC data subject rights: https://odpc.go.ke/rights-of-a-data-subject/

The Act section 33 addresses children's personal data, including parent/guardian consent and protection of the child's rights and best interests. The General Regulations identify high-risk processing scenarios including children's/vulnerable persons' data, large-scale processing, cross-source dataset linkage and certain automated decision-making/profiling.

**DPIA gate:** Complete and approve a Data Protection Impact Assessment before processing where required. Given the expected child-data, institutional-scale and cross-source linkage profile, plan a DPIA before any live-data pilot. Confirm lawful bases, consent/notice, controller/processor roles, registration, retention, cross-border transfers and sector-specific rules with responsible institutions and qualified Kenyan counsel/DPO. This is an engineering baseline, not legal advice.

## Data classification and minimisation

Proposed classes: Public; Internal; Confidential (learner, teacher, guardian, assessment and non-public school performance records); Restricted (authentication secrets, sensitive learner-support/safeguarding records, identity documents and privileged security events).

- Document purpose, lawful basis, owner, source, retention and access policy for every category.
- Collect only necessary fields. Separate sensitive support/safeguarding data from routine academic records.
- Never place identifiable learner data in public repositories, issue trackers, test fixtures, analytics tools, logs or AI prompts without an approved lawful and secure design.
- Use synthetic/de-identified data in development and demos.
- Controller-approved retention schedules are required; do not invent universal retention periods.

## Identity and access controls

- Proven identity provider or reviewed authentication implementation; MFA for privileged roles.
- Secure session lifecycle, revocation, recovery and rate limiting.
- Least privilege and deny-by-default.
- Combine roles with organisation/resource scopes; enforce server-side and at database access boundaries. UI hiding is not security.
- Derive scope from authenticated identity and approved assignments, never client-supplied tenant/school IDs.
- Prevent self-elevation; periodically review access and expire temporary assignments.
- Separate service identities from humans; scope and rotate integration credentials.

## Tenant isolation

Final topology remains unresolved: evaluate shared database with strong tenant/organisation enforcement against isolated schema/database models. A shared database is unacceptable unless isolation is proven. All reads, writes, exports, jobs and analytics must enforce scope. Cross-tenant access must be denied by default and covered by automated negative tests. Break-glass access must be time-limited, justified, approved and audited.

## Threat register

| Threat | Example | Core controls |
|---|---|---|
| Broken access / IDOR | Read another school's learner | Server-side scope checks; negative tests |
| Privilege escalation | School user grants self county access | Separation of duties; approval |
| Child-data disclosure | Report exposes identities | Minimisation; scoped export; small-cell suppression |
| Account takeover | Compromised teacher account | MFA; rate limits; recovery; revocation |
| Insider misuse | Browse outside assigned duties | Purpose-scoped access; audit; review |
| Import poisoning | Spreadsheet changes marks/identity | Staging; validation; quarantine; approvals |
| Mislinked identity | Merge by similar name | Governed identifiers; human review |
| Result tampering | Edit after moderation | Immutable publication; audited corrections |
| Exfiltration | Bulk export | Export permissions/limits; approval; alerts |
| Malicious upload | Weaponised assessment file | Allowlist; size limits; scanning; isolated parsing |
| API abuse/injection | Enumeration or malicious input | Parameterised queries; validation; rate limits |
| Supply-chain compromise | Vulnerable dependency | Lockfiles; scanning; protected CI |
| Backup exposure | Learner data in backup leak | Encryption; separate access; restore tests |
| AI misuse/bias | Unsupported learner inference | Evidence; uncertainty; human review; no high-stakes automation |

## Application, audit and AI safeguards

- Validate inputs; use parameterised queries, safe ORM patterns, CSRF controls where applicable, secure headers/CSP/HSTS and restrictive CORS.
- Rate-limit authentication, search, imports, exports and public endpoints. Validate file content and scan uploads before isolated processing.
- Never log passwords, tokens or full learner rows. Audit role/scope changes, learner identity/enrolment/transfer, assessment marking/moderation/approval/publication/corrections, imports/exports, restricted-data access and break-glass actions.
- Corrections preserve authorised history; published results are not silently rewritten.
- AI outputs are suggestions with evidence and uncertainty. No automated official grade, progression, placement, disciplinary or eligibility decision. Do not send identifiable child data to third-party AI without lawful basis, processor review, security/retention/residency review and DPIA as applicable.

## Cloud controls and release gates

Separate development, preview/staging and production resources and credentials. No live learner data in development/preview. Store secrets only in provider-managed encrypted stores. Use reviewed/manual production promotion, encrypted backups, restore tests, redacted logs and incident/rollback runbooks. Confirm hosting region, subprocessors, backup locations and cross-border safeguards.

Before a live pilot: identify controllers/processors/DPOs; approve purposes, lawful bases, notices, child/guardian mechanisms and sharing agreements; complete required DPIA; approve data inventory/classification/retention; approve tenancy and access matrix; pass cross-tenant tests and security testing; validate backup restoration, incident response, export restrictions and audit coverage; obtain institutional sign-off.
