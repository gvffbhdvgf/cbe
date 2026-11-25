# Sentinel — Engineering Continuation Checkpoint

**Date:** 25 November 2026  
**Repository:** [gvffbhdvgf/cbe](https://github.com/gvffbhdvgf/cbe)  
**Branch:** `sentinel/bootstrap`  
**Latest implementation commit:** `df62faac06247b76352b4a8d4169323911448616`

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
- Source-linked KICD Grades 1–9 curriculum catalogue, pathway provenance and curriculum document staging.
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

Migration journal entries 0000–0010 are present (eleven migrations):
- 0008 RLS foundation: SHA-256 `27664c83dd0b7ad1b00a3c4c26ac8243a2acb07abdc7c7f828aad58f77db2b68`.
- 0009 class creation RLS: SHA-256 `d284585be9a8f0a5071a06202435429cb34e484db79d6c37376a436089b4cf82`.
- 0010 controlled class placement: SHA-256 `8bacb4f67b6602385d70ac53f423118a0a6d3cea57bb63d88dbad6527f30e6f2`.

Verified through Neon SQL transactions:
- Restricted role can execute the placement function but has no UPDATE/DELETE privilege on learner enrolments.
- Function is SECURITY DEFINER and the progression constraint includes `class_assigned`.
- Synthetic identity without active authority receives a non-disclosing `P0002` enrolment-not-found response.
- No live learner or guardian data has been imported. A positive placement workflow with a governed institutional test account remains outstanding.

## 5. Validation baseline

A fresh cloud checkout of the latest GitHub branch completed:

| Check | Result |
|---|---|
| Clean `npm ci` | Passed; zero vulnerabilities reported |
| `npm run db:check` | Passed; eleven migrations valid |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | Passed; 49 tests across nine files |
| `npm run build` | Passed; Next.js production build and route generation completed |
| `npm audit --audit-level=low` | Passed; zero vulnerabilities reported |

The suite covers JWT verification, RLS migration contracts, class validation, placement date validation, error mapping, organisation and membership policies. The Neon Auth dependency tree still emits a non-blocking peer-version warning; ESLint 9.39.5 also emits a deprecation notice. Do not apply dependency overrides or major upgrades without compatibility review.

A GitHub Actions workflow exists for Node 22 clean install, migration validation, lint, typecheck, tests and build. No hosted workflow run/status check has been observed yet; the cloud validation above is the verified execution.

## 6. Vercel environment blocker

The Vercel project `sentinel-platform` exists but is not connected to a Git repository. Vercel rejected creation of a branch-scoped Preview variable `DATABASE_AUTHENTICATED_URL` because no Git repository is connected. Do not broaden the restricted connection to every Preview or Production. Resolve the intended Git integration/project linkage first, then add the restricted connection as a sensitive Preview-only variable scoped to `sentinel/bootstrap`. No Production variable or deployment was changed.

Until the Preview secret is configured, learner/class APIs that require the restricted database connection intentionally fail closed.

## 7. Curriculum evidence and outstanding work

- Regular curriculum offerings are source-linked for Grades 1–9.
- Indigenous Language lower-primary discrepancy remains flagged.
- SNE grade-level offerings are not inferred without source validation.
- Grade 6 CRE source edition/currentness and rights review remain pending.
- Five strand and 22 sub-strand headings are staged; detailed outcomes/learning experiences are not yet approved or ingested.
- Grade 6 assessment discrepancy remains unresolved: category total 1,406 versus cluster tables 1,408 and 1,405.

Next sequence:
1. Resolve Vercel Git integration and branch-scoped Preview secret configuration.
2. Complete positive/negative cross-tenant integration tests through the actual Neon Auth → Next.js → Pool transaction path.
3. Implement class reassignment, learner correction, transfer, withdrawal, progression approval and academic-year rollover with explicit state transitions and audit history.
4. Implement teacher allocation, class capacity and verified guardian relationships with safeguarding controls.
5. Continue detailed KICD outcomes only from verified source editions with provenance, rights and specialist review.
6. Complete privacy/DPIA, security, accessibility and performance validation before any live learner pilot.

## 8. Non-negotiable guardrails

- Keep all work under `sentinel/` except repository-wide CI.
- Preserve old sandboxes; use fresh cloud checkouts.
- Keep local, development, Preview and Production credentials/data separate.
- Never run development migrations against Production.
- No automatic deployment on every commit or uncontrolled Production release.
- Do not import identifiable learner data before legal, privacy, safeguarding and DPIA approvals.
- Do not provision paid/persistent infrastructure or incur new service costs without approval.
- Keep GitHub and Notion checkpoints synchronized.
