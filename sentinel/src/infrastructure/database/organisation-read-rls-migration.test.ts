import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0030_platform_admin_organisation_read_rls.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);
const servicePath = new URL('../../application/organisation/transfer-registry-service.ts', import.meta.url);

describe('platform-administrator organisation read policy migration', () => {
  it('registers migration 0030 after the transfer eligibility registry', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries[30]).toMatchObject({ idx: 30, tag: '0030_platform_admin_organisation_read_rls' });
  });

  it('enables RLS and grants the restricted runtime role read access only for platform administrators', async () => {
    const migration = await readFile(migrationPath, 'utf8');
    expect(migration).toContain('ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY');
    expect(migration).not.toContain('FORCE ROW LEVEL SECURITY');
    expect(migration).toContain('CREATE POLICY organisations_platform_admin_select');
    expect(migration).toContain('FOR SELECT TO sentinel_learner_runtime');
    expect(migration).toContain('USING (sentinel_private.is_platform_administrator())');
    expect(migration).toContain('GRANT SELECT ON TABLE public.organisations TO sentinel_learner_runtime');
  });

  it('does not grant direct organisation writes to the learner runtime role', async () => {
    const migration = await readFile(migrationPath, 'utf8');
    expect(migration).not.toMatch(/GRANT\\s+[^;]*\\b(INSERT|UPDATE|DELETE|TRUNCATE)\\b[^;]*TO\\s+sentinel_learner_runtime/i);
  });

  it('keeps the transfer registry query in the authenticated RLS transaction after the platform-admin preflight', async () => {
    const source = await readFile(servicePath, 'utf8');
    expect(source).toContain('await assertPlatformAdministrator(actorUserId)');
    expect(source).toContain('withAuthenticatedLearnerDb(actorUserId');
    expect(source).toContain('.innerJoin(organisations, eq(organisations.id, organisationTransferEligibility.organisationId))');
  });
});
