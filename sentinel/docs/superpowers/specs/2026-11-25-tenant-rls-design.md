# Tenant-Scoped Learner Data RLS — Design

**Date:** 25 November 2026
**Status:** Development implementation design; not production approval
**Owner:** Sentinel engineering; institutional data-controller approval remains outstanding

## Intent

Add database-enforced tenant isolation to Sentinel's first learner-record vertical slice. Today, learner access is guarded by server-side organisation-role checks and tenant-aware foreign keys, but PostgreSQL RLS is disabled. A missed application filter could therefore expose another organisation's learner records.

This design adds a second, database-enforced boundary while preserving the existing Next.js modular monolith and Drizzle domain/application structure.

## Evidence from the current system

- The connected Neon development branch is `sentinel-development`; Production `main` is not in scope.
- All 18 tables in the development branch's `public` schema currently have RLS disabled.
- `pg_session_jwt` 0.5.0 is available but not installed; `auth.uid()`, `auth.user_id()` and `auth.jwt()` are not currently present.
- The existing `sentinel_owner` database role has `BYPASSRLS`; it must not be used for learner request queries.
- The current learner model treats an organisation ID as the tenant boundary. The tenancy ADR explicitly says this is provisional pending controller, contractual and hierarchy validation.
- The current learner register allows platform administrators, organisation administrators and school administrators. Teacher/assessor class assignments and guardian portal access are not implemented.

## Approaches considered

### A. Keep application-level filters only

Smallest change, but a missed predicate or new query can bypass tenant isolation. This does not meet the security threat model's requirement for database-enforced isolation. Rejected.

### B. Move all queries to the Neon Data API

The Data API applies JWT claims and PostgreSQL permissions automatically. However, Sentinel currently uses server-side Drizzle queries, joins and transactional write workflows. Switching to a PostgREST client would require a broader data-access redesign and RPC/transaction changes. Not the best first increment.

### C. Keep server-side Drizzle and add a restricted RLS runtime role

Use a dedicated LOGIN role with `NO BYPASSRLS`, a separate authenticated connection string, Neon Auth's server-side `auth.token()` method, signature verification using the branch JWKS, and transaction-local JWT claims. Use Drizzle's Neon WebSocket/Pool driver so all learner writes and the audit event execute inside one transaction. Keep the existing owner connection for migration/administrative tasks only.

**Selected engineering approach: C.** It preserves the existing application/domain architecture, creates a real database boundary, and can be introduced incrementally without migrating the rest of the application to PostgREST.

## Scope

Protect these existing tables in the development branch:

- `people`
- `learner_profiles`
- `classes`
- `learner_enrolments`
- `guardian_relationships`
- `learner_progression_events`
- `audit_events` (insert-only for the learner registration workflow)

The restricted learner runtime role receives only the table privileges needed by the learner service. It receives no access to `neon_auth.user`, organisation membership administration, migration metadata or privileged platform tables.

The existing application-level `requireLearnerManager` check remains. The RLS policy independently checks the same actor against current, active direct organisation membership and platform-administrator status.

## Identity and policy contract

1. The Route Handler / Server Component obtains a JWT through Neon Auth server `auth.token()`; the opaque session cookie token is not a JWT.
2. The server verifies the JWT signature using `NEON_AUTH_JWKS_URL` and validates issuer, expiry and UUID `sub`.
3. The verified payload is installed as transaction-local `request.jwt.claims` using parameterised `set_config(..., true)`.
4. All learner queries in that transaction run as `sentinel_learner_runtime`, a LOGIN role with `NO BYPASSRLS`, no superuser/role-creation/database-creation privileges, and no broad table grants.
5. A narrowly scoped `SECURITY DEFINER` helper with a fixed `search_path` checks `auth.uid()`, organisation active status, effective membership dates and allowed roles. It allows platform administrators or direct `organisation_admin` / `school_admin` members.
6. No client-supplied organisation ID or JWT claim is trusted without server verification. The database policy also checks the row's `tenant_organisation_id`.
7. The application runtime uses `DATABASE_AUTHENTICATED_URL`; `DATABASE_URL` remains the privileged migration/admin connection and is not imported by the learner service.

The extension's PostgREST-compatible claims mode does not itself verify a signature. The application must verify the Neon JWT before setting claims, and the restricted DB role must never be exposed to clients. SQL injection and arbitrary SQL execution remain critical threats; the extension's JWK-validation mode is a future hardening option if it can be configured safely with this serverless driver.

## Policy matrix

| Resource | Runtime permissions | RLS rule |
|---|---|---|
| people | SELECT, INSERT, UPDATE | Tenant organisation is manageable by current actor |
| learner_profiles | SELECT, INSERT, UPDATE | Tenant organisation is manageable by current actor |
| classes | SELECT, INSERT, UPDATE | Tenant organisation is manageable by current actor |
| learner_enrolments | SELECT, INSERT, UPDATE | Tenant organisation is manageable by current actor |
| guardian_relationships | SELECT, INSERT, UPDATE | Tenant organisation is manageable by current actor |
| learner_progression_events | SELECT, INSERT | Tenant organisation is manageable by current actor |
| audit_events | INSERT only | Actor equals verified `auth.uid()`; organisation is manageable |
| all other public tables | No learner-role grants | Not accessible through this role |

DELETE is intentionally not granted. Learner identity and progression history must be corrected or superseded through auditable workflows, not hard-deleted.

RLS is enabled and forced on the protected tables. Policies fail closed if no valid UUID subject or eligible organisation membership exists.

## Non-goals and gates

- This does not approve a shared legal tenant/controller model. The ADR-001 governance gates remain open.
- No parent-authority, county, sub-county, zone or cluster inheritance is inferred. Only direct organisation membership is supported in this increment.
- No production branch, production secret, production schema or live learner data is changed.
- No guardian self-service access, teacher assignment access or assessor access is introduced.
- Organisation and membership administration, curriculum reference data and Neon Auth's own schema are not moved to this restricted role in this increment.
- No learner data is imported. Synthetic integration fixtures only.
- The development RLS prototype must pass cross-organisation read/write denial tests before it is considered ready for preview use.

## Operational configuration

- Provision `sentinel_learner_runtime` on the development branch only, with least-privilege grants.
- Store its direct connection URI as a sensitive Vercel Preview variable scoped to the Sentinel branch only. Do not add it to Production or expose it in logs, GitHub or Notion.
- Add `DATABASE_AUTHENTICATED_URL` to `.env.example` as an empty placeholder.
- Use the direct/unpooled URI initially because transaction-local session state is required; evaluate pooling only after transaction-isolation tests.
- Keep the database pool lazy and server-only. No DB connection should be created during static build.

## Acceptance criteria

- No learner service query uses the privileged owner connection.
- Missing JWT, invalid signature, expired token, malformed subject or missing authenticated DB URL fails closed.
- A user with active school/organisation-admin membership can read and create records only in that organisation.
- A user from another organisation cannot read, insert or update the first user's learner records, even when it knows record UUIDs.
- Inactive organisation, revoked/expired membership, teacher/viewer role and missing subject are denied.
- A platform administrator retains the existing global learner-management capability.
- Learner admission and its audit event remain atomic.
- RLS is enabled and forced on all seven protected tables; runtime role has no BYPASSRLS and no DELETE privileges.
- Existing tests, migration checks, lint, typecheck and production build pass.
- Only the Neon development branch and Sentinel Preview configuration are touched; Production remains unchanged.