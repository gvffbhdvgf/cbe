import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0023_learner_lifecycle_transitions.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);

describe('learner lifecycle transition migration', () => {
  it('registers migration 0023 after teacher allocation and scoped assessment', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries).toHaveLength(26);
    expect(journal.entries[23]).toMatchObject({ idx: 23, tag: '0023_learner_lifecycle_transitions' });
  });

  it('adds bounded class capacity and serialises capacity checks with placement writes', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('ALTER TABLE public.classes ADD COLUMN capacity integer');
    expect(sql).toContain('classes_capacity_check CHECK (capacity IS NULL OR capacity BETWEEN 1 AND 500)');
    expect(sql).toContain('assert_class_capacity_available');
    expect(sql).toContain('FROM public.learner_class_placements placement');
    expect(sql).toContain('placement.starts_at<=v_event.starts_at');
    expect(sql).toContain('COALESCE(v_event.class_id,enrolment.class_id)');
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('set_class_capacity');
    expect(sql).toContain('Capacity cannot be lower than current occupancy');
    expect(sql).toContain('class.capacity_changed');
  });

  it('retains timestamped class placement history and audits reassignment', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE TABLE public.learner_class_placements');
    expect(sql).toContain('starts_at timestamptz NOT NULL');
    expect(sql).toContain('ends_at timestamptz');
    expect(sql).toContain('learner_class_placements_one_active_idx');
    expect(sql).toContain('reassign_learner_to_class');
    expect(sql).toContain('learner.class_reassigned');
    expect(sql).toContain('reason text CHECK');
    expect(sql).toContain('reasonRecorded');
    expect(sql).not.toContain("'reason',v_reason");
    expect(sql).toContain('fromClassId');
    expect(sql).toContain('toClassId');
    expect(sql).toContain('class_reassignment');
  });

  it('withdraws only active enrolments with a reason and retains progression/audit history', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('withdraw_learner_enrolment');
    expect(sql).toContain("SET status='withdrawn',ends_at=v_end_date,withdrawal_reason=v_reason");
    expect(sql).toContain('learner_enrolments ADD COLUMN withdrawal_reason text');
    expect(sql).toContain("'withdrawn',v_enrolment.grade");
    expect(sql).toContain('learner.withdrawn');
    expect(sql).toContain('A reason of 10 to 500 characters is required for learner withdrawal');
  });

  it('requires independent progression approval before execution', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE TABLE public.learner_progression_requests');
    expect(sql).toContain('request_learner_progression');
    expect(sql).toContain('approve_learner_progression_request');
    expect(sql).toContain('reject_learner_progression_request');
    expect(sql).toContain('execute_approved_learner_progression');
    expect(sql).toContain('v_request.requested_by=v_actor_id');
    expect(sql).toContain('Progression requests require independent approval');
    expect(sql).toContain('Progression cannot be executed before its effective date');
    expect(sql).toContain('learner.progression_executed');
  });

  it('does not grant direct runtime writes to class history or progression decisions', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('GRANT SELECT ON TABLE public.learner_class_placements TO sentinel_learner_runtime');
    expect(sql).toContain('GRANT SELECT ON TABLE public.learner_progression_requests TO sentinel_learner_runtime');
    expect(sql).not.toMatch(/GRANT\s+(INSERT|UPDATE|DELETE|ALL)\s+ON\s+TABLE\s+public\\.(learner_class_placements|learner_progression_requests)/i);
  });
});
