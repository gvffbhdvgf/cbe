import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0032_academic_year_rollover_batches.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);

describe('academic-year rollover migration', () => {
  it('registers migration 0032 in sequence', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries[32]).toMatchObject({ idx: 32, tag: '0032_academic_year_rollover_batches' });
  });

  it('snapshots a complete organisation/year cohort and requires explicit dispositions', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE TABLE public.academic_year_rollover_batches');
    expect(sql).toContain('CREATE TABLE public.academic_year_rollover_items');
    expect(sql).toContain("WHERE status = 'draft'");
    expect(sql).toContain('CREATE FUNCTION sentinel_private.cancel_academic_year_rollover');
    expect(sql).toContain("'learner.academic_year_rollover_cancelled'");
    expect(sql).toContain("outcome IN ('unresolved','promote','repeat','not_progressing')");
    expect(sql).toContain('v_current_count <> v_snapshot_count');
    expect(sql).toContain('A count alone cannot prove cohort identity');
    expect(sql).toContain('NOT EXISTS (');
    expect(sql).toContain('item.source_enrolment_id = enrolment.id');
    expect(sql).toContain("item.status = 'unresolved'");
    expect(sql).toContain("request.status IN ('pending','approved')");
    expect(sql).toContain('Resolve existing pending or approved progression requests');
  });

  it('reuses independently reviewed progression requests rather than bulk-changing enrolments', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('sentinel_private.request_learner_progression(');
    expect(sql).toContain('progression_request_id = v_request_id');
    expect(sql).not.toMatch(/UPDATE\s+public\.learner_enrolments/i);
    expect(sql).toContain("'learner.academic_year_rollover_submitted'");
    expect(sql).not.toMatch(/'reason',\\s*btrim\\(p_reason\\)/i);
  });

  it('restricts direct runtime writes and scopes read access through RLS', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('ALTER TABLE public.academic_year_rollover_batches FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE public.academic_year_rollover_items FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('GRANT SELECT ON TABLE public.academic_year_rollover_batches, public.academic_year_rollover_items TO sentinel_learner_runtime');
    expect(sql).not.toMatch(/GRANT\s+[^;]*\b(INSERT|UPDATE|DELETE|TRUNCATE)\b[^;]*TO\s+sentinel_learner_runtime/i);
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION sentinel_private.submit_academic_year_rollover(uuid) TO sentinel_learner_runtime');
  });

  it('prevents promotion beyond the configured Grades 1–9 model', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('Grade 9 cannot be promoted beyond the current Grades 1–9 learner model');
  });
});
