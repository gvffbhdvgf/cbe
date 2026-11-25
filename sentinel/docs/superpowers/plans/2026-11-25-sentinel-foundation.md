# Sentinel Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first runnable, testable Sentinel application foundation for institutional users, with a domain-driven module boundary, secure authentication entry point, accessible workspace shell, and a first organisation-directory slice.

**Architecture:** A Next.js App Router modular monolith in `sentinel/`, TypeScript, PostgreSQL 17 on Neon, Neon Auth (Better Auth integration), and domain/application/infrastructure/presentation separation. Vercel hosts controlled deployments; Upstash Box is the cloud development environment. No microservices or live learner records in this increment.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Vitest, Drizzle ORM, PostgreSQL, Neon Auth.

**Spec:** `sentinel/docs/PRODUCT_REQUIREMENTS.md`, `sentinel/docs/ARCHITECTURE.md`, `sentinel/docs/DOMAIN_MODEL_AND_WORKFLOWS.md`, `sentinel/docs/ROLE_PERMISSION_MATRIX.md`, `sentinel/docs/CANONICAL_DATA_OWNERSHIP_AND_DICTIONARY.md`, `sentinel/docs/UX_NAVIGATION_AND_USER_JOURNEYS.md`, `sentinel/docs/API_AND_DATA_EXCHANGE_ARCHITECTURE.md`.

## Global Constraints

- Grades 1–9 remain the product scope; the first slice does not implement every module.
- Domain boundaries follow business capabilities, not technical layers alone.
- Person identity is distinct from learner enrolment and staff engagement.
- Authorisation is resource + action + scope; default deny.
- No live child data or identifying learner fixtures.
- No public object buckets; imports/exports are private and staged.
- No self-service account registration; access is provisioned by an authorised administrator.
- No automatic Vercel production deployment on Git pushes.
- Secrets stay in managed environment variables and are never printed or committed.
- No production schema migration until tested on an isolated Neon branch.

## Review Focus

- Unauthenticated users must never see protected institutional data.
- Disabled registration must not be bypassable through UI or API.
- Cross-institution scope must be denied by service policy, not only filtered in the UI.
- Empty and malformed organisation records must fail validation.
- A failed network request must not falsely display a successful save.
- The app must remain usable with keyboard navigation and narrow viewports.

---

### Task 1: Application workspace and quality gates

**Files:**
- Create: `sentinel/package.json`, Next.js App Router files, TypeScript/Tailwind configuration.
- Create: `sentinel/src/domain`, `sentinel/src/application`, `sentinel/src/infrastructure`, `sentinel/src/presentation`.
- Create: `sentinel/vitest.config.ts`, test setup and a health smoke test.

- [ ] Inspect supported runtime and scaffold a Next.js TypeScript application in `sentinel/`.
- [ ] Add lint, typecheck, test and build scripts.
- [ ] Write a failing health/domain smoke test; run it and confirm the expected failure.
- [ ] Implement the minimal health route and app shell; run unit tests, typecheck and production build.
- [ ] Commit the runnable foundation.

### Task 2: Identity and authorisation boundary

**Files:**
- Create: `src/infrastructure/auth/neon-auth.ts`.
- Create: `src/application/security/authorization.ts`.
- Create: `src/application/security/authorization.test.ts`.
- Create: `src/presentation/auth/sign-in-form.tsx`, route handlers/middleware as supported by the selected Neon Auth SDK.

- [ ] Read current Neon Auth documentation and define the server-side session verification contract.
- [ ] Write failing tests for default-deny, matching scope, wrong scope, expired assignment and missing capability.
- [ ] Implement a pure policy evaluator with explicit subject, capability, resource and scope.
- [ ] Integrate server-side auth and protect the workspace; registration remains disabled.
- [ ] Verify unauthenticated access is rejected and authorised sessions are required.

### Task 3: Organisation domain vertical slice

**Files:**
- Create: `src/domain/organisation/organisation.ts`, `organisation.test.ts`.
- Create: `src/application/organisation/organisation-service.ts`.
- Create: `src/infrastructure/database/schema/organisation.ts`, migration files.
- Create: `src/presentation/organisation/organisation-directory.tsx`, page and route.

- [ ] Write failing domain tests for valid organisation, blank name, duplicate issuer identifier and effective status.
- [ ] Implement organisation value objects/entities and invariants.
- [ ] Add a minimal organisation persistence model with opaque ID, issuer-namespaced external identifier, status and audit timestamps.
- [ ] Test migration on a disposable Neon branch; inspect constraints and indexes.
- [ ] Apply reviewed migration to main only after branch tests pass.
- [ ] Build a scoped directory experience with explicit empty/loading/error states and no fabricated institution records.

### Task 4: Operational readiness

**Files:**
- Create: `sentinel/.github/workflows/ci.yml`.
- Modify: README, environment template, release and deployment documentation.

- [ ] Add GitHub CI for install, lint, typecheck, tests and build.
- [ ] Configure Vercel project to require controlled/manual releases and deployment protection.
- [ ] Add environment-variable names and setup guidance without secret values.
- [ ] Verify preview/build without promoting to production.
- [ ] Record operational limits, backups, storage lifecycle, email-domain dependency and release procedure.

## Execution notes

- Use synthetic organisation fixtures only, clearly labelled as test data.
- The first slice establishes patterns; learner, staff, curriculum, assessment and analytics contexts follow as separate vertical slices.
- Do not infer Kenya's administrative hierarchy beyond validated source data; organisation relationships are typed and configurable.
- Do not activate email verification or user invitations until a verified sending domain and sender identity exist.
