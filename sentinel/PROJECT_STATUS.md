# Sentinel — Project Handoff & Current Status

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
- 56 automated tests pass across 11 test files; lint, typecheck and production build pass in the current Sentinel workspace. A protected Vercel Preview deployment is READY for the curriculum browser. The preview has not been promoted to Production.

## Current security boundary

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
6. Complete authenticated end-to-end, accessibility, performance and security testing.
7. Complete legal/privacy/DPIA and institutional governance approvals before any live learner pilot.

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
- The external original implementation brief remains unrecovered; requirements dependent on it are provisional until an authorised share/export route is available. The source-controlled migration journal has 11 entries (0000–0010); the Neon migration ledger has 13 rows, including two historical hashes with no matching current migration file or Git history. Those rows are preserved pending provenance investigation.
