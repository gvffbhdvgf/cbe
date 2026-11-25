import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0008_learner_record_rls.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);
const protectedTables = ['people','learner_profiles','classes','learner_enrolments','guardian_relationships','learner_progression_events','audit_events'];

describe('learner RLS migration contract', () => {
  it('is present in the migration journal', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries).toHaveLength(10);
    expect(journal.entries.at(-2)).toMatchObject({ idx: 8, tag: '0008_learner_record_rls' });
    expect(journal.entries.at(-1)).toMatchObject({ idx: 9, tag: '0009_class_creation_rls' });
  });
  it('requires a non-login, non-bypass runtime role and installs the JWT extension', async () => {
    const migration = await readFile(migrationPath, 'utf8');
    expect(migration).toContain('CREATE EXTENSION IF NOT EXISTS pg_session_jwt');
    expect(migration).toContain('rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION sentinel_private.can_manage_learner_records');
    expect(migration).toContain('SECURITY DEFINER');
    expect(migration).toContain('SET search_path = pg_catalog, pg_temp');
  });
  it('enables and forces RLS for every learner and audit table', async () => {
    const migration = await readFile(migrationPath, 'utf8');
    for (const table of protectedTables) {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migration).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`);
    }
  });
  it('permits class creation only through a tenant-scoped insert policy', async () => {
    const migration = await readFile(new URL('./migrations/0009_class_creation_rls.sql', import.meta.url), 'utf8');
    expect(migration).toContain('GRANT INSERT ON TABLE public.classes TO sentinel_learner_runtime');
    expect(migration).toContain('created_by = sentinel_private.current_user_id()');
    expect(migration).toContain('sentinel_private.can_manage_learner_records(tenant_organisation_id)');
    expect(migration).not.toMatch(/GRANT\\s+[^;]*\\bUPDATE\\b[^;]*TO\\s+sentinel_learner_runtime/i);
  });

  it('does not grant DELETE or broad access to the learner runtime role', async () => {
    const migration = await readFile(migrationPath, 'utf8');
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM sentinel_learner_runtime');
    expect(migration).not.toMatch(/GRANT\s+[^;]*\bDELETE\b[^;]*TO\s+sentinel_learner_runtime/i);
    expect(migration).toContain('CREATE POLICY audit_events_learner_insert');
  });
});
