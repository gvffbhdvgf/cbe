# Sentinel

Sentinel is a comprehensive education management and intelligence platform for Grades 1–9. It is intended to connect institutional operations, learner and teacher lifecycle, KICD curriculum, teaching and learning, internal/external assessment, learner progress and intervention, inter-school analytics, governance and security.

Grade 6 and Grade 9 assessment records are reference datasets for validation only; they do not limit platform scope.

This directory is the isolated Sentinel project workspace within the cbe repository. Keep Sentinel application code, engineering documentation, infrastructure definitions and tests under this directory unless a repository-wide concern genuinely belongs at the root.

## Product and engineering principles

- Engineer before coding: understand users, institutional context, workflows, outcomes and constraints.
- Use design thinking: empathise, define, ideate, prototype, test and iterate.
- Validate problems with evidence; do not confuse feature requests with root causes.
- Compare solution alternatives using transparent value, feasibility, risk and evidence criteria.
- Preserve curriculum edition/pathway and assessment provenance.
- Keep learner identity independent from school enrolment and teacher identity independent from assignments.
- Avoid redundant master records; define authoritative ownership and derived read models.
- Distinguish raw marks, performance levels and curriculum-outcome mastery.
- Make analytics denominator-aware, comparable and auditable.
- Keep educators responsible for high-stakes learner decisions.
- Protect children's data with privacy-by-design, least privilege and accountable access.
- Deliver the full platform through controlled, dependency-aware vertical releases.

## Discovery and design documents

- [Product Discovery & Solution Selection](docs/PRODUCT_DISCOVERY_AND_SOLUTION_SELECTION.md)
- [Problem Discovery & Validation Plan](docs/PROBLEM_DISCOVERY_AND_VALIDATION_PLAN.md)
- [Domain Model & Core Workflows](docs/DOMAIN_MODEL_AND_WORKFLOWS.md)
- [Release Roadmap](docs/RELEASE_ROADMAP.md)
- [ADR-001 — Tenant Boundary & Data Isolation](docs/ADR-001-TENANCY-AND-DATA-ISOLATION.md)
- [ADR-002 — Learner Record RLS & Identity Context](docs/ADR-002-LEARNER-RECORD-RLS.md)
- [Security & Privacy Threat Model](docs/SECURITY_PRIVACY_THREAT_MODEL.md)
- [Product Requirements](docs/PRODUCT_REQUIREMENTS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security & Environments](docs/SECURITY_AND_ENVIRONMENTS.md)
- [Assessment Evidence Audit](docs/ASSESSMENT_EVIDENCE_AUDIT.md)
- [KICD Curriculum Alignment Register](docs/CURRICULUM_ALIGNMENT_REGISTER.md)
- [KICD Curriculum Catalogue Register](docs/CURRICULUM_CATALOGUE_REGISTER.md)
- [Learner Data Model](docs/LEARNER_DATA_MODEL.md)
- [Engineering Continuation Checkpoint](docs/ENGINEERING_CONTINUATION_CHECKPOINT.md)

## Governance, data and implementation design

- [Role & Permission Matrix](docs/ROLE_PERMISSION_MATRIX.md)
- [Canonical Data Ownership & Dictionary](docs/CANONICAL_DATA_OWNERSHIP_AND_DICTIONARY.md)
- [UX Navigation & User Journeys](docs/UX_NAVIGATION_AND_USER_JOURNEYS.md)
- [API & Data Exchange Architecture](docs/API_AND_DATA_EXCHANGE_ARCHITECTURE.md)

## Engineering workflow

1. Review the original product brief, source records, KICD curriculum editions and institutional workflows.
2. Map stakeholder authority, source-of-truth ownership, data lifecycle and service constraints.
3. Validate problem hypotheses and measurable outcomes.
4. Prototype and test high-risk journeys before committing to physical schema or application code.
5. Record architecture and product decisions with alternatives and rationale.
6. Build incremental vertical slices with automated tests, security controls and migration/reconciliation plans.
7. Use cloud-connected services and plugins for repository work, documentation, infrastructure and collaboration.
8. Keep GitHub and Notion aligned with durable checkpoints.
9. Inspect deployment settings before enabling automation; ordinary commits must not trigger production deployments.
10. Release through explicit review, approval, monitoring and rollback controls.

## Current status

