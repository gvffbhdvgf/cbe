# Sentinel — Learner Records and Enrolment Model

**Status:** Development schema and first learner-register vertical slice implemented. No learner or guardian data has been loaded. This is not a production-ready admissions workflow.

## 1. Tenant and identity boundaries

- `people` stores a minimal person identity inside a data-controller organisation boundary. It is not a globally searchable national identity directory.
- `learner_profiles` gives a person a learner role within that same tenant. A generated internal learner reference is used; no national identifier or UPI is collected by the current form.
- `learner_enrolments` is a time-bounded relationship between a tenant-scoped learner and a school/organisation, with grade, academic year, optional class and status. The learner identity is not the enrolment itself.
- `classes` are organisation/year/grade scoped. The composite foreign key on enrolments prevents a class from another tenant, school, grade or academic year from being attached.
- `guardian_relationships` records an explicit, verified relationship. Progress visibility and messaging permissions default to false. Cross-tenant guardian links are rejected by composite foreign keys.
- `learner_progression_events` records admission, promotion, repetition, transfer, withdrawal and graduation events as an auditable timeline.

The current register uses the organisation ID as both tenant/data-controller boundary and school ID. A future authority/sub-county/school hierarchy must be validated before changing this rule. Cross-organisation transfers must use an authorised data-sharing workflow; do not globally merge learner identities or copy records between tenants by default.

## 2. Data minimisation

The current admission form collects only:

- Legal first and last names (required)
- Middle and preferred names (optional)
- Date of birth (optional)
- Grade and academic year

It does not collect national ID/UPI, phone numbers, guardian contacts, photographs, health/disability data, biometrics, religion, ethnicity or other special-category data. Add those only after necessity, lawful basis, notice, controller responsibility, retention and DPIA review are documented.

Date of birth is not shown in the learner register list. Audit metadata contains the internal learner reference, grade and year, not names or date of birth.

## 3. Access and integrity

- Only active platform administrators, organisation administrators and school administrators can create or list learner records in this first slice.
- API routes authenticate independently of UI state and check organisation membership on the server.
- People, learner profiles, classes, enrolments, guardians and progression events use tenant-aware composite foreign keys.
- One active enrolment is allowed per learner per tenant.
- Enrolment, progression and audit writes for admission are executed as one Neon HTTP batch.
- No automated progression, placement or high-stakes decision is made by the system.

This application-level and relational enforcement is not yet PostgreSQL RLS. RLS remains a separate security milestone and must be implemented with transaction-scoped tenant context and cross-tenant tests.

## 4. Outstanding before a live learner pilot

1. Complete the Kenyan Data Protection Act/Children's Data Guidance compliance assessment and DPIA where required.
2. Confirm data-controller/processor roles, lawful basis, parent/guardian notices and consent requirements, retention, access/correction/deletion workflows and breach response.
3. Validate the actual institution hierarchy and data ownership with participating institutions.
4. Implement class creation/assignment, admissions approval, duplicate detection, transfers, exits, progression approval and guardian verification.
5. Add integration tests proving a user in one organisation cannot list, create, update or infer another organisation's learner records.
6. Implement and test PostgreSQL RLS or equivalent database-enforced isolation.
7. Confirm encryption, backup/restore, audit retention, operational access and restricted support procedures.
8. Use synthetic fixtures in development only. Do not import real children’s records until all gates are approved.

---
This document is an engineering baseline, not legal advice or a declaration of compliance.
