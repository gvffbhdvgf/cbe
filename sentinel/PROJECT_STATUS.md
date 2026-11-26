> **Current implementation checkpoint — 26 November 2026:** Source branch `sentinel/bootstrap`; latest correction-workflow code commit `bca9306636885cefa7b4533f87c0a58bf5330d0f`. GitHub Actions run [45816753439](https://github.com/gvffbhdvgf/cbe/actions/runs/45816753439) passed migration-journal validation, lint, TypeScript, tests and production build. Neon development project `bold-lake-24687117`, branch `br-nameless-block-bhpsx0vq` (`sentinel-development`), database `sentinel`, now has migrations 0021–0031 applied. Migration 0031 adds governed learner identity corrections for legal first/middle/last name, preferred name and date of birth. Requests retain original/proposed values and reason; only a different authorised learner-record manager can approve/reject; stale-value approval is blocked; writes are through narrow SECURITY DEFINER functions; request/review decisions are audited without learner PII in audit metadata. The runtime role has SELECT only on the request table and no direct INSERT/UPDATE/DELETE; function execution is explicitly granted. Migration 0031 was first executed and permission-checked on an isolated child branch, then applied and recorded in the development ledger. The learner workspace page now includes the correction manager. Browser E2E of request/review still pending; no synthetic or real learner records were created. Stable Preview alias: https://sentinel-git-sentinel-bootstrap-pep-popsiis-projects.vercel.app. Production remains untouched. Next: verify Preview UI/API with a development test account and synthetic data on a disposable branch, then academic-year rollover and weekly-period workload modelling.

Last checkpoint: 26 November 2026. Working branch: `sentinel/bootstrap`.

## Start here

- Repository: https://github.com/gvffbhdvgf/cbe
- Branch: `sentinel/bootstrap`
- Keep all Sentinel code, docs, infrastructure definitions and tests under `sentinel/`.
- Read this file, [ENGINEERING_CONTINUATION_CHECKPOINT.md](docs/ENGINEERING_CONTINUATION_CHECKPOINT.md), and the Notion Product & Engineering Blueprint before changing architecture.
- Inspect the live GitHub branch and connected Neon/Notion state before editing. Do not repeat bootstrap work or assume approvals are complete.

## Working agreement

- Build Sentinel as a KICD-aligned education management and intelligence platform for Grades 1–9, with versioned curriculum intelligence, assessment evidence, learner progress/interventions, institutional analytics, governance and privacy.
- Engineer before coding: understand users, workflows, authority, source data, outcomes and constraints; validate problems before choosing features.
- Keep GitHub and Notion aligned with durable checkpoints.
- Cloud-first: use GitHub, Notion, Neon, Vercel, Cloudflare and other connected project integrations directly.
- Do not use local-machine connectors, local shells/terminals, desktop/computer automation or ChatGPT Work unless the user explicitly changes this instruction.
- Do not trigger production deployments on every commit. Use controlled/manual releases.
- Keep local, development, Preview and Production credentials/data separate.
- Never commit secrets or expose connected-plugin OAuth credentials.
- Do not import identifiable learner/guardian data before governance, privacy, safeguarding and DPIA gates are satisfied.

## Product scope

The target platform includes institution/school management; learner identity, admission, enrolment, progression and transfer; teacher/workforce records; versioned KICD curriculum intelligence; teaching and learning operations; internal and external assessment; learner progress and educator-led interventions; inter-school/cluster/zone analytics; integrations, reporting, governance, privacy, approvals and audit. This is discovery scope, not a claim that every feature belongs in the first release.

## Implemented foundation

- Next.js App Router, React, TypeScript, Neon Managed Auth, Neon PostgreSQL, Drizzle ORM and Vitest.
- Managed sign-in; public self-registration remains disabled.
- Organisation onboarding and organisation-scoped membership administration.
- Tenant-scoped learner identity, profiles, classes, enrolments, guardian relationship and progression-event schema.
- Learner admission/list service and administrator-facing register.
- Organisation-specific class group creation/listing for Grades 1–9 by academic year, with unique class codes and audit events.
- Controlled learner placement into a matching active class, effective-dated and audited through a narrow database function; reassignment is not enabled.
- Source-linked KICD Grades 1–9 curriculum catalogue, pathway provenance, curriculum document staging and authenticated source-structure browsing for versioned strand/sub-strand headings.
- Grade 6 CRE June 2024 and Revised 2024 documents are preserved as separate source records; a source-comparison note records six changed heading/page rows. Neither source is approved for outcome ingestion.
- Audit events and development-only migration runner.
- PostgreSQL RLS for learner/person/enrolment/class/progression/guardian/audit records, with a restricted learner runtime role and transaction-scoped verified identity context (migrations 0008–0010). Class creation and learner placement are permitted only to authorised organisation/school administrators; placement uses a narrow SECURITY DEFINER function rather than a general UPDATE grant.
- Assessment lifecycle schema (migrations 0012–0013) applied to the isolated development branch only: programmes, instrument versions, tasks, outcome mappings, events, immutable eligible-enrolment rosters, attempts, responses, results and append-only decisions. Every assessment table has forced RLS; runtime access is read-only except the audited scheduling function.
- 83 automated tests pass across 15 test files after adding assessment domain, database migration, access-policy and frozen-roster contracts; migration validation, lint and typecheck pass. The production build passed using ephemeral local-only auth/database placeholders; no deployment secrets were changed. A protected Vercel Preview deployment is READY for the curriculum browser. The preview has not been promoted to Production.

## Current security boundary

- Assessment runtime access is SELECT-only and restricted to active platform administrators, organisation administrators, school administrators and assessors. Teachers/viewers do not receive school-wide raw assessment access until class assignments and scoped permissions are implemented.
- Assessment table writes remain disabled for the runtime role. Event scheduling is the first controlled SECURITY DEFINER operation: it snapshots effective-dated eligible enrolments, audits the denominator and changes draft events to scheduled atomically. Attempts now require membership in that immutable roster. Other lifecycle writes remain pending.

- `sentinel_learner_runtime` is a NOLOGIN, NOBYPASSRLS, non-privileged database group role.
- `sentinel_learner_login` is the development login role and inherits the group role. It has only SELECT/INSERT on explicitly approved learner, class and audit tables; no general UPDATE or DELETE.
- Learner operations must use `DATABASE_AUTHENTICATED_URL`, never the privileged `DATABASE_URL`.
- The runtime login has no general UPDATE/DELETE privileges; initial class placement is exposed only through the narrowly validated SECURITY DEFINER function.
- Server-side membership/organisation preflight still uses the existing privileged application connection. Keep its use narrow.
- The JWT is verified with Neon Auth JWKS before claims are set transaction-locally. The database confirms the transaction identity before learner queries.
- The database extension's fallback claims mode does not independently verify JWT signatures; do not bypass application verification or permit untrusted SQL.

## Current blocker

Vercel project `sentinel-platform` is not linked to the Git repository for automatic branch-scoped environment management. A protected Preview deployment is created directly from GitHub commit `a4e6f6c4faf321f6b9f282bd6a3ea1a08ec4a937`. The restricted `DATABASE_AUTHENTICATED_URL` Preview variable remains unconfigured; do not replace it with a project-wide or Production secret. Resolve the intended branch-scoped variable configuration before testing learner APIs. No Production variable or deployment was changed.

## Curriculum evidence and unresolved discrepancies

- Regular curriculum offerings are source-linked for Grades 1–9; SNE pathways are catalogued without inferring unverified grade-level offerings.
- The Indigenous Language lower-primary discrepancy remains flagged, not treated as a confirmed curriculum-design offering.
- Grade 6 CRE has two official source records: June 2024 file label/First Published 2021 and an October 2024 Revised 2024 PDF. They remain separate; revised-source catalogue linkage, curriculum review and rights review remain pending.
- Five strand headings and 22 sub-strand headings are staged as catalogue headings only. Full outcomes/learning experiences have not been approved or ingested.
- Grade 6 assessment evidence discrepancy remains unresolved: category totals report 1,406 while conflicting cluster tables report 1,408 and 1,405. Never silently reconcile these figures.

## Outstanding work

1. Resolve Vercel Git integration and branch-scoped Preview secret configuration.
2. Complete positive/negative cross-tenant integration tests through the actual Neon Auth → Next.js → Pool transaction path.
3. Implement learner correction, class reassignment, transfer, withdrawal, progression approval and academic-year rollover with explicit state transitions and audit history. Initial class placement is implemented; reassignment is not.
4. Implement teacher allocation, class capacity and verified guardian relationships with safeguarding-controlled access.
5. Continue KICD outcome ingestion only from source documents with verified edition, provenance, rights and curriculum-specialist review.
6. Continue the assessment lifecycle. Migrations 0012–0013 are applied to the isolated Neon development branch: nine lifecycle tables plus an immutable event-eligible roster, composite tenant/school/grade/year/instrument/enrolment constraints, forced RLS, assessor/admin-only reads, rights-cleared specific-outcome mapping validation, append-only result/decision history and instrument immutability after use. The controlled `schedule_assessment_event` operation requires an approved instrument and active programme, snapshots active enrolments effective on the event date, records the eligible denominator in audit history, and moves the event from draft to scheduled atomically. Attempts are constrained by FK to the frozen roster. Other runtime table writes remain disabled. A read-only events API is implemented at GET /api/organisations/{organisationId}/assessments/events; its application policy admits platform administrators, organisation/school administrators and assessors, while denying teachers and viewers. The pure TypeScript domain contracts cover event/attempt state transitions, enrolment scope matching, task scoring, performance bands and instrument immutability.
7. Complete authenticated end-to-end, accessibility, performance and security testing.
8. Complete legal/privacy/DPIA and institutional governance approvals before any live learner pilot.

## Latest deployment checkpoint

- Vercel project root directory is `sentinel`.
- Preview deployment: https://sentinel-platform-56590wifk-pep-popsiis-projects.vercel.app (READY; SSO protected).
- Public unauthenticated requests to `/` and `/api/health` redirect to Vercel SSO; health JSON is not publicly exposed.
- Production has not been promoted or modified.

## Cloud and release guardrails

- Neon project: `sentinel-platform`; use isolated branch `sentinel-development` for development. Never run development migrations against main/Production.
- Vercel automatic deployments are disabled for `sentinel/bootstrap`; no uncontrolled production deployment.
- Do not provision paid/persistent infrastructure or incur new service costs without approval.
- Older ephemeral sandboxes are preserved; use fresh cloud checkouts and do not reset or overwrite stale work.
- The external original implementation brief remains unrecovered; requirements dependent on it are provisional until an authorised share/export route is available. The source-controlled migration journal has 14 entries (0000–0013); the Neon migration ledger has 15 rows, including two historical hashes with no matching current migration file or Git history. Those rows are preserved pending provenance investigation. Migration 0012 (e96a971f24d9feb4906b3b395403c52dbb5a3d34cf239a65132db5a12dcbb5f9) and migration 0013 (593992ecfc18ab4e350acca996ae57968629cc1593623341e7a47b8b1ff4447e) are applied only to the isolated development branch.
