# Sentinel — Engineering Continuation Checkpoint

**Date:** 25 November 2026  
**Repository:** [gvffbhdvgf/cbe](https://github.com/gvffbhdvgf/cbe)  
**Branch:** `sentinel/bootstrap`  
**Checkpoint commit:** `527648eda671532e4870833255323b4a8fc29834`  
**Scope:** Current implementation and verified engineering state; this document supersedes older statements that the project contains no application code.

## 1. Current repository state

The branch contains an application foundation and engineering documentation under `sentinel/`. The latest inspected pre-checkpoint tree contained 91 files. The project is a Next.js App Router modular monolith with TypeScript, React, Neon Auth, Neon PostgreSQL, Drizzle ORM and Vitest.

### Dependency baseline

| Package | Declared version |
|---|---:|
| Next.js | 16.4.6 |
| React / React DOM | 19.3.0 |
| TypeScript | ^5 |
| `@neon/auth` | ^0.8.2 |
| `@neondatabase/serverless` | ^1.2.1 |
| Drizzle ORM | ^0.45.4 |
| Vitest | ^4.1.12 |
| ESLint | ^9 |
| Tailwind CSS | 4.3.3 |

The lockfile is `package-lock.json`. CI uses Node.js 22 and `npm ci`.

## 2. Implemented capabilities

- Managed Neon Auth sign-in entry point; public self-service registration remains disabled.
- Organisation onboarding and organisation-scoped membership administration, including role boundaries and audit events.
- Tenant-scoped learner identity, learner profiles, classes, enrolments, guardian relationship and progression-event schema.
- Learner registration/list API and an administrator-facing learner register.
- Source-linked KICD Grades 1–9 curriculum catalogue and authenticated curriculum browser.
- Curriculum source, edition, pathway and grade-offering provenance.
- Curriculum document staging for hierarchical source headings, with review and rights status kept explicit.
- Migration journal checker and a development-only migration runner that restricts the target to the approved `sentinel-development` Neon endpoint.
- CI workflow for lint, typecheck, tests and production build.

## 3. Curriculum catalogue state

The development catalogue seed records 12 KICD source records, two catalogue editions, nine pathway records, 20 canonical learning-area labels and 120 grade offerings.

- Regular curriculum offerings are source-linked for Grades 1–9.
- The Indigenous Language lower-primary discrepancy is explicitly flagged; it is not treated as a confirmed curriculum-design offering.
- Adapted SNE pathways are catalogued, but grade-level learning-area offerings are not inferred without source validation.
- One Grade 6 CRE design PDF is staged. Its file label indicates April 2024 while the cover says first published in 2021. Edition/currentness and rights review remain pending.
- Five strand headings and 22 sub-strand headings are staged as catalogue headings only. Full outcomes and learning experiences have not been approved or ingested.

The Grade 6 assessment evidence discrepancy remains unresolved: category totals report 1,406, while conflicting cluster tables report 1,408 and 1,405. Do not silently reconcile these values.

## 4. Learner and organisation state

Migration journal entries `0000` through `0007` are present (eight migrations). The learner migration adds people, learner profiles, classes, enrolments, guardian relationships and progression events with tenant-scoped composite constraints.

The learner register currently supports admission and listing. The development migration was previously applied and the six learner tables were verified empty at that checkpoint. No live learner import is approved.

Still outstanding:
- Authenticated end-to-end tests with a governed institutional test account.
- Cross-tenant integration tests and PostgreSQL row-level security design/implementation.
- Class creation, learner placement and assignment.
- Transfer, progression, withdrawal and academic-year rollover workflows.
- Guardian verification and controlled guardian access.
- Learner updates/exits and correction history.
- Workforce/teacher records and assignments.

## 5. Verification

A fresh cloud validation checkout was created from the current GitHub branch at commit `3fa6a1f204cf69dc3a0157b22a3a7e85269c250c`. The older sandboxes were not reset or overwritten.

| Check | Result |
|---|---|
| Clean `npm ci` | Passed; 0 vulnerabilities reported |
| `npm run db:check` | Passed; eight migrations valid |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | Passed; 19 tests across four files |
| `npm run build` | Passed with isolated build-only placeholders |
| `npm audit --audit-level=low` | Passed; 0 vulnerabilities |

The first isolated build attempt correctly failed because the sandbox had no `NEON_AUTH_COOKIE_SECRET` and `DATABASE_URL`. Supplying non-production placeholders for `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` and `DATABASE_URL` allowed the production build to complete without a database connection.

The CI workflow was updated in commit `527648eda671532e4870833255323b4a8fc29834` to supply those placeholders to the build step only. They must never be used to run the application or connect to any real service. No production credentials were added. Hosted GitHub Actions status for this latest commit has not yet been independently confirmed.

Non-blocking dependency observations from clean install:
- npm reports a peer-version warning: `@neon/auth` resolves `@better-fetch/fetch@1.3.2`, while a nested OAuth provider requests peer `1.3.3`.
- npm marks ESLint 9.39.5 as deprecated/unsupported.
- The security audit reports zero known vulnerabilities. Investigate compatibility before applying overrides or upgrading major tooling.

## 6. Cloud sandbox preservation

Two older ephemeral sandboxes were found to contain stale repository snapshots:
- `sentinel-build-validation` contains a unique unpushed commit and, after fetching, is 13 commits behind the current remote branch. Do not push or reset it.
- `sentinel-cloud-dev` contains uncommitted work and an older migration set. Do not reset or overwrite it.

A separate fresh checkout named `sentinel-current` was used for the validation above. The original sandboxes were preserved.

## 7. Environment and release guardrails

- Keep all application work inside `sentinel/`.
- Use separate local/development/preview/production credentials and databases.
- Never commit secrets or copy provider credentials into GitHub, Notion, logs or chat.
- Never run development migrations against Production.
- Vercel automatic deployments remain controlled; do not enable deployment on every commit or trigger production releases.
- Do not provision paid/persistent infrastructure or incur new service costs without approval.
- Do not import identifiable learner data until governance, privacy, safeguarding and DPIA gates are satisfied.

## 8. Next engineering sequence

1. Reconcile this checkpoint with the Notion handoff and keep the README index accurate.
2. Inspect the tenancy/authority model and the Neon Auth request-to-database identity path before designing PostgreSQL RLS. The current serverless database connection must not be assumed to enforce RLS automatically.
3. Add cross-tenant negative integration tests and verify the role/scope checks for learner and membership APIs.
4. Implement class creation and learner placement only after tenant and school authority boundaries are confirmed.
5. Implement transfer/progression and guardian workflows with auditable state transitions.
6. Continue detailed KICD outcome ingestion only from source documents with verified edition, provenance, rights and curriculum-specialist review.
7. Complete authenticated end-to-end verification, then maintain controlled Preview/release checks.

## 9. External source brief

The original external Notion implementation brief has not been recovered. Searching the connected Notion workspace surfaced the Sentinel blueprint, requirements, handoff, security and architecture pages, but not the external brief. Requirements that depend on it remain provisional until an authorised share/export route is available.
