# Sentinel — Project Handoff & Current Status

Last checkpoint: 25 November 2026. Update this file and the linked Notion checkpoint after material progress.

## Start here in future chats

Read the Notion handoff page and the Sentinel Product & Engineering Blueprint before continuing:
https://app.notion.com/p/423d7d0ea58d8133a62bea7223f4c98e

Then inspect the latest GitHub branch state through the GitHub integration before editing. Do not repeat bootstrap work or assume approvals are complete.

## Working agreement

- Product: Sentinel, a comprehensive, enterprise-grade education management and intelligence platform supporting Grades 1–9.
- Grade 6 and Grade 9 datasets are reference evidence for discovery and validation only; they do not constrain platform coverage.
- Repository: https://github.com/gvffbhdvgf/cbe
- Working branch: sentinel/bootstrap
- Isolate all project work under sentinel/.
- Cloud-first workflow: use GitHub, Notion, Vercel, Neon, Cloudflare and other connected plugins directly.
- Do not use local-machine connectors, local shells/terminals, desktop/computer automation or ChatGPT Work unless the user explicitly changes this instruction.
- Keep GitHub implementation and Notion documentation aligned.
- Do not trigger Vercel production deployment on every commit. User cites a 24-hour deployment usage limit; use controlled/manual release deployment.
- Evaluate Resend vs SenderKit before choosing a communications provider.
- Use Cloudflare for relevant DNS, edge, security and R2 needs; Neon is the proposed PostgreSQL provider.
- Never commit real secrets or expose connected-plugin OAuth credentials.

## Expanded product scope

The product is to be discovered and designed as one coherent platform, including:
- Institution, organisation and school management
- Learner identity, admission, enrolment, progression and transfer history
- Teacher/workforce records, assignments, workload and relevant professional workflows
- Versioned Grade 1–9 curriculum intelligence
- Teaching and learning operations where validated
- Internal, school-based, inter-school/zonal and external assessment management
- Learner progress, learning-gap analysis and educator-led interventions
- Inter-school, cluster, zone and system-level analytics
- Governance, security, privacy, approvals, audit and data lifecycle
- Integrations, reporting, imports/exports, notifications and platform administration

This is the target discovery scope, not an assertion that every feature is approved for the first release. User requires design thinking, ideation, problem discovery, value evaluation and a transparent algorithmic approach to comparing solution options. The new discovery framework defines the method, weighted decision model, data-redundancy principles, enterprise quality attributes and implementation readiness gates.

## Product discovery baseline

