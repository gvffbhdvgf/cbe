# ADR-002 — Learner Record RLS and Identity Context

**Status:** Accepted for the development implementation; subject to security review before a live learner pilot.  
**Date:** 25 November 2026

## Context

The first learner register used the privileged application database connection. Application-level organisation checks and tenant-aware foreign keys were present, but they did not make PostgreSQL itself enforce tenant isolation. The development database also contained manually applied RLS objects that were not represented in the Git migration journal.

Neon Auth's server-side `getSession()` provides the authenticated session identity, but the session cookie token is not the JWT required for database RLS. The server-side Neon Auth JWT endpoint (`auth.token()`) provides a signed JWT; the server must verify it against the branch's public JWKS.

## Decision

1. Version the RLS policy and privilege state in migration 0008.
2. Use a non-login, non-bypass group role `sentinel_learner_runtime` as the target of RLS policies.
3. Provision an environment-specific login role that inherits the group role. The development login is `sentinel_learner_login`.
4. Grant only SELECT/INSERT on the specific tables required by the learner register. Do not grant UPDATE or DELETE until corresponding workflows and approval rules are designed.
5. Obtain the server-side Neon Auth JWT, verify signature, issuer and expiry against the configured JWKS, and require the JWT `sub` to match the authenticated session user ID.
6. Use a dedicated Neon Pool/Drizzle transaction for each learner operation. Set `request.jwt.claims` with transaction-local `set_config(..., true)`, then verify the database identity with `sentinel_private.current_user_id()` before executing learner queries.
7. Use the restricted connection for all learner-record reads/writes. Keep the privileged `DATABASE_URL` for organisation/membership preflight and administrative operations only.
8. Keep guardian relationship rows inaccessible until verified guardian workflows are implemented.

## Security properties

- The restricted login cannot bypass RLS and cannot write or delete arbitrary learner records.
- Policies check active platform-administrator or active organisation/school-administrator authority and compare tenant scope on each protected row.
- Identity claims are transaction-local and cannot leak to the next pooled request.
- A missing, invalid, expired, mismatched or absent identity fails closed.
- Admission, progression and audit records are committed atomically in the same database transaction.

## Important limitation

The current `pg_session_jwt` fallback mode reads PostgREST-compatible `request.jwt.claims`; it does not independently verify the token signature. The application-side JWKS verification is therefore part of the security boundary. The restricted role must never be exposed to untrusted SQL or arbitrary query execution. A later hardening review should evaluate Neon-supported database-side JWT verification/session initialization and whether a supported Data API path offers stronger claim integrity.

## Consequences and follow-up

- RLS policy changes require a new numbered migration; never edit migration 0008 after it is applied.
- Positive and negative cross-tenant integration tests with synthetic institutional accounts are required before any live pilot.
- Vercel must be connected to the intended Git repository before adding `DATABASE_AUTHENTICATED_URL` as a branch-scoped Preview secret. Do not widen the secret to all Preview/Production environments as a workaround.
- UPDATE, DELETE, guardian access, class assignment and transfer policies remain intentionally absent until the related domain workflows are validated.
