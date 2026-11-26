import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0033_teacher_weekly_workload.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);

describe('weekly teacher workload migration', () => {
  it('registers migration 0033 in sequence', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries[33]).toMatchObject({ idx: 33, tag: '0033_teacher_weekly_workload' });
  });
  it('stores effective-dated workload allocations and versioned institution policy', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('teacher_weekly_workload_allocations');
    expect(sql).toContain('teacher_workload_policies');
    expect(sql).toContain('weekly_periods BETWEEN 1 AND 60');
    expect(sql).toContain('reference_weekly_periods');
    expect(sql).toContain('maximum_weekly_periods');
    expect(sql).toContain('UNIQUE (tenant_organisation_id, organisation_id, academic_year, effective_from)');
  });
  it('uses forced RLS and narrow audited SECURITY DEFINER operations', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('CREATE FUNCTION sentinel_private.set_teacher_weekly_workload_allocation');
    expect(sql).toContain('CREATE FUNCTION sentinel_private.set_teacher_workload_policy');
    expect(sql).toContain('REVOKE ALL ON FUNCTION');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION sentinel_private.set_teacher_workload_policy');
    expect(sql).not.toMatch(/GRANT\s+[^;]*\b(INSERT|UPDATE|DELETE|TRUNCATE)\b[^;]*TO\s+sentinel_learner_runtime/i);
    expect(sql).toContain("'teacher.weekly_workload_allocated'");
    expect(sql).toContain("'teacher.workload_policy_created'");
  });
  it('keeps policy local and avoids asserting a statutory maximum', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).not.toMatch(/statutory|national maximum|default.*period/i);
    expect(sql).toContain('p_maximum_periods NOT BETWEEN p_reference_periods AND 60');
  });
});
