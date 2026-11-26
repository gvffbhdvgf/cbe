import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0031_governed_learner_record_corrections.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);
const schemaPath = new URL('./schema/learner.ts', import.meta.url);

describe('governed learner record correction migration', () => {
  it('registers migration 0031 after platform administrator organisation-read hardening', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries.some(entry => entry.idx === 30 && entry.tag === '0030_platform_admin_organisation_read_rls')).toBe(true);
    expect(journal.entries.some(entry => entry.idx === 31 && entry.tag === '0031_governed_learner_record_corrections')).toBe(true);
  });

  it('stores proposed changes separately from immutable correction history', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    const schema = await readFile(schemaPath, 'utf8');
    expect(sql).toContain('CREATE TABLE public.learner_record_correction_requests');
    expect(sql).toContain('CREATE TABLE public.learner_record_correction_history');
    expect(sql).toContain('original_values jsonb NOT NULL');
    expect(sql).toContain('proposed_values jsonb NOT NULL');
    expect(sql).toContain('previous_values jsonb NOT NULL');
    expect(sql).toContain('corrected_values jsonb NOT NULL');
    expect(sql).toContain('learner_record_correction_history_append_only');
    expect(schema).toContain('learnerRecordCorrectionRequests');
    expect(schema).toContain('learnerRecordCorrectionHistory');
  });

  it('requires an independent reviewer and detects stale original values before applying', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('learner.record_correction_requested');
    expect(sql).toContain('learner.record_correction_applied');
    expect(sql).toContain('learner.record_correction_rejected');
    expect(sql).toContain('learner.record_correction_conflicted');
    expect(sql).toContain('v_request.requested_by = v_actor_id');
    expect(sql).toContain('v_request.original_values');
    expect(sql).toContain("v_request.status <> 'pending'");
    expect(sql).toContain('FOR UPDATE');
  });

  it('restricts correction data to authorised learner managers and prevents direct runtime writes', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('sentinel_private.can_manage_learner_records(organisation_id)');
    expect(sql).toContain('GRANT SELECT ON TABLE public.learner_record_correction_requests TO sentinel_learner_runtime');
    expect(sql).toContain('GRANT SELECT ON TABLE public.learner_record_correction_history TO sentinel_learner_runtime');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION sentinel_private.create_learner_record_correction_request');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION sentinel_private.review_learner_record_correction');
    const auditStatements = [...sql.matchAll(/INSERT INTO public\.audit_events[\s\S]*?;/g)].map(match => match[0]);
    expect(auditStatements.length).toBeGreaterThan(0);
    for (const statement of auditStatements) expect(statement).not.toMatch(/'firstName'|'lastName'|'dateOfBirth'/);
  });

  it('keeps audit metadata free of learner identity values', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain("'changedFields'");
    expect(sql).toContain("'correctionRequestId'");
    expect(sql).not.toMatch(/jsonb_build_object\([^;]*(?:'firstName'|'lastName'|'dateOfBirth')/s);
  });
});
