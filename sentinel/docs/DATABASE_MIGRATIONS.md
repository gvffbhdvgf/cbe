# Database Migration Operations

Sentinel uses Drizzle ORM for typed application queries and SQL migration files under `src/infrastructure/database/migrations`. The migration runner uses the existing Neon serverless driver; it deliberately avoids adding a second ORM or a migration CLI dependency.

## Safety boundary

`npm run db:migrate` refuses to run unless `SENTINEL_ENVIRONMENT=development` is explicitly set and `DATABASE_URL` resolves to the approved `sentinel-development` Neon endpoint (`ep-quiet-sunset-bhbswp0h`). This guard is intentionally strict. Changing the approved endpoint requires a reviewed code change. Production migrations are not automated by this runner.

## Validate and apply

1. Add a numbered SQL migration and a matching entry in `src/infrastructure/database/migrations/meta/_journal.json`.
2. Use `--> statement-breakpoint` to separate statements. Keep migration SQL safe to retry; where possible use `IF NOT EXISTS` and explicit constraints.
3. Run `npm run db:check` to ensure every migration is registered and present.
4. Apply only to the approved development endpoint: `SENTINEL_ENVIRONMENT=development npm run db:migrate`.
5. Verify the resulting schema and record the outcome in the project status.

The runner stores SHA-256 hashes and journal timestamps in `public.__drizzle_migrations`. It refuses to silently apply a changed file whose timestamp is already recorded; create a new migration instead. Each migration’s statements and its history record are applied in one Neon HTTP transaction, so a failed migration is rolled back as a unit. Keep migrations idempotent where practical and test every migration against an isolated branch before any release.

## Existing baseline

The initial organisation, membership, curriculum, document-staging and learner-record schemas were applied to the isolated development branch and reconciled with their SQL files. Migrations 0008–0009 are now versioned and recorded in `public.__drizzle_migrations`. Migration 0008 installs the `pg_session_jwt` extension dependency, security-definer identity/authority helpers, explicit least-privilege grants and RLS policies for learner/person/enrolment/class/progression/guardian/audit tables. Migration 0009 adds the guarded class INSERT privilege and policy; class UPDATE/DELETE remain denied. The restricted login role is provisioned separately per environment and inherits the non-login `sentinel_learner_runtime` group role.

The runner's SHA-256 hash and journal timestamp are authoritative. Do not edit migration 0008 after application; add a new migration for subsequent policy changes.

## Prohibited

- Never run this development runner against Production or the Neon main branch.
- Never edit an already-applied migration; add a new migration.
- Never put connection strings or secrets in migration files, docs or source control.
- Never import live learner or guardian data into development.