See [PRODUCT_DISCOVERY_AND_SOLUTION_SELECTION.md](https://github.com/gvffbhdvgf/cbe/blob/sentinel/bootstrap/sentinel/docs/PRODUCT_DISCOVERY_AND_SOLUTION_SELECTION.md).

The method is: empathise with stakeholders and observe workflows; define evidence-backed problems; ideate multiple options including process changes; prototype critical journeys; test with representative users; measure value and revise. Hard safety/privacy/legal/operability gates precede weighted scoring. The initial weighted model prioritises learner/educator impact, problem severity, reach, feasibility, data quality/redundancy, security, usability/connectivity, lifecycle cost and evidence confidence. Weights are provisional and must be calibrated with stakeholders.

## GitHub bootstrap

Created and verified on sentinel/bootstrap:
- sentinel/README.md
- sentinel/docs/PRODUCT_REQUIREMENTS.md
- sentinel/docs/ARCHITECTURE.md
- sentinel/docs/SECURITY_AND_ENVIRONMENTS.md
- sentinel/docs/ASSESSMENT_EVIDENCE_AUDIT.md
- sentinel/docs/CURRICULUM_ALIGNMENT_REGISTER.md
- sentinel/docs/PRODUCT_DISCOVERY_AND_SOLUTION_SELECTION.md
- sentinel/.gitignore
- sentinel/.env.example
- sentinel/PROJECT_STATUS.md (this durable checkpoint)

No application code, pull request, default-branch merge, cloud resource or production deployment has been created.

## Notion documents

- Product & Engineering Blueprint: https://app.notion.com/p/423d7d0ea58d81638b15f921729421cc
- Product Requirements: https://app.notion.com/p/423d7d0ea58d815eb288ec45f5803d81
- Architecture: https://app.notion.com/p/423d7d0ea58d81688729de12925308d3
- Security & Environments: https://app.notion.com/p/423d7d0ea58d81d38e5ae87efbf3824b
- Current Handoff: https://app.notion.com/p/423d7d0ea58d8133a62bea7223f4c98e

## Cloud service inspection

- GitHub repository access is confirmed. The working branch is sentinel/bootstrap.
- Vercel team access is available. The team currently lists four projects: v0-build-project, v0-cms-and-ad-sense-blog, v0-supabase-setup and v0-agriculture-management-system. No project named sentinel was found; do not attach or alter an unrelated project. No deployment was triggered and no settings or environment variables were changed.
- Neon organisation access is available, but the organisation currently returns no projects. Do not provision a database until the project architecture and environment plan are validated.
- Cloudflare identity and account access are connected. Read-only inventory found one account and no zones or Worker scripts. No Cloudflare resources have been created or changed.
- No secrets have been retrieved, copied, or exposed. Do not copy private credentials from plugin connections.

## Product/architecture principles

- Version KICD curriculum and preserve source provenance.
- Learner and teacher identities are independent from time-bound school enrolments/assignments.
- Canonical records have clear ownership; avoid module-specific duplicate master data.
- Raw marks, performance levels and curriculum-outcome mastery are distinct.
- Results retain assessment, scoring and curriculum-version context.
- Analytics show denominators, data coverage and lineage.
- Imports should be idempotent, validated, reconcilable and auditable.
- Educators remain responsible for high-stakes learner decisions.
- Prefer clear domain boundaries and a maintainable architecture; do not choose microservices without evidence.

## Evidence caveats

- The external Notion implementation brief belongs to another workspace and has not yet been retrieved through the connected integration.
- Grade 6 category totals are 1,406 (public 1,301 + private 105), but the source report contains conflicting cluster roll presentations: page 40 sums to 1,408; page 41 prints 1,405; cluster rows also differ for Sisiluma and Muchesima. See ASSESSMENT_EVIDENCE_AUDIT.md.
- Grade 9 cluster total is 1,402. Its school-level table shows four private schools (roll 75), while the preface says five private schools participated; this requires clarification.
- KICD curriculum structures and official Grade 6/Grade 9 resources have been reviewed at a structural level. Outcome-by-outcome mapping is not yet complete.

## Immediate next actions

1. Retrieve the external Notion brief through an authorised share/export route.
2. Map stakeholders and validate actual workflows across learner, teacher, school, assessment, curriculum, analytics and governance domains.
3. Confirm institutional hierarchy, role/permission model, teacher-management boundaries and external assessment requirements.
4. Obtain written source-owner confirmation for Grade 6 conflicting cluster counts and Grade 9 private-school participation.
5. Validate learner-level source records against school, cluster, category and gender aggregates.
6. Obtain actual assessment papers, marking schemes and moderation records; then complete KICD outcome mapping.
7. Validate privacy/legal responsibilities, retention, hosting constraints, expected scale, connectivity and service levels with authorised owners.
8. Resolve the intended Vercel project/hosting arrangement. Do not use one of the unrelated existing projects by assumption, and do not enable per-commit production deployment.
9. Reassess Neon after the database/environment plan is approved; current organisation has no projects.
10. Define notification workflows, then select Resend or SenderKit.
11. Prototype and test high-risk workflows before scaffolding production application code.

## Handoff instruction for future chats

Use cloud-connected plugins only. Read this checkpoint and the linked Sentinel Blueprint, Product Requirements, Architecture and Security documents. Inspect the latest GitHub branch and relevant cloud service state before changing anything. Do not use local-machine tooling or ChatGPT Work. Do not repeat completed bootstrap work, do not assume pending approvals have been granted, and update this checkpoint after material progress.


## 25 November 2026 — Enterprise domain and KICD Grades 1–9 design

The product is a comprehensive Grades 1–9 platform. KICD catalogue research confirms Regular Curriculum designs are organised as Lower Primary (Grades 1–3), Upper Primary (Grades 4–6) and Junior School (Grades 7–9), with adapted Special Needs Education designs also published across grades. Curriculum architecture must support versioned regular/adapted pathways and source provenance; do not hard-code Grade 6/9 or assume one flat subject list.

Official KICD catalogue:
- https://kicd.ac.ke/cbc-materials/curriculum-designs/regular-curriculum-designs/
- https://kicd.ac.ke/cbc-materials/lower-primary/
- https://kicd.ac.ke/cbc-materials/curriculum-designs/upper-primary-designs/
- https://kicd.ac.ke/cbc-materials/curriculum-designs/junior-school-designs/
- https://kicd.ac.ke/cbc-materials/curriculum-designs/sne-curriculum-designs/

New domain design: [DOMAIN_MODEL_AND_WORKFLOWS.md](https://github.com/gvffbhdvgf/cbe/blob/sentinel/bootstrap/sentinel/docs/DOMAIN_MODEL_AND_WORKFLOWS.md). It defines bounded contexts, canonical conceptual entities, lifecycle invariants, end-to-end workflows, redundancy controls, solution-priority hypotheses and implementation-readiness gates.

No production schema or application code has been created. Domain ownership, tenancy, workforce data authority, guardian access, assessment taxonomy, curriculum adoption, integration contracts, connectivity and service levels remain to be validated.


## 25 November 2026 — Current design checkpoint

New verified design documents:
- DOMAIN_MODEL_AND_WORKFLOWS.md — bounded contexts, canonical entities, lifecycle invariants and core workflows.
- PROBLEM_DISCOVERY_AND_VALIDATION_PLAN.md — hypotheses, stakeholder research, workflow observation, value metrics and solution selection.
- SECURITY_PRIVACY_THREAT_MODEL.md — child-data privacy, DPIA gate, threat register, tenant isolation and release controls.
- RELEASE_ROADMAP.md — dependency-aware vertical release sequence and pilot scorecard.

All four files are present on sentinel/bootstrap. Notion handoff has corresponding discovery, domain, security and roadmap updates. No application code, production schema, live-data import, cloud resource or production deployment has been created.


## 25 November 2026 — Next engineering priorities completed as design artifacts

Created on sentinel/bootstrap:
- [ROLE_PERMISSION_MATRIX.md](docs/ROLE_PERMISSION_MATRIX.md) — candidate roles, resource/action/scope model, separation of duties and pilot security tests.
- [CANONICAL_DATA_OWNERSHIP_AND_DICTIONARY.md](docs/CANONICAL_DATA_OWNERSHIP_AND_DICTIONARY.md) — domain ownership, conceptual entity dictionary, identifier strategy, effective dating and provenance.
- [UX_NAVIGATION_AND_USER_JOURNEYS.md](docs/UX_NAVIGATION_AND_USER_JOURNEYS.md) — role-aware navigation, critical journeys, accessibility and prototype test plan.
- [API_AND_DATA_EXCHANGE_ARCHITECTURE.md](docs/API_AND_DATA_EXCHANGE_ARCHITECTURE.md) — API boundaries, import/export lifecycle, idempotency, integrations, file controls and resilience tests.

These are proposed baselines for institutional validation, not approved permissions, a production schema, final UX, or deployed endpoints. No application code, database, cloud resource, live learner data import or deployment was created.

Next gates: reconcile the original external implementation brief; validate authority hierarchy and role powers with stakeholders; confirm data owners and identifiers; test priority journeys with representative users; approve privacy/DPIA and tenant boundary; then derive a physical schema and implementation slices.

## 25 November 2026 — cloud foundation and first application slice

- Created a dedicated Vercel `sentinel-platform` project under the existing team, rooted at `sentinel/`. Preview deployments are disabled and no deployment has been triggered.
- Created Neon PostgreSQL 17 project `sentinel-platform` in Frankfurt (`aws-eu-central-1`) on the connected Free plan. Main branch and isolated `sentinel-development` branch exist. Free account limits observed: 1 GB branch logical-size limit and six-hour branch history; custom compute suspension intervals are not permitted.
- Enabled Neon Managed Auth (Better Auth) on the main branch. Email/password is enabled, verification is configured, and self-service registration is disabled. Application auth environment variables are stored in Vercel project settings.
- Created private Neon Object Storage buckets: `sentinel-quarantine`, `sentinel-private`, `sentinel-exports`.
- Created ephemeral Upstash Box `sentinel-cloud-dev`, Node runtime, browser enabled, cloned repository, 10 GB workspace, maximum three-day TTL.
- Resend account has no sending domains. Cloudflare R2 bucket creation is blocked until R2 is activated in the Cloudflare Dashboard (API error 10042). No R2 buckets were created.
- Scaffolded the Next.js 16 / React 19 / TypeScript application under `sentinel/`, with public landing page, managed sign-in page, protected workspace, protected organisation directory empty state, health endpoint, domain organisation invariants, and scoped authorisation policy.
- Added Drizzle organisation schema and SQL migration. Applied the organisation table only to the isolated Neon development branch. No migration was applied to main.
- Added GitHub Actions CI workflow; hosted run not yet verified.
- Verified `npm run lint`, `npm run typecheck`, `npm test` (9 passing), `npm run build`, `npm audit` (0 vulnerabilities), and `git diff --check` in the cloud sandbox.
- Browser smoke tests: landing page loads, sign-in page loads, unauthenticated workspace redirects to sign-in, public health endpoint returns service status.
- Added `docs/IMPLEMENTATION_FOUNDATION.md` with exact resource status, limits, verification and blockers.
- No production deployment, live learner data import, custom domain, email sending domain, or production schema migration exists.


## 25 November 2026 — Softflix brand and visual design system

- Established company/product brand architecture: Softflix is the company; Sentinel is the education operations and intelligence product.
- Created original shield/open-book/north-star vector mark and favicon.
- Reworked public landing page, authentication screen, workspace shell and organisation directory around a consistent design language: midnight navy, teal/aqua, restrained amber, readable sans-serif typography, generous whitespace, accessible hierarchy and restrained motion.
- Added `docs/BRAND_AND_DESIGN_SYSTEM.md` documenting brand architecture, logo use, colour, typography, composition, iconography, data visualisation and accessibility rules.
- Verified landing page and sign-in render in the cloud sandbox. Lint, typecheck, 9 tests, production build and dependency audit pass.
- Vercel domain research: `softflix.com` is unavailable; `softflix.app` is available. Vercel quoted USD 9.99 for a one-year registration with auto-renew disabled. No purchase was made; registration is non-refundable, charged immediately to the team's default card, and taxes/fees may apply. Explicit purchase approval and registrant contact details are required.
- No custom domain attached and no Vercel deployment created yet. The default Vercel project URL will be used for the first controlled preview; branded domain can be attached after registration.


## 25 November 2026 — Sentinel development preview access configured

- Confirmed Vercel deployment `dpl_5CjiKU2QWwpt8qW9wRqZbyEL4aAX` is READY on branch `sentinel/bootstrap` (commit `ddd7c97031c8e732b22452920c4ee2a3c5779aff`). Preview URL: https://sentinel-platform-git-sentinel-bootstrap-pep-popsiis-projects.vercel.app
- Confirmed Vercel project environment entries exist for `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, and `NEON_AUTH_COOKIE_SECRET`; they are configured for production, preview and development. Secret values were not copied into source control or exposed. Their decrypted values could not be independently inspected through the connected Vercel API.
- Confirmed Neon PostgreSQL 17.12 connectivity to database `sentinel` on the isolated `sentinel-development` branch. No production database was touched.
- Added both the immutable deployment URL and stable branch alias to Neon Auth's Better Auth trusted-origin allowlist.
- Vercel deployment protection initially redirected anonymous preview visitors to Vercel login. Created an alias-scoped protection override for the stable preview alias only; the temporary shareable bypass was revoked after the override was verified. Production protection settings were not changed.
- Browser verification: stable preview alias renders the Sentinel landing page and branded sign-in screen. `/api/health` returns HTTP 200 with `{"status":"ok","service":"sentinel-platform"}`.
- Authentication success remains unverified: no test user was created and no credentials were submitted. Neon Auth currently has email/password enabled, email verification required, self-service sign-up disabled, and no trusted origins before this configuration.
- The preview alias is publicly reachable and must contain synthetic/demo data only. Do not load learner records until institutional authority, controller/processor roles, privacy notices/lawful basis, DPIA and access controls are approved.
- No domain was purchased. No production deployment, production schema migration or live learner-data import occurred.


## 25 November 2026 — Administrator access and organisation onboarding foundation

- Added Preview-only Vercel environment overrides for `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL` and `NEON_AUTH_JWKS_URL`. They point to Neon branch `sentinel-development`. Existing Production and Development targets were retained separately. The cookie secret remains shared across targets; consider rotating/separating it before production.
- Applied additive schema on Neon `sentinel-development`: `platform_administrators`, `organisation_memberships` and `audit_events`. The existing `organisations` table remains empty.
- Added Drizzle schema definitions and migration `0001_organisation_access.sql`.
- Added server-side membership-scoped organisation listing, effective-date checks, platform-administrator-gated organisation registration, creator membership assignment and audit event recording. The three onboarding writes use Neon HTTP `db.batch` to keep them atomic.
- Added `GET/POST /api/organisations`; the API route is excluded from the auth middleware redirect so unauthenticated requests receive JSON 401 responses and authenticated non-platform-admin requests receive 403.
- Updated the institution directory to display only active organisations linked to the signed-in user and show registration UI only to platform administrators.
- No platform administrator or test user has been provisioned. Neon Auth self-service sign-up remains disabled and no email delivery provider is configured. Initial platform-admin provisioning and administrator invitation/account activation remain explicit operational gates; do not seed a guessed user ID or enable open sign-up.
- A controlled Vercel Preview deployment was built from commit `5cee290e72f2f2d82ef215b70ff504c4f8800b82` and is READY. TypeScript compilation passed. Anonymous endpoint verification is pending against this latest deployment after the API middleware correction.
- Tenant enforcement currently uses server-side membership predicates in the application data-access path. PostgreSQL RLS has not been enabled; do not claim database-enforced RLS. Add RLS only with a connection/transaction-scoped tenant context design that is compatible with Neon HTTP and tested against cross-tenant access.
- No Production schema changes, Production environment changes, live learner data, test accounts, domain purchase or Production deployment occurred.


### Verification follow-up

- Cloud sandbox checks on the latest `sentinel/bootstrap` branch: `npm ci` completed with 0 reported vulnerabilities; `npm run typecheck` passed; `npm test` passed (2 files, 9 tests); `npm run lint` passed.
- Vercel Preview build completed successfully, including Next.js production build and TypeScript validation.
- Browser verification against the stable Preview alias confirmed unauthenticated `GET /api/organisations` returns HTTP 401, `application/json`, body `{"error":"Authentication required"}`; `GET /api/health` returns HTTP 200 and `{"status":"ok","service":"sentinel-platform"}`.
- Authenticated end-to-end flows, platform-admin onboarding, tenant-crossing integration tests and database query behaviour under real user sessions remain unverified because no user account was provisioned.
- npm install reports non-blocking peer dependency/deprecation warnings for the Neon Auth dependency tree and ESLint 9; these should be reviewed during dependency maintenance.


### Latest schema and deployment checkpoint

- Aligned Drizzle schema constraints and descending audit indexes with the development database; renamed the development membership constraints to match the migration/schema definitions.
- Re-ran cloud sandbox validation after the schema alignment: typecheck passed, all 9 unit tests passed, and ESLint passed.
- Verified the four Preview environment variable values against the Neon development branch without exposing them: both Auth URLs match exactly and both database connection strings identify the development branch.
- Latest code deployment: `dpl_5ZKH9P3JhTiScmjzQzJjJc28r3Q1`, READY, built from commit `489488867ea49cb5e45b2bc046fc49fb071e7188`; stable alias remains https://sentinel-platform-git-sentinel-bootstrap-pep-popsiis-projects.vercel.app.


### Preview session-secret isolation

- Replaced the shared Preview session-cookie secret with a newly generated independent 256-bit secret stored as a Vercel sensitive environment variable targeted only to Preview.
- The existing cookie-secret variable now targets Production and Development only; those values were not read or exposed.
- Redeployed the same verified application commit with the Preview-only secret. Deployment `dpl_VgBKY4YbxRDon1QWmwe2S1ctxQTS` reached READY and retains the stable preview alias.


### Managed-auth identity integrity and bootstrap runbook

- Changed administrator, membership and audit actor identifiers from free-form text to UUID foreign keys referencing `neon_auth."user"(id)`. This prevents orphaned access grants and ties all privileged actions to real managed-auth identities.
- Applied the corresponding additive type/FK changes on `sentinel-development`; verified the resulting constraints and column types through Neon schema inspection. The tables remain empty.
- Added [ADMINISTRATOR_BOOTSTRAP.md](docs/ADMINISTRATOR_BOOTSTRAP.md), a development-only, approval-gated runbook for promoting one verified managed-auth user to platform administrator. It does not create accounts or enable self-service sign-up.
- Cloud sandbox validation after this change passed: TypeScript, all 9 unit tests and ESLint.
- Latest controlled Preview deployment is READY: `dpl_46uury4FeiSBp8HpfqbNhSmKPdLZ`, code commit `0f3f2ff25c8fe5625069a7d4688dc01408bfb43b`. Production remains untouched.


### 25 November 2026 — Foundation hardening and developer workflow

- Added a shared sign-out control to the authenticated workspace and institution directory.
- Corrected the organisation domain identity to use a UUID compatible with the PostgreSQL primary key; added domain validation for organisation and external-identifier length limits.
- Added a migration journal checker and a Neon serverless migration runner. The runner requires an explicit development flag and rejects any database host other than the approved `sentinel-development` endpoint. Migration statements and their history record are executed transactionally; applied migration files are hash-checked and cannot be silently edited.
- Reconciled the existing development schema with migration history: verified `organisations`, membership, administrator and audit structures, then recorded SHA-256 hashes for baseline migrations `0000_lovely_lilandra` and `0001_organisation_access` in `public.__drizzle_migrations`. No learner data was inserted.
- Added `docs/DATABASE_MIGRATIONS.md`; corrected README project status to distinguish implemented foundation from unbuilt product modules.
- Cloud sandbox verification on a clean `npm ci`: migration journal check passed; TypeScript passed; 9/9 unit tests passed; ESLint passed; Next.js production build passed; `npm audit` reported 0 vulnerabilities.
- Latest controlled Vercel Preview deployment: `dpl_6tzUHc6ssXokjudm4YcxNffhkWMU`, READY, code commit `c6588e50b9899f63dc25abe5ca8e5108947a3d15`. Stable alias: https://sentinel-platform-git-sentinel-bootstrap-pep-popsiis-projects.vercel.app.
- Read-only browser re-verification of the latest deployment is in progress. Authenticated sign-in, administrator provisioning, cross-tenant integration tests and PostgreSQL RLS remain unverified/not implemented.


### Latest Preview browser verification — 25 November 2026

The stable alias was checked directly after deployment `dpl_6tzUHc6ssXokjudm4YcxNffhkWMU`:

- `GET /api/health`: HTTP 200, JSON `{"status":"ok","service":"sentinel-platform"}`.
- `GET /api/organisations`: HTTP 401, JSON `{"error":"Authentication required"}`.
- `GET /auth/sign-in`: HTTP 200, sign-in page rendered.
- `GET /workspace`: HTTP 307 redirect to `/auth/sign-in`, then HTTP 200 sign-in page.
- No credentials were submitted and no write operation was performed.


### 25 November 2026 — Organisation membership administration

- Added a dedicated membership policy with role-assignment boundaries: platform administrator can grant all organisation roles; organisation administrator can grant school-admin/teacher/assessor/viewer; school administrator can grant teacher/assessor/viewer; operational roles cannot manage memberships.
- Added server-side member listing, granting to existing verified/non-banned managed-auth accounts, role changes, and revocation endpoints. No user creation, public sign-up, or invitation email is implied.
- Added a shared membership management screen linked from the institution directory for authorised administrators. It explains that accounts must already exist and be verified.
- Added audit events for grants, role changes and revocations; prevents self-role changes, prevents org-admin self-promotion, and protects the last active organisation administrator from revocation.
- Added a partial unique database index ensuring at most one active role membership per user per organisation; applied and verified on `sentinel-development`. Recorded migration `0002_membership_active_uniqueness` in migration history.
- Added five membership-policy tests. Clean cloud install checks: migration journal passed, TypeScript passed, 14/14 tests passed, lint passed, production build passed, npm audit 0 vulnerabilities.
- Latest controlled Preview deployment: `dpl_9SsJRv437GD7Wp66B5W7m56CXucX`, READY, code commit `912a6e241173cfa04865afbbb76e85e0ad630ae2`.
- Authenticated member-management flows remain unverified because no administrator/test account exists. The latest anonymous API/page checks are in progress.


### 25 November 2026 — KICD curriculum catalogue foundation

- Added a source-linked curriculum registry and authenticated catalogue browser for Grades 1–9.
- Seeded the isolated Neon development database with 12 KICD source records, 2 catalogue editions, 9 pathway records, 20 canonical learning-area labels and 120 grade offerings.
- Regular catalogue counts: Grades 1–3 each contain 8 KICD-listed designs plus one explicitly flagged Indigenous Language discrepancy; Grades 4–6 each contain 15; Grades 7–9 each contain 16.
- The lower-primary discrepancy is evidence-based: Indigenous Language appears in the September 2026 complementary-materials submission scope but is absent from the current KICD Lower Primary curriculum-design page. It is not treated as confirmed curriculum design.
- Registered HI, PI and VI adapted pathways, plus accelerated/enriched, specialised, intervention, prevocational and vocational modalities. No SNE grade-level learning-area offering is inferred or seeded until individual grade documents are validated.
- Curriculum design catalogue, approved materials addendum, complementary-materials submission and the 2019 Basic Education Curriculum Framework are stored as distinct source types.
- Added source provenance, edition status, pathway metadata, availability status and migration history through migrations 0003–0005. The six-migration journal and development schema were verified; all 120 regular offerings reconcile to grade-level source catalogues.
- Added the Curriculum Intelligence workspace module and a grade/pathway browser with official source links and discrepancy status.
- Cloud validation: migration journal passed; TypeScript passed; 14/14 unit tests passed; ESLint passed; Next.js production build passed; npm audit reported 0 vulnerabilities.
- Latest controlled Preview deployment: `dpl_12JJAnkF8GG3HDAidF1NTdQnYevo`, building from code commit `b71bfa9cc58292141709deabbe9a78298c6748de`. Browser verification is pending.
- Detailed strands, sub-strands, outcomes, inquiry questions, experiences, competencies, values, PCIs, CSL and rubrics have not yet been ingested. Catalogue import is not full curriculum content implementation.


### Latest curriculum Preview verification — 25 November 2026

Deployment `dpl_12JJAnkF8GG3HDAidF1NTdQnYevo` is READY and browser-verified on the stable alias:

- `GET /api/health`: HTTP 200, expected JSON.
- `GET /auth/sign-in`: HTTP 200.
- `GET /workspace/curriculum`: HTTP 307 redirect to sign-in for anonymous users.
- `GET /api/organisations`: HTTP 401 JSON.
- `GET /api/organisations/{uuid}/members`: HTTP 401 JSON.
- These were read-only requests; no account was created and no data was changed.


### 25 November 2026 — Curriculum source-document staging

- Added a curriculum document registry linked to a specific grade/pathway/edition offering and an authoritative source record.
- Added a hierarchical extraction-staging table for strand, sub-strand, outcome, learning experience, inquiry question, competency, value, PCI, CSL and rubric node types. Every node retains document provenance, source page, extraction status and review state; it is a staging layer, not yet an approved canonical outcome store.
- Identified the official Grade 6 CRE PDF: `CRE-GRADE-6-DESIGN-APRIL-2024.pdf`. The cover states “First Published in 2021” while the file path/name indicates an April 2024 file. Current revision status is therefore unresolved; document review is pending and rights/permission status is not assessed.
- Indexed only five strand headings and 22 sub-strand headings from the PDF contents. No full learning-outcome, learning-experience or rubric body text was copied. All 27 headings remain in `catalogued` status and require curriculum-specialist review.
- Applied migration `0006_curriculum_document_staging` to Neon `sentinel-development`; verified one source document, five strands and 22 sub-strands.
- Cloud validation after the document staging changes: migration journal passed (7 migrations), TypeScript passed, 14/14 tests passed, lint passed, Next.js build passed, npm audit 0 vulnerabilities.
- Latest controlled Preview deployment: `dpl_7cBovYD4KVexpFVaBHtbWXcGRvYp`, building from code commit `ab7cdc99413717446a32830c13037530516a61dc`. Browser verification is pending.


### 25 November 2026 — Learner register and enrolment foundation

- Added tenant-scoped `people`, `learner_profiles`, `classes`, `learner_enrolments`, `guardian_relationships` and `learner_progression_events` tables.
- Composite foreign keys bind learner identities, enrolments, classes, guardian relationships and progression events to the same tenant boundary; class references must also match organisation, grade and academic year. One active enrolment per learner/tenant is enforced.
- Added a server-side learner register API and administrator/school-administrator page to list and register learners. Admission writes person, learner profile, enrolment, progression event and audit event in one Neon HTTP batch.
- Admission form uses data minimisation: required first/last name, optional middle/preferred name and optional date of birth, grade and academic year. It does not collect national identifiers, phone/email, health/disability data, biometrics, photographs or guardian contacts. Date of birth is not displayed in the register and personal details are excluded from audit metadata.
- Added domain validation tests for names, grades, academic years and dates. Cloud checks: migration journal passed (8 migrations), TypeScript passed, 19/19 tests passed, lint passed, Next.js build passed, npm audit 0 vulnerabilities.
- Applied migration `0007_learner_records_tenant_scope` on Neon `sentinel-development`; verified all six learner tables exist and contain zero rows.
- Added [LEARNER_DATA_MODEL.md](docs/LEARNER_DATA_MODEL.md), including tenant boundaries, data minimisation and live-pilot gates.
- Class creation/assignment, guardian verification and portal access, transfer workflows, learner updates/exits, RLS and cross-tenant integration tests remain outstanding.
- Latest controlled Preview deployment: `dpl_ArC26w3rJ3vi7JjSuCygoYFBu2Uk`, building from code commit `ecccb2d7e51b64e4021e292219fd987ae924c473`.
