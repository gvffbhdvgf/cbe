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

The initial organisation schema and organisation-access schema were applied to the isolated development branch before migration automation was established. Their current schema was inspected and reconciled with the SQL files. The corresponding hashes for `0000_lovely_lilandra`, `0001_organisation_access`, `0002_membership_active_uniqueness`, `0003_curriculum_catalogue_schema`, `0004_seed_curriculum_catalogue`, and `0005_pathway_source_provenance` are recorded in the migration metadata table, so the runner recognises all three as applied.

## Prohibited

- Never run this development runner against Production or the Neon main branch.
- Never edit an already-applied migration; add a new migration.
- Never put connection strings or secrets in migration files, docs or source control.
- Never import live learner or guardian data into development.
