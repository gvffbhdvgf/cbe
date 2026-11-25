# Tenant-Scoped Learner Data RLS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce tenant isolation for Sentinel learner records at PostgreSQL level while preserving the existing Drizzle application architecture.

**Architecture:** Use a dedicated restricted PostgreSQL runtime role, Neon Auth JWT verification, transaction-local claims and a SECURITY DEFINER membership helper. Keep the existing privileged connection for migrations and unrelated administrative services; move every learner-record query and admission write to the restricted role.

**Tech Stack:** Next.js 16, TypeScript, Neon Auth, Neon PostgreSQL, `pg_session_jwt`, Drizzle ORM 0.45, `@neondatabase/serverless` Pool, `jose`, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-tenant-rls-design.md`

## Global Constraints

- Work only in `sentinel/` and the Neon development branch `sentinel-development`.
- Never change Neon Production `main`, Production secrets, or Production deployments.
- Never commit connection strings, JWTs, passwords or other secrets.
- Use `DATABASE_URL` only for migrations/admin work; learner request queries use `DATABASE_AUTHENTICATED_URL`.
- Tenant scope in this increment is direct organisation membership only; no hierarchy inheritance.
- Do not grant DELETE to the learner runtime role.
- Do not load real learner or guardian data.
- Keep the existing application-level learner-manager check and add RLS as a second enforcement layer.

## Review Focus

- Missing, expired or invalid JWT must fail before a database query.
- A valid user from a different organisation must not read, insert or update a learner row by guessing its UUID.
- Revoked, future-dated or expired memberships and inactive organisations must fail closed.
- The platform-administrator path must remain functional without granting global access to ordinary roles.
- Admission and its audit event must remain atomic; no partial learner records may survive a failed audit insert.

---

### Task 1: Add the database RLS foundation migration

**Files:**
- Create: `src/infrastructure/database/migrations/0008_learner_record_rls.sql`
- Modify: `src/infrastructure/database/migrations/meta/_journal.json`
- Test: `scripts/check-migrations.mjs` (existing migration checker)

**Interfaces:**
- Produces extension functions `auth.uid()` and `auth.jwt()`.
- Produces `sentinel_private.can_manage_learner_records(uuid)`.
- Expects role `sentinel_learner_runtime` to exist before migration application.

- [ ] **Step 1: Write the migration contract test** asserting migration 0008 is journalled, installs `pg_session_jwt`, creates the fixed-search-path membership helper, enables and forces RLS on the seven protected tables, and grants no DELETE.
- [ ] **Step 2: Run the test and verify it fails** because migration 0008 does not yet exist.
- [ ] **Step 3: Provision the development-only runtime role** using the Neon role tool with least privilege; retain its returned connection URI only in the secret-setting operation. Do not print it.
- [ ] **Step 4: Implement migration 0008**:
  - Install `pg_session_jwt`.
  - Create `sentinel_private` schema.
  - Create a SECURITY DEFINER, STABLE helper with a fixed search path; it returns true only for an active platform administrator or an active, effective-dated direct organisation membership with role `organisation_admin` or `school_admin`.
  - Revoke public function execution and grant only to the runtime role.
  - Revoke the role's broad default/table privileges, then grant only SELECT/INSERT/UPDATE on the six learner tables and INSERT on `audit_events`.
  - Enable and FORCE RLS on the six learner tables and `audit_events`.
  - Add fail-closed SELECT/INSERT/UPDATE policies for learner tables, SELECT/INSERT only for progression events, and actor-bound INSERT only for audit events.
- [ ] **Step 5: Run `npm run db:check`** and verify the journal contains eight prior migrations plus migration 0008.
- [ ] **Step 6: Apply only to the approved development branch** using the guarded migration runner, then inspect extension functions, role attributes, grants, policies and FORCE flags.
- [ ] **Step 7: Commit** the migration and journal.

### Task 2: Build the verified learner database transaction boundary

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.env.example`
- Create: `src/infrastructure/database/learner-rls-client.ts`
- Test: `src/infrastructure/database/learner-rls-client.test.ts`

**Interfaces:**
- Produces `withAuthenticatedLearnerDb<T>(work: (tx: LearnerTransaction) => Promise<T>): Promise<T>`.
- Uses Neon Auth server `auth.token()`, `NEON_AUTH_JWKS_URL`, `DATABASE_AUTHENTICATED_URL`, `Pool` and Drizzle's Neon WebSocket driver.

