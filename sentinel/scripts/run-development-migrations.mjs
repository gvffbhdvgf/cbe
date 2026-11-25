import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { neon } from '@neondatabase/serverless';

const expectedHost = 'ep-quiet-sunset-bhbswp0h';
const environment = process.env.SENTINEL_ENVIRONMENT;
const connectionString = process.env.DATABASE_URL;
if (environment !== 'development') { console.error('Refusing to migrate: set SENTINEL_ENVIRONMENT=development explicitly.'); process.exit(1); }
if (!connectionString) { console.error('Refusing to migrate: DATABASE_URL is missing.'); process.exit(1); }
let hostname;
try { hostname = new URL(connectionString).hostname; } catch { console.error('Refusing to migrate: DATABASE_URL is not a valid URL.'); process.exit(1); }
if (!hostname.startsWith(expectedHost + '.')) { console.error('Refusing to migrate: DATABASE_URL does not target the approved sentinel-development Neon endpoint.'); process.exit(1); }

const folder = resolve('src/infrastructure/database/migrations');
const journal = JSON.parse(await readFile(join(folder, 'meta/_journal.json'), 'utf8'));
const sql = neon(connectionString);
await sql`CREATE TABLE IF NOT EXISTS public.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)`;
await sql`CREATE UNIQUE INDEX IF NOT EXISTS __drizzle_migrations_created_at_unique ON public.__drizzle_migrations (created_at)`;
const files = new Set(await readdir(folder));
for (const entry of [...journal.entries].sort((a, b) => a.idx - b.idx)) {
  if (!files.has(`${entry.tag}.sql`)) throw new Error(`Missing migration file: ${entry.tag}.sql`);
  const source = await readFile(join(folder, `${entry.tag}.sql`), 'utf8');
  const hash = createHash('sha256').update(source).digest('hex');
  const [applied] = await sql`SELECT hash FROM public.__drizzle_migrations WHERE created_at = ${entry.when} LIMIT 1`;
  if (applied) { if (applied.hash !== hash) throw new Error(`Applied migration ${entry.tag} has changed; create a new migration instead.`); console.log(`Already applied: ${entry.tag}`); continue; }
  const statements = source.split('--> statement-breakpoint').map((statement) => statement.trim()).filter(Boolean);
  const migrationQueries = statements.map((statement) => sql.query(statement));
  migrationQueries.push(sql`INSERT INTO public.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${entry.when})`);
  await sql.transaction(migrationQueries);
  console.log(`Applied: ${entry.tag}`);
}
