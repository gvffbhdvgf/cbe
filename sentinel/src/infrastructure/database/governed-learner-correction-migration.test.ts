import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0031_governed_learner_record_corrections.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);

describe('governed learner record correction migration', () => {
  it('registers migration 0031 in sequence', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries[31]).toMatchObject({ idx: 31, tag: '0031_governed_learner_record_corrections' });
  });

  it('limits correction requests to approved identity fields and stores review state', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain("'legal_first_name','legal_middle_name','legal_last_name','preferred_name','date_of_birth'");
    expect(sql).toContain("status IN ('pending','approved','rejected')");
    expect(sql).toContain('original_value');
    expect(sql).toContain('proposed_value');
  });

  it('requires an independent reviewer and prevents stale-value approval', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('v_request.requested_by = v_actor_id');
    expect(sql).toContain('v_current_value IS DISTINCT FROM v_request.original_value');
    expect(sql).toContain('The requester cannot review their own correction request');
  });

  it('keeps direct writes unavailable and appends audit events without learner PII', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('GRANT SELECT ON TABLE public.learner_record_correction_requests TO sentinel_learner_runtime');
    expect(sql).not.toMatch(/GRANT\s+[^;]*\b(INSERT|UPDATE|DELETE|TRUNCATE)\b[^;]*TO\s+sentinel_learner_runtime/i);
    expect(sql).toContain("'learner.record_correction_requested'");
    expect(sql).toContain("'learner.record_correction_approved'");
    expect(sql).toContain("'learner.record_correction_rejected'");
    expect(sql).not.toMatch(/jsonb_build_object\([^)]*(original_value|proposed_value)/i);
  });

  it('applies the approved change only inside the independent review function', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE FUNCTION sentinel_private.review_learner_record_correction');
    expect(sql).toContain("IF p_decision = 'approved' THEN");
    expect(sql).not.toMatch(/UPDATE\s+public\.people/i);
    expect(sql).toContain('UPDATE public.people SET');
  });
});