Discovery, domain modelling, security/privacy design and the first application vertical slices are implemented. The application includes managed authentication, organisation onboarding and membership administration, audit events, learner admission/listing, and source-linked KICD Grades 1–9 regular curriculum and SNE pathway catalogues.

**Learner-record database isolation is implemented on the isolated Neon development branch.** Migration 0008 enables and forces PostgreSQL RLS for learner/person/enrolment/class/progression/guardian/audit tables. Learner reads and writes use a restricted database login inheriting the non-login `sentinel_learner_runtime` role. The server obtains a Neon Auth JWT, verifies it against the configured JWKS and issuer, checks that its subject matches the authenticated session, then establishes transaction-local claims and confirms the database identity before learner queries. The restricted role has no UPDATE or DELETE privileges.

The restricted connection variable `DATABASE_AUTHENTICATED_URL` is not yet configured in Vercel: the `sentinel-platform` project has no connected Git repository, so Vercel rejected creation of a branch-scoped Preview variable. Do not widen this secret to all Preview deployments or Production as a workaround. Until the correct Preview configuration is available, RLS-backed learner operations fail closed.

The last full test execution passed 31 tests. Four additional API error-mapping tests were added afterward and have not yet been executed; the new GitHub Actions workflow has not reported a hosted run or status check yet. Authenticated end-to-end tests with a governed institutional test account, positive/negative cross-tenant integration tests, class creation and placement, transfer/progression, guardian verification, full KICD outcome ingestion, institutional workflow validation and legal/DPIA approvals remain outstanding. This is an active development project, not a production-ready system.

See [PROJECT_STATUS.md](PROJECT_STATUS.md) and [Engineering Continuation Checkpoint](docs/ENGINEERING_CONTINUATION_CHECKPOINT.md) for the current handoff.

## Cloud-first working mode

Use GitHub, Notion, Vercel, Neon, Cloudflare and other connected plugins directly. Do not use local-machine connectors, terminal/shell execution, desktop automation or ChatGPT Work unless the user explicitly changes this instruction. Prefer cloud-native repository edits and reviewable commits.

## Configuration and secrets

Never commit .env files, API tokens, private keys, database passwords, email credentials or other secrets. Commit only a sanitised .env.example containing variable names and safe placeholders. `DATABASE_URL` is the privileged application/administrative connection; learner-record queries must use the restricted `DATABASE_AUTHENTICATED_URL` connection so PostgreSQL RLS applies.

- [Implementation Foundation & Cloud Resource Status](docs/IMPLEMENTATION_FOUNDATION.md)
- [Database Migration Operations](docs/DATABASE_MIGRATIONS.md)
- [Softflix Sentinel Brand & Design System](docs/BRAND_AND_DESIGN_SYSTEM.md)

## Application workspace

The Next.js application lives in this directory. Run it with `npm ci`, `npm run dev`; validate with `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. Database schema changes are versioned under `src/infrastructure/database/migrations`; use `npm run db:check` and `SENTINEL_ENVIRONMENT=development npm run db:migrate`. The migration runner accepts only the approved `sentinel-development` Neon endpoint. Never point development migration commands at Production.

The current application foundation includes a public introduction, managed authentication entry point, protected workspace shell, organisation onboarding and member administration, a privacy-minimised learner register, a KICD curriculum catalogue browser, source-provenance metadata, audit events, and a health endpoint.

## Cloud resources

- Vercel project: `sentinel-platform` (controlled releases; automatic deployments disabled for `sentinel/bootstrap`). The project is not currently connected to a Git repository; branch-scoped Preview secret configuration is blocked.
- Neon PostgreSQL 17 project: `sentinel-platform`, Frankfurt region. Main branch is reserved for the stable environment; `sentinel-development` is an isolated development branch.
- Neon Auth: Managed Better Auth enabled; public sign-up disabled; institutional accounts must be provisioned.
- Private Neon Object Storage buckets: `sentinel-quarantine`, `sentinel-private`, `sentinel-exports`.
- Upstash Box: ephemeral development sandbox; do not store production secrets or live learner records in it.

No production schema migration, live learner import, public object access or production deployment has been performed. The organisation schema has been applied only to the isolated development branch and remains subject to tenancy/data-controller review before production use.


## Deployment control

Automatic Git-triggered Vercel deployments are disabled for `sentinel/bootstrap` in [vercel.json](vercel.json). GitHub CI continues to validate commits; Preview and Production deployments must be initiated deliberately after the required checks and environment approvals. This setting does not disable manual, controlled deployments.