- [ ] **Step 1: Write failing tests** for missing token, malformed token, failed signature/issuer/expiry verification, missing UUID `sub`, missing authenticated DB URL, and transaction-local claims setup.
- [ ] **Step 2: Run the tests and verify expected failures.**
- [ ] **Step 3: Add `jose` as a direct dependency** and implement the lazy Pool/Drizzle client plus verified token transaction wrapper. Use parameterised `set_config('request.jwt.claims', JSON.stringify(payload), true)`; never interpolate claims into SQL text.
- [ ] **Step 4: Run the focused tests and verify they pass.**
- [ ] **Step 5: Add an empty `DATABASE_AUTHENTICATED_URL` entry to `.env.example`; document that it is a sensitive development/preview-only URL.**
- [ ] **Step 6: Commit** the client, tests and dependency lockfile.

### Task 3: Move learner service queries to the restricted role

**Files:**
- Modify: `src/application/learner/learner-service.ts`
- Test: `src/application/learner/learner-service.test.ts`

**Interfaces:**
- Learner service uses `withAuthenticatedLearnerDb` for every query against people, learner profiles, classes, enrolments, guardians, progression and learner audit events.
- `requireLearnerManager` remains as an application-layer precondition and uses the existing membership service.

- [ ] **Step 1: Write failing tests** proving admission and listing invoke the restricted transaction, preserve the current role boundary, and keep audit insertion in the same transaction.
- [ ] **Step 2: Run tests and verify expected failures.**
- [ ] **Step 3: Refactor `listLearners` to query only through the restricted transaction.**
- [ ] **Step 4: Refactor `registerLearner` to insert person, learner profile, enrolment, progression event and audit event inside one restricted transaction.**
- [ ] **Step 5: Run focused learner tests and the full Vitest suite.**
- [ ] **Step 6: Commit** the learner-service change.

### Task 4: Add database-backed tenant isolation tests

**Files:**
- Create: `scripts/test-learner-rls.mjs`
- Modify: `package.json` (add `db:test-rls` script)
- Test: Neon development branch only; synthetic fixtures, rolled back in a transaction.

**Interfaces:**
- Requires `DATABASE_URL` (development owner/admin connection) and `DATABASE_AUTHENTICATED_URL` (restricted runtime role).
- Tests the same RLS helper and policy contract used by the application.

- [ ] **Step 1: Write the SQL integration assertions** for same-tenant access, cross-tenant SELECT/INSERT/UPDATE denial, viewer/teacher denial, expired/revoked membership, inactive organisation, platform-admin access and no DELETE privilege.
- [ ] **Step 2: Run the script before enabling policies and verify it fails for the expected missing-policy condition.**
- [ ] **Step 3: Implement the fixture runner** using one database transaction and forced rollback; never leave synthetic learner rows in the development database.
- [ ] **Step 4: Run the integration suite against the development branch and verify every assertion.**
- [ ] **Step 5: Inspect the development database** to confirm no synthetic learner rows remain and all seven tables have RLS enabled and forced.
- [ ] **Step 6: Commit** the integration test.

### Task 5: Configure the development/preview runtime and document the boundary

**Files:**
- Modify: `README.md`
- Modify: `docs/LEARNER_DATA_MODEL.md`
- Modify: `docs/SECURITY_AND_ENVIRONMENTS.md`
- Modify: `docs/ENGINEERING_CONTINUATION_CHECKPOINT.md`
- Modify: Notion Sentinel handoff page

**Interfaces:**
- Vercel Preview variable `DATABASE_AUTHENTICATED_URL` scoped only to branch `sentinel/bootstrap`; never Production.
- No Vercel deployment is triggered by this task.

- [ ] **Step 1: Add the restricted connection URI as a sensitive Preview variable** for the Sentinel branch only; never read it back or print it.
- [ ] **Step 2: Verify the environment variable key/target metadata only**, without decrypting the value.
- [ ] **Step 3: Update documentation** with the new RLS boundary, remaining legal/controller gates, and operational separation between admin and learner runtime connections.
- [ ] **Step 4: Run the full verification suite**: `npm run db:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm audit --audit-level=low`.
- [ ] **Step 5: Review the complete diff and commit** the documentation and configuration changes.

## Completion Contract

- All focused tests and the full Vitest suite pass.
- The migration checker reports no missing or unjournalled migrations.
- Database integration assertions pass on the development branch and leave no test data.
- The runtime role is LOGIN, not superuser, not BYPASSRLS, and has only the specified table grants.
- RLS is enabled and forced on all seven protected tables.
- Learner service no longer uses the privileged owner connection.
- The restricted connection string exists only in Sentinel Preview configuration; no Production variable or deployment was changed.
- GitHub and Notion describe the same verified state.
