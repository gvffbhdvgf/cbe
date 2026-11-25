# Sentinel Implementation Foundation

**Checkpoint:** 26 November 2026
**Status:** Initial application foundation, source-linked curriculum structure browser and protected Vercel preview provisioned. Not production-ready.

## Product engineering direction

Sentinel is being implemented as a domain-driven modular monolith. The initial code boundaries separate domain invariants, application use cases, infrastructure adapters and presentation. Business capabilities remain the organising principle; technical folders are not the domain model.

The first implemented domain is Organisation. It has a domain factory with name and issuer-namespaced identifier invariants, an application validation entry point, a Drizzle schema and a development-only SQL migration. A scoped authorisation policy checks subject, capability, resource, scope and assignment expiry. The subject check was added after a failing negative test exposed an omission.

The first UX surface includes a public product introduction, managed sign-in, a protected workspace shell and an intentionally empty organisation directory. No synthetic school names are presented as real institutions. No learner data has been loaded.

## Cloud resources and observed configuration

| Capability | Resource | Actual state |
|---|---|---|
| Source control | GitHub `gvffbhdvgf/cbe`, branch `sentinel/bootstrap` | Existing project branch; app source now lives under `sentinel/` |
| Deployment | Vercel `sentinel-platform` | Next.js project; root directory `sentinel`; SSO protection enabled. Preview deployment for `sentinel/bootstrap` is READY; production has not been promoted. |
| Relational data | Neon `sentinel-platform` | PostgreSQL 17, Frankfurt (`aws-eu-central-1`), Free plan, 1 GB branch logical-size limit, compute 0.25–1 CU, six-hour history limit |
| Database environments | Neon `main` and `sentinel-development` | Main branch reserved; organisation table applied only to development branch |
| Identity | Neon Managed Auth / Better Auth | Enabled on main branch; email/password sign-in enabled, email verification configured, self-service sign-up disabled |
| Object storage | Neon Object Storage | Three private buckets: `sentinel-quarantine`, `sentinel-private`, `sentinel-exports` |
| Development sandbox | Upstash Box `sentinel-cloud-dev` | Small, Node runtime, browser enabled, 10 GB workspace, ephemeral with three-day maximum TTL; repository cloned |
| Email delivery | Resend account | No sending domain is registered; production email delivery is not configured |
| Edge/object storage alternative | Cloudflare | Account connected; R2 API returned error 10042 asking for R2 activation in the Cloudflare Dashboard; no R2 buckets created |

No credentials are recorded in this document. Environment values are held in the managed Vercel project settings. Never copy them into GitHub, Notion, logs or screenshots.

## Database and data governance boundary

The development branch contains `public.organisations` with an opaque UUID, name, status, optional issuer/value pair, timestamps and a unique index over the issuer/value pair. This is a provisional first domain table, not a complete production tenancy model. It has not been applied to the main branch.

The current database project is on Neon Free. The available account disallows custom compute suspension intervals and caps branch history at six hours. These are account limits, not selected production targets. Production resilience, retention, backup and recovery objectives remain to be established.

Before live data or production schema activation, Sentinel must resolve controller/processor roles, tenant boundaries, authority scope, organisation relationships, source identifiers, data residency and retention, RLS policy design and the required DPIA/data-sharing approvals. Do not import children's personal data until those gates are met.

## Security and identity

- Neon Auth is configured with self-service registration disabled.
- Privileged and institutional accounts must be provisioned through a governed process.
- The app proxy protects `/workspace` and `/workspace/organisations`; the health endpoint is public and returns only service status.
- Application authorization has a default-deny policy evaluator. It is not yet connected to persisted role assignments or resource data; do not mistake the unit-tested policy for a completed production authorization system.
- The Vercel project has encrypted database/auth environment variables. Do not print, export or commit them.
- Object storage buckets are private; public reads are not enabled.

## Verification performed

- `npm run lint` — passed.
- `npm run typecheck` — passed.
- `npm test` — passed, 9 tests across domain and authorization policy.
- `npm run build` — passed with dynamic authenticated workspace routes.
- Curriculum browser increment: `npm run lint`, `npm run typecheck`, `npm test` (56 tests across 11 files), and production build passed. Assessment domain-contract increment: lint and typecheck passed; 69 tests across 12 files passed, including 13 new assessment contract tests. A fresh production build passed using ephemeral local-only auth/database placeholders; no deployment secrets were changed.
- Vercel preview deployment `dpl_HwztYhBCAFGkidfH3hShFeV92wBo` — READY for commit `a4e6f6c4faf321f6b9f282bd6a3ea1a08ec4a937`; unauthenticated preview root and `/api/health` redirect to Vercel SSO, so no public health payload is exposed.
- `npm audit` — 0 vulnerabilities after removing unused tooling that introduced moderate development-dependency advisories.
- Cloud sandbox browser — public landing page and sign-in page loaded; unauthenticated `/workspace` redirected to `/auth/sign-in`; `/api/health` returned `{"status":"ok","service":"sentinel-platform"}`.

The sign-in success path, password reset, session persistence and invitation provisioning remain unverified because no institutional test account or verified email sender has been provisioned.

## Known blockers and decisions

1. **Email:** Resend has no verified sending domain. Neon Auth sign-up remains disabled, and no invitation or verification emails are being sent. Provide a domain that Sentinel is authorised to use before configuring DNS records and production email.
2. **Cloudflare R2:** R2 must be activated in the Cloudflare Dashboard before API provisioning can continue. Neon private buckets are available in the meantime.
3. **Persistent sandbox:** the current Upstash Box is ephemeral and expires within three days. A keep-alive box requires a paid plan and explicit cost approval.
4. **Production environment:** no custom domain, production data, production schema migration, or production deployment exists.
5. **Identity and authorisation:** the app's initial access policy is not yet connected to an institutional role-assignment store, data-controller boundary or row-level security policies.
6. **Repository automation:** GitHub CI configuration is included, but a successful hosted GitHub Actions run has not yet been observed. Vercel automatic deployments remain disabled by design.

## Assessment lifecycle — current increment

The first pure TypeScript assessment contracts are implemented under `src/domain/assessment/`. They cover event lifecycle preconditions, moderation gates, attempt state transitions, immutable approved attempts, tenant/organisation/grade/year enrolment matching, task maximums, awarded-score bounds, non-overlapping performance bands and instrument-version immutability after attempts exist. Thirteen focused tests pass. No assessment database tables or migrations have been applied yet.

A read-only inspection of the isolated Neon development branch confirmed that learner enrolments and audit events have forced RLS, while curriculum document/node tables and organisation memberships currently do not. The existing runtime group role is `sentinel_learner_runtime`; its existing manager predicate is intentionally limited to organisation/school administrators. Assessment access therefore needs a separate capability-aware database policy and role/grant design rather than reusing learner-record manager authority. Existing membership roles include organisation administrator, school administrator, teacher, assessor and viewer.

## Next engineering increments

1. Add CI verification and establish a reviewed PR workflow.
2. Complete authentication e2e with a provisioned test account and a verified sender.
3. Validate controller/tenant boundaries and build the production-grade organisation/authority relationship model.
4. Implement role-assignment persistence, scoped authorisation integration and cross-scope negative tests.
5. Implement the first end-to-end organisation import/reconciliation journey with staged, idempotent, auditable processing.
6. Continue into learner identity and enrolment, workforce, versioned KICD curriculum, assessment lifecycle, interventions and denominator-aware analytics as separate vertical slices.
