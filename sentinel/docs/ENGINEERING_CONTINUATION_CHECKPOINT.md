# Sentinel — Engineering Continuation Checkpoint

**Date:** 25 November 2026  
**Repository:** [gvffbhdvgf/cbe](https://github.com/gvffbhdvgf/cbe)  
**Branch:** `sentinel/bootstrap`  
**Base commit inspected:** `e2507ec687e11e8e43f6ebdd99340fe33ff83782`

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

CI uses Node.js 22 and `npm ci`.

## 2. Implemented capabilities

- Managed Neon Auth sign-in; public self-service registration remains disabled.
- Organisation onboarding and organisation-scoped membership administration.
- Tenant-scoped learner identity, profiles, classes, enrolments, guardian relationship and progression-event schema.
- Learner admission/list service and administrator-facing register.
- Source-linked KICD Grades 1–9 curriculum catalogue, pathway provenance and curriculum document staging.
- Audit events and development-only migration runner restricted to the approved `sentinel-development` Neon endpoint.
- PostgreSQL RLS foundation for learner/person/enrolment/class/progression/guardian/audit records (migration 0008).
- Server-side Neon Auth JWT verification with JWKS and issuer checks, transaction-local claims and a database-side identity assertion for learner operations.

## 3. Learner RLS and identity boundary

The development database already contained a partially configured RLS state that was not represented in the repository migration journal. This drift has been reconciled by adding and applying migration 0008.

- `sentinel_learner_runtime` is NOLOGIN, NOBYPASSRLS and non-privileged.
- `sentinel_learner_login` is a development login role inheriting the group role.
- The login has SELECT/INSERT only on explicitly approved learner/audit tables; no UPDATE or DELETE.
- Learner service reads and admission writes use a dedicated Neon WebSocket Pool/Drizzle transaction through `DATABASE_AUTHENTICATED_URL`.
- The application obtains a Neon Auth JWT, verifies it against configured JWKS and issuer, and requires the JWT subject to match the authenticated session user ID.
- Verified claims are installed using transaction-local `set_config('request.jwt.claims', ..., true)`; the database checks `sentinel_private.current_user_id()` before learner queries.
- The restricted database role cannot bypass RLS. Unauthorised/no-membership contexts return no learner rows and are denied by policy.
- Important limitation: the extension's fallback `request.jwt.claims` mode does not independently validate JWT signatures. Application-side JWKS verification is mandatory; do not expose the role to untrusted SQL.

The privileged `DATABASE_URL` remains for organisation/membership preflight and administrative operations. Learner record reads/writes must not use it.

## 4. Development database state

Neon project: `sentinel-platform`; development branch: `sentinel-development`; database: `sentinel`.

Migration journal entries 0000–0008 are present (nine migrations). Migration 0008 is recorded in `public.__drizzle_migrations` with SHA-256 `27664c83dd0b7ad1b00a3c4c26ac8243a2acb07abdc7c7f828aad58f77db2b68`.

The restricted login was tested through Neon SQL transactions:
- Synthetic claims resolve to the expected database identity.
- A user with no active membership is denied by the authority helper.
- The restricted role has SELECT/INSERT on approved tables and no UPDATE/DELETE.
- No people or learner rows were visible to the unauthorised synthetic identity.

Positive authenticated workflow with a governed institutional test account and a cross-tenant two-organisation integration test remain outstanding. No live learner or guardian data has been imported.

## 5. Validation baseline

A clean cloud checkout was created from the current GitHub branch; older ephemeral sandboxes were preserved.

| Check | Result |
|---|---|
| Clean `npm ci` | Passed; zero vulnerabilities reported |
| `npm run db:check` | Passed; nine migrations valid |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed on baseline; rerun after final GitHub sync |
| `npm test` | Passed; 31 tests across six files |
| `npm audit --audit-level=low` | Passed; zero vulnerabilities reported |

JWT tests cover missing/malformed token, signature, issuer, expiry, UUID subject and session-subject mismatch. Migration contract tests cover the journal, role constraints, RLS enable/force and absence of DELETE grants.

Clean install still reports a non-blocking peer-version warning in the Neon Auth dependency tree and an ESLint deprecation notice. Do not apply dependency overrides or major upgrades without compatibility review.

## 6. Vercel environment blocker

The Vercel project `sentinel-platform` exists but is not connected to a Git repository. The team deployment context lists no linked Sentinel project, and the project has no custom environments. Vercel rejected creation of a branch-scoped Preview variable `DATABASE_AUTHENTICATED_URL` because no Git repository is connected.

Do not broaden the restricted connection to every Preview or Production. Resolve the intended Git integration/project linkage first, then add the restricted connection as a sensitive Preview-only variable scoped to `sentinel/bootstrap`. No Production environment variable or deployment was changed.

## 7. Curriculum evidence and outstanding work

- Regular curriculum offerings are source-linked for Grades 1–9.
- Indigenous Language lower-primary discrepancy remains flagged.
- SNE grade-level offerings are not inferred without source validation.
- Grade 6 CRE source edition/currentness and rights review remain pending.
- Five strand and 22 sub-strand headings are staged; detailed outcomes/learning experiences are not yet approved or ingested.
- Grade 6 assessment discrepancy remains unresolved: category total 1,406 versus cluster tables 1,408 and 1,405.

Next sequence:
1. Resolve Vercel Git integration and branch-scoped Preview secret configuration.
2. Run positive/negative cross-tenant tests through the actual Neon Auth → Next.js → Pool transaction path.
3. Implement class creation and learner placement with tenant/authority validation.
4. Add learner corrections, transfers, exits, progression approval and year rollover.
5. Implement verified guardian access and safeguarding controls.
6. Continue detailed KICD outcomes only from verified source editions with provenance, rights and specialist review.
7. Complete authenticated end-to-end, privacy, security, accessibility and performance validation before any live learner pilot.

## 8. Non-negotiable guardrails

- Keep all work under `sentinel/`.
- Preserve old sandboxes; use fresh cloud checkouts.
- Keep local, development, Preview and Production credentials/data separate.
- Never run development migrations against Production.
- No automatic deployment on every commit or uncontrolled Production release.
- Do not import identifiable learner data before legal, privacy, safeguarding and DPIA approvals.
- Do not provision paid/persistent infrastructure or incur new service costs without approval.
- Keep GitHub and Notion checkpoints synchronized.
