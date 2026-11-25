# Sentinel — Security & Environment Operations

## Secret-handling rules
- Never commit `.env`, `.env.local`, private keys, tokens, passwords or provider credentials.
- Commit only `.env.example` with variable names and non-secret placeholders.
- Keep local secrets in ignored files and use a password manager or OS secret store where practical.
- Store cloud credentials as encrypted/sensitive environment variables in the relevant provider.
- Use separate credentials for development, Preview and Production.
- Rotate credentials after suspected exposure and document the rotation.
- Do not paste secret values into Notion, GitHub issues, logs or chat.
- A plugin connection is an OAuth/authorised integration; do not attempt to extract its private credentials.

## Environment contract

| Variable | Purpose | Required |
|---|---|---|
| `DATABASE_URL` | Existing privileged server-side connection for organisation/membership and administrative operations; not for learner record queries | Yes |
| `DATABASE_AUTHENTICATED_URL` | Restricted login inheriting `sentinel_learner_runtime`; used for RLS-enforced learner record operations | Yes for learner APIs |
| `DATABASE_URL_UNPOOLED` | Optional direct connection for controlled migration operations where required | Conditional |
| `NEON_AUTH_BASE_URL` | Neon Managed Auth server URL and expected JWT issuer origin | Yes |
| `NEON_AUTH_JWKS_URL` | Neon Auth public JWKS endpoint used to verify access tokens | Yes for learner APIs |
| `NEON_AUTH_COOKIE_SECRET` | Neon Auth server session-cookie signing secret (minimum 32 characters) | Yes |
| `NEXT_PUBLIC_APP_URL` | Canonical application URL | Yes |
| `RESEND_API_KEY`, `SENDERKIT_API_KEY`, `EMAIL_FROM` | Transactional communications, only after provider selection | Conditional |
| `CLOUDFLARE_ACCOUNT_ID`, scoped R2 credentials and bucket name | Cloudflare integration and private object storage | Conditional |

Do not configure both email providers by default. Choose one after defining notification requirements and delivery ownership.

## Learner data isolation

- Migrations 0008–0010 enable and force RLS on `people`, `learner_profiles`, `classes`, `learner_enrolments`, `guardian_relationships`, `learner_progression_events` and `audit_events`.
- `sentinel_learner_runtime` is a NOLOGIN, NOBYPASSRLS group role. Environment-specific login roles inherit it.
- The development login `sentinel_learner_login` has explicit SELECT/INSERT privileges only on approved learner/audit tables and class groups. It has no general UPDATE or DELETE privileges. Class INSERT is restricted by a tenant- and administrator-scoped RLS policy. Initial learner placement is exposed only through EXECUTE on `sentinel_private.assign_learner_to_class`; the SECURITY DEFINER function validates actor authority, active enrolment, tenant, grade, academic year, class status and effective date before updating `class_id` and writing progression/audit events.
- Learner operations must use `DATABASE_AUTHENTICATED_URL`; do not route them through the privileged `DATABASE_URL`.
- The server obtains a Neon Auth access JWT, verifies it against the configured JWKS and issuer, checks the subject against the authenticated session, then sets claims transaction-locally inside the same database transaction.
- The transaction checks `sentinel_private.current_user_id()` before executing learner work. Any mismatch aborts the transaction.
- PostgreSQL's `pg_session_jwt` fallback `request.jwt.claims` mode does not validate JWT signatures itself. Application-side signature verification is mandatory. Do not expose the restricted connection to untrusted SQL or permit arbitrary SQL execution.
- Organisation/membership preflight remains on the privileged connection. Keep it narrow and do not add learner-table reads or writes to that path.

## Vercel deployment guardrails
1. Inspect the connected project's Git settings before changes.
2. Disable production deployment from arbitrary branches.
3. Do not trigger a deployment for each commit.
4. Prefer manual production promotion or a dedicated release branch.
5. Keep Preview deployment policy explicit and cost-aware.
6. Confirm branch-scoped environment-variable behaviour before adding restricted credentials.
7. Never add secrets until project identity and environment targets are confirmed.

Current configuration blocker: the `sentinel-platform` Vercel project is not connected to a Git repository. Branch-scoped Preview configuration for `DATABASE_AUTHENTICATED_URL` was rejected. Do not broaden this credential to every Preview or Production as a workaround.

## Access control
- Least privilege for users, services and plugins.
- Separate platform, organisation, school, teacher and read-only capabilities.
- Apply organisational scope to server-side reads, writes, exports and background jobs.
- Audit sensitive reads where appropriate, as well as writes and exports.
- Limit bulk export permissions.

## Data protection
Sentinel may process children's personal information. Before production, complete a documented privacy and safeguarding review covering lawful purpose, minimisation, notices, consent/guardian processes where applicable, retention, data subject requests, processors, breach response and controlled sharing.

## Operational checklist
- [ ] Development and Production databases are separate.
- [ ] Environment files are excluded from Git.
- [ ] Secrets are encrypted at rest in cloud providers.
- [ ] Restricted learner runtime connection is scoped to the intended Preview environment.
- [ ] Backups are configured and restoration tested.
- [ ] Audit events are retained and access-controlled.
- [ ] Production deploy requires explicit approval.
- [ ] Logs redact tokens, passwords and learner personal data.
- [ ] Incident and credential-rotation runbooks exist.
