import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0016_assessment_marking_results.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);

describe('assessment marking and result migration contract', () => {
  it('registers the next additive migration', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries).toHaveLength(23);
    expect(journal.entries[16]).toMatchObject({ idx: 16, tag: '0016_assessment_marking_results' });
  });

  it('stores marks separately from immutable learner response evidence', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE TABLE public.assessment_response_marks');
    expect(sql).toContain('assessment_response_marks_response_fk');
    expect(sql).toContain('assessment_response_marks_task_fk');
    expect(sql).toContain('assessment_response_marks_supersedes_fk');
    expect(sql).toContain('assessment_response_marks_version_unique');
    expect(sql).toContain('assessment_response_marks_append_only');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON public.assessment_response_marks');
    expect(sql).not.toMatch(/UPDATE\s+public\.assessment_responses/i);
  });

  it('requires verified identity, organisation authority and serialized attempt marking', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    for (const name of ['void_assessment_attempt', 'close_assessment_event', 'record_assessment_mark', 'finalize_assessment_marking']) {
      const start = sql.indexOf(`CREATE FUNCTION sentinel_private.${name}`);
      expect(start, `${name} must exist`).toBeGreaterThanOrEqual(0);
      const next = sql.indexOf('CREATE FUNCTION sentinel_private.', start + 1);
      const body = sql.slice(start, next < 0 ? sql.length : next);
      expect(body).toContain('SECURITY DEFINER');
      expect(body).toContain('sentinel_private.current_user_id()');
      expect(body).toContain('sentinel_private.can_access_assessment_data(');
      expect(body).toContain('Authentication required');
    }
    expect(sql).toContain('FROM public.assessment_attempts AS attempt');
    expect(sql).toContain('FOR UPDATE');
  });

  it('voids incomplete attempts only after the event ends and requires a reason', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('A reason is required to void an assessment attempt');
    expect(sql).toContain("v_attempt.status <> 'in_progress'");
    expect(sql).toContain('assessment.attempt_voided');
  });

  it('closes events only after the end time and after active attempts are submitted or voided', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain("v_event.status <> 'open'");
    expect(sql).toContain('v_now < v_event.ends_at');
    expect(sql).toContain("attempt.status = 'in_progress'");
    expect(sql).toContain('assessment.event_closed');
  });

  it('validates each mark against the task maximum and requires explicit reasoned supersession', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('p_awarded_score > v_maximum_score');
    expect(sql).toContain('p_supersedes_mark_id IS DISTINCT FROM v_latest.id');
    expect(sql).toContain('A reason is required when correcting an existing mark');
    expect(sql).toContain('assessment.response_mark_corrected');
    expect(sql).toContain('assessment.response_marked');
  });

  it('generates a result only when every required task has a captured response and latest mark', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('Every required task must have a captured response and a final mark');
    expect(sql).toContain('task.required = true');
    expect(sql).toContain('ORDER BY mark.mark_version DESC');
    expect(sql).toContain('SUM(latest_mark.awarded_score)');
    expect(sql).toContain('SUM(task.maximum_score)');
    expect(sql).toContain('assessment.result_generated');
    expect(sql).toContain("SET status = 'marked'");
    expect(sql).toContain("'required_tasks_only'");
  });

  it('grants runtime access only through the three controlled operations', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    for (const signature of [
      'void_assessment_attempt(uuid, text)',
      'close_assessment_event(uuid)',
      'record_assessment_mark(uuid, uuid, numeric, text, uuid)',
      'finalize_assessment_marking(uuid)',
    ]) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION sentinel_private.${signature} FROM PUBLIC`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION sentinel_private.${signature} TO sentinel_learner_runtime`);
    }
    expect(sql).not.toMatch(/GRANT\s+(?:ALL|INSERT|UPDATE|DELETE)[^;]*assessment_response_marks/i);
  });
});
