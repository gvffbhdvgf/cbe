import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0013_assessment_event_eligible_roster.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);
const schemaPath = new URL('./schema/assessment.ts', import.meta.url);

describe('assessment event eligible roster migration contract', () => {
  it('registers migration 0013 in sequence', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries).toHaveLength(23);
    expect(journal.entries[13]).toMatchObject({ idx: 13, tag: '0013_assessment_event_eligible_roster' });
  });

  it('snapshots the effective enrolment and learner scope at the event date', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('assessment_event_eligible_enrolments');
    expect(sql).toContain("enrolment.status = 'active'");
    expect(sql).toContain("learner.status = 'active'");
    expect(sql).toContain('enrolment.starts_at <= v_eligibility_date');
    expect(sql).toContain('enrolment.ends_at > v_eligibility_date');
    expect(sql).toContain("(v_event.starts_at AT TIME ZONE 'UTC')::date");
  });

  it('only schedules draft events with approved instruments and active programmes', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain("v_event.status <> 'draft'");
    expect(sql).toContain("instrument.status = 'approved'");
    expect(sql).toContain("programme.status = 'active'");
    expect(sql).toContain('Cannot schedule an assessment event with no eligible learner enrolments');
  });

  it('makes the roster immutable, tenant-scoped, readable but not directly writable by runtime', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('assessment_event_roster_append_only');
    expect(sql).toContain('ALTER TABLE public.assessment_event_eligible_enrolments ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE public.assessment_event_eligible_enrolments FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('GRANT SELECT ON TABLE public.assessment_event_eligible_enrolments TO sentinel_learner_runtime');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION sentinel_private.schedule_assessment_event(uuid) TO sentinel_learner_runtime');
    expect(sql).not.toMatch(/GRANT\s+(?:ALL|INSERT|UPDATE|DELETE)[^;]*assessment_event_eligible_enrolments/i);
  });

  it('requires every attempt to reference a frozen eligible enrolment', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    const schema = await readFile(schemaPath, 'utf8');
    expect(sql).toContain('assessment_attempts_eligible_roster_fk');
    expect(schema).toContain("name: 'assessment_attempts_eligible_roster_fk'");
    expect(schema).toContain('assessmentEventEligibleEnrolments');
  });

  it('records the scheduling actor, eligibility date and denominator in audit history', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain("'assessment.event_scheduled'");
    expect(sql).toContain("'eligibleLearnerCount', v_eligible_count");
    expect(sql).toContain("'eligibilityDate', v_eligibility_date");
  });
});
