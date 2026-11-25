# Sentinel — Learner Records and Enrolment Model

**Status:** Development schema, learner register, class-group register and PostgreSQL RLS foundation implemented. No live learner or guardian data has been loaded. This is not a production-ready admissions workflow.

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
- Admission, class creation, progression and audit writes execute in one transaction through the restricted learner runtime role.
- Organisation administrators can create and list class groups by grade and academic year. Class codes are unique per organisation/grade/year and are normalised to uppercase. Initial class placement is implemented through a narrow database function. Teacher allocation, capacity management and class reassignment are separate future workflows.
- Learner reads/writes obtain a Neon Auth JWT, verify its signature and issuer against JWKS, require its subject to match the authenticated session, set transaction-local claims, and confirm the database identity before querying.
- PostgreSQL RLS is enabled and forced for people, learner profiles, classes, enrolments, guardian relationships, progression events and audit events (migrations 0008–0010). Class SELECT and INSERT policies are tenant- and authority-scoped.
- The login role inherits a NOLOGIN/NOBYPASSRLS group role and has only explicit SELECT/INSERT privileges; UPDATE and DELETE are not granted. Placement uses EXECUTE on `sentinel_private.assign_learner_to_class`, which updates only the class assignment after validating authority, tenant, grade, year and effective date.
- No automated progression, placement or high-stakes decision is made by the system.

The database extension's fallback claims mode does not verify signatures itself. Application-side JWKS verification is therefore a mandatory security boundary. The privileged application connection remains limited to organisation/membership preflight and administrative operations; learner record queries must use `DATABASE_AUTHENTICATED_URL`. That restricted connection is not yet configured in Vercel because the project has no Git integration, so the Preview learner workflow remains fail-closed until the branch-scoped secret is configured.

## 4. Outstanding before a live learner pilot

1. Complete the Kenyan Data Protection Act/Children's Data Guidance compliance assessment and DPIA where required.
2. Confirm data-controller/processor roles, lawful basis, parent/guardian notices and consent requirements, retention, access/correction/deletion workflows and breach response.
3. Validate the actual institution hierarchy and data ownership with participating institutions.
4. Implement class creation/assignment, admissions approval, duplicate detection, transfers, exits, progression approval and guardian verification.
5. Complete positive/negative integration tests proving a user in one organisation cannot list, create or infer another organisation's learner/class records, and verify the actual Neon Auth → Next.js → Pool transaction path.
6. Add correction, class reassignment and transfer workflows only after their authority/state models are approved. The runtime currently has no general UPDATE/DELETE privilege; the narrow placement function is the only controlled class assignment update.
7. Confirm encryption, backup/restore, audit retention, operational access and restricted support procedures.
8. Use synthetic fixtures in development only. Do not import real children’s records until all gates are approved.

---
This document is an engineering baseline, not legal advice or a declaration of compliance.
