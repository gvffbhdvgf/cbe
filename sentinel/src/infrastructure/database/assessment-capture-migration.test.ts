import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0014_controlled_assessment_capture.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);

describe('controlled assessment capture migration contract', () => {
  it('registers the next additive migration', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries).toHaveLength(16);
    expect(journal.entries[14]).toMatchObject({ idx: 14, tag: '0014_controlled_assessment_capture' });
  });

  it('opens only scheduled events within the configured event window with approved instruments and active programmes', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('open_assessment_event');
    expect(sql).toContain("v_event.status <> 'scheduled'");
    expect(sql).toContain('v_now < v_event.starts_at');
    expect(sql).toContain('v_now >= v_event.ends_at');
    expect(sql).toContain("instrument.status = 'approved'");
    expect(sql).toContain("programme.status = 'active'");
    expect(sql).toContain('assessment_event_eligible_enrolments');
  });

  it('creates attempts only for the immutable event roster and an open event', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('create_assessment_attempt');
    expect(sql).toContain("v_event.status <> 'open'");
    expect(sql).toContain('roster.enrolment_id = p_enrolment_id');
    expect(sql).toContain("'in_progress'");
    expect(sql).toContain('assessment_attempts');
  });

  it('captures one immutable response per task and verifies task/instrument scope', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('capture_assessment_response');
    expect(sql).toContain('task.instrument_version_id = v_attempt.instrument_version_id');
    expect(sql).toContain('assessment_responses_append_only');
    expect(sql).toContain('assessment.response_captured');
  });

  it('requires all required task responses before submission', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('submit_assessment_attempt');
    expect(sql).toContain('task.required = true');
    expect(sql).toContain('response.id IS NULL');
    expect(sql).toContain("SET status = 'submitted'");
    expect(sql).toContain('assessment.attempt_submitted');
  });

  it('exposes only controlled functions and records each transition in audit history', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    for (const action of ['assessment.event_opened', 'assessment.attempt_created', 'assessment.response_captured', 'assessment.attempt_submitted']) {
      expect(sql).toContain(action);
    }
    expect(sql).toContain('REVOKE ALL ON FUNCTION sentinel_private.open_assessment_event(uuid) FROM PUBLIC');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION sentinel_private.submit_assessment_attempt(uuid) TO sentinel_learner_runtime');
  });
});
