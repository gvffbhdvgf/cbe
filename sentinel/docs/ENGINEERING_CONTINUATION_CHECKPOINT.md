# Sentinel — Engineering Continuation Checkpoint

**Date:** 26 November 2026
**Repository:** [gvffbhdvgf/cbe](https://github.com/gvffbhdvgf/cbe)
**Branch:** `sentinel/bootstrap`
**Latest implementation commit:** Follow the current `sentinel/bootstrap` branch head; do not rely on a pinned historical SHA.
**Latest documentation checkpoint:** 26 November 2026; this file is maintained with the branch status.

## 1. Application and dependencies

Sentinel is a Next.js App Router modular monolith using TypeScript, React 19, Neon Managed Auth, Neon PostgreSQL 17, Drizzle ORM, the Neon serverless Pool driver and Vitest.

| Package | Declared version |
|---|---:|
| Next.js | 16.4.6 |
| React / React DOM | 19.3.0 |
| `@neon/auth` | ^0.8.2 |
| `@neondatabase/serverless` | ^1.2.1 |
| Drizzle ORM | ^0.45.4 |
| `jose` | 6.2.5 |
| Vitest | ^4.1.12 |
| TypeScript | ^5 |
| ESLint | ^9 |

## 2. Implemented capabilities

- Managed Neon Auth sign-in; public self-service registration remains disabled.
- Organisation onboarding and organisation-scoped membership administration.
- Tenant-scoped learner identity, profiles, classes, enrolments, guardian relationship and progression-event schema.
- Learner admission/list service and administrator-facing register; learner reads and admission writes now use the restricted RLS transaction path.
- Organisation-specific class-group creation/listing for Grades 1–9 by academic year, with unique class codes and audit events.
- Controlled, effective-dated learner placement into a matching active class, with progression and audit records.
- Source-linked KICD Grades 1–9 curriculum catalogue, pathway provenance, curriculum document staging and authenticated source-structure browsing for versioned strand/sub-strand headings.
- Grade 6 CRE June 2024 and Revised 2024 source records remain separate. A source-comparison note records six changed heading/page rows; neither source is approved for outcome ingestion.
- PostgreSQL RLS for learner/person/enrolment/class/progression/guardian/audit records, restricted runtime role and transaction-scoped verified identity context (migrations 0008–0010).

## 3. Learner RLS and identity boundary

- `sentinel_learner_runtime` is NOLOGIN, NOBYPASSRLS and non-privileged.
- `sentinel_learner_login` is the development login role inheriting that group.
- The login has SELECT/INSERT only on approved learner, class and audit tables; no general UPDATE or DELETE.
- Learner list/admission and class create/list operations use `DATABASE_AUTHENTICATED_URL` through a dedicated Neon Pool/Drizzle transaction.
- The server obtains a Neon Auth JWT, verifies signature, issuer and expiry with JWKS, and requires its subject to match the authenticated session user ID.
- Verified claims are installed with transaction-local `set_config('request.jwt.claims', ..., true)`; the database checks `sentinel_private.current_user_id()` before learner work.
- Initial class placement is the only controlled update: `sentinel_private.assign_learner_to_class` is SECURITY DEFINER, checks active manager authority, active enrolment, tenant, organisation, grade, year, class status and effective date, then updates only `class_id` and writes progression/audit events. The runtime role receives EXECUTE, not table UPDATE.
- Repeating the same class placement is idempotent; changing an existing class assignment is rejected pending a separate reassignment workflow.
- Important limitation: the extension's fallback `request.jwt.claims` mode does not independently validate JWT signatures. Application-side JWKS verification is mandatory; do not expose the role to untrusted SQL.

## 4. Development database state

Neon project: `sentinel-platform`; development branch: `sentinel-development`; database: `sentinel`.

The source-controlled migration journal has entries 0000–0015 (sixteen migrations). The Neon ledger contains eighteen rows; two historical hashes are not represented in current source files or Git history and are preserved pending provenance investigation. Migration 0012 assessment schema SHA-256: e96a971f24d9feb4906b3b395403c52dbb5a3d34cf239a65132db5a12dcbb5f9. Migration 0013 eligible-roster SHA-256: 593992ecfc18ab4e350acca996ae57968629cc1593623341e7a47b8b1ff4447e. Migration 0014 controlled-capture SHA-256: febc678c45b1968502101f25d8c752bce2bea9acbf5d503ef3af5f3f9d411c14 and is applied to development. Migration 0015 audit-history immutability SHA-256: ca2ebd31b6580e9e04aebb827f3e123319ce93edd4a5c33f0a1db58fae2a6c6b and is applied to development.
- 0008 RLS foundation: SHA-256 `27664c83dd0b7ad1b00a3c4c26ac8243a2acb07abdc7c7f828aad58f77db2b68`.
- 0009 class creation RLS: SHA-256 `d284585be9a8f0a5071a06202435429cb34e484db79d6c37376a436089b4cf82`.
- 0010 controlled class placement: SHA-256 `8bacb4f67b6602385d70ac53f423118a0a6d3cea57bb63d88dbad6527f30e6f2`.

Verified through Neon SQL transactions:
- Restricted role can execute the placement function but has no UPDATE/DELETE privilege on learner enrolments.
- Function is SECURITY DEFINER and the progression constraint includes `class_assigned`.
- Synthetic identity without active authority receives a non-disclosing `P0002` enrolment-not-found response.
- No live learner or guardian data has been imported. The development branch currently has zero active organisations. A positive placement workflow and cross-tenant tests with a governed synthetic institutional account remain outstanding until an authorised test organisation/user fixture is provisioned.

## 5. Validation baseline

A fresh cloud checkout of the latest GitHub branch completed:

| Check | Result |
|---|---|
| Clean `npm ci` | Passed; zero vulnerabilities reported |
| `npm run db:check` | Passed; sixteen migrations valid |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | Passed; 91 tests across seventeen files (including assessment domain, migration, access-policy and frozen-roster contracts) |
| `npm run build` | Passed; Next.js production build and route generation completed with ephemeral local-only environment placeholders |
| `npm audit --audit-level=low` | Passed; zero vulnerabilities reported |

The suite covers JWT verification, RLS migration contracts, class validation, placement date validation, error mapping, organisation and membership policies, and assessment event/attempt lifecycle, tenant-enrolment scope, scoring and instrument-version invariants. The assessment-domain increment also passed `npm run lint` and `npm run typecheck`; its fresh production build passed using ephemeral local-only auth/database placeholders; no deployment secrets were changed. The Neon Auth dependency tree still emits a non-blocking peer-version warning; ESLint 9.39.5 also emits a deprecation notice. Do not apply dependency overrides or major upgrades without compatibility review.

GitHub Actions run [45713501617](https://github.com/gvffbhdvgf/cbe/actions/runs/45713501617) on commit `16ff21256f892f45f12bf9742d475ba08d67c1b9` passed all stages: clean install, migration validation, lint, typecheck, 91 tests across seventeen files, and production build. Build used ephemeral CI-only placeholders; no deployment secrets were changed.

## 6. Vercel Preview and environment boundary

The Vercel project `sentinel-platform` exists; its root directory is now `sentinel`. A protected Preview deployment for `sentinel/bootstrap` is READY at https://sentinel-platform-56590wifk-pep-popsiis-projects.vercel.app (commit `a4e6f6c4faf321f6b9f282bd6a3ea1a08ec4a937`). Public unauthenticated requests to `/` and `/api/health` redirect to Vercel SSO; no health payload is exposed publicly. The project is not linked for automatic branch-scoped environment management, and `DATABASE_AUTHENTICATED_URL` remains unconfigured. Do not broaden this restricted connection to every Preview or Production as a workaround. No Production variable or deployment was changed.

Until the Preview secret is configured, learner/class APIs that require the restricted database connection intentionally fail closed.

## 7. Curriculum evidence and outstanding work

- Regular curriculum offerings are source-linked for Grades 1–9.
- Indigenous Language lower-primary discrepancy remains flagged.
- SNE grade-level offerings are not inferred without source validation.
- Grade 6 CRE source edition/currentness and rights review remain pending.
- Five strand and 22 sub-strand headings are staged; detailed outcomes/learning experiences are not yet approved or ingested.
- Grade 6 assessment discrepancy remains unresolved: category total 1,406 versus cluster tables 1,408 and 1,405.

Assessment lifecycle domain contracts are implemented in `src/domain/assessment/assessment.ts` with thirteen focused tests. Migrations 0012–0015 are applied to the isolated development branch:

- Migration 0012 creates the relational assessment model, composite tenant/grade/year/instrument/enrolment constraints, forced RLS, approved-outcome mapping validation, append-only result/decision history and instrument-version locking.
- Migration 0013 adds the immutable, RLS-protected eligible-enrolment roster, a roster FK on attempts and the audited `sentinel_private.schedule_assessment_event(uuid)` operation.
- Migration 0014 adds controlled event opening with UTC start/end, active authority, approved-instrument, active-programme and frozen-roster checks; attempt creation restricted to exact frozen-roster enrolments; immutable per-task response capture; and submission only after every required task response exists. Four authenticated API operations call SECURITY DEFINER database functions; no direct assessment-table write privileges are granted to the runtime role.
- Migration 0015 makes the audit log itself append-only. Assessment responses, results, decisions and eligibility snapshots also reject updates/deletes.
- Teacher-level capture remains disabled until class and teacher allocations and explicit assignment authority are modelled.

All assessment tables have forced RLS. Active platform administrators, organisation administrators, school administrators and assessors can read within their organisation. Teachers and viewers remain excluded from school-wide raw assessment access. The event date is interpreted in UTC until organisation timezone support exists. No assessment or learner records have been inserted. Marking, moderation, approval, publication and reasoned correction remain pending; authenticated end-to-end testing of the new capture lifecycle also remains outstanding.

Outcome mapping approval is constrained to reviewed `specific_outcome` nodes from approved, rights-confirmed curriculum documents with matching grade and learning area. Results and decision history are append-only; instrument versions lock after attempts exist; response scores cannot exceed task maxima. A read-only events API is implemented at GET /api/organisations/{organisationId}/assessments/events with matching application preflight and database RLS. No assessment or learner records have been inserted. Controlled event opening, attempt creation, response capture and submission are implemented and migration 0014 is applied. Marking, moderation, approval, publication and correction operations remain pending, as do authenticated integration tests of the complete capture workflow.

Next sequence:
1. Resolve Vercel Git integration and branch-scoped Preview secret configuration.
2. Complete signed-JWT Next.js request tests and cross-tenant end-to-end tests. Database-level positive/negative synthetic fixture tests have passed; actual Preview request-path testing remains blocked by the Vercel environment configuration.
3. Implement class reassignment, learner correction, transfer, withdrawal, progression approval and academic-year rollover with explicit state transitions and audit history.
4. Implement teacher allocation, class capacity and verified guardian relationships with safeguarding controls.
5. Continue detailed KICD outcomes only from verified source editions with provenance, rights and specialist review.
6. Implement marking, moderation, approval, publication and correction operations with append-only audit history; validate the new controlled attempt flow with governed synthetic fixtures.
7. Complete privacy/DPIA, security, accessibility and performance validation before any live learner pilot.

## 8. Non-negotiable guardrails

- Keep all work under `sentinel/` except repository-wide CI.
- Preserve old sandboxes; use fresh cloud checkouts.
- Keep local, development, Preview and Production credentials/data separate.
- Never run development migrations against Production.
- No automatic deployment on every commit or uncontrolled Production release.
- Do not import identifiable learner data before legal, privacy, safeguarding and DPIA approvals.
- Do not provision paid/persistent infrastructure or incur new service costs without approval.
- Keep GitHub and Notion checkpoints synchronized.
