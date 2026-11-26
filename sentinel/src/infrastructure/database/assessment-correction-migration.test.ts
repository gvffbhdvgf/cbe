import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0018_assessment_result_correction.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);

describe('assessment result correction migration contract', () => {
  it('registers migration 0018 in sequence', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries).toHaveLength(24);
    expect(journal.entries[18]).toMatchObject({ idx: 18, tag: '0018_assessment_result_correction' });
  });

  it('requires a moderation correction request before appending corrected marks', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE FUNCTION sentinel_private.record_assessment_mark_correction');
    expect(sql).toContain("v_attempt.status <> 'marked'");
    expect(sql).toContain("v_event.status <> 'marking'");
    expect(sql).toContain("v_latest_decision <> 'correction_requested'");
    expect(sql).toContain('A reason is required for every corrected mark');
    expect(sql).toContain('p_supersedes_mark_id IS DISTINCT FROM v_latest_mark.id');
    expect(sql).toContain('p_awarded_score > v_maximum_score');
  });

  it('corrects only required tasks against the exact immutable response and instrument', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('response.instrument_version_id = v_attempt.instrument_version_id');
    expect(sql).toContain('task.required = true');
    expect(sql).toContain('assessment_response_marks');
    expect(sql).not.toMatch(/UPDATE\s+public\.assessment_responses/i);
    expect(sql).not.toMatch(/UPDATE\s+public\.assessment_response_marks/i);
  });

  it('creates a new immutable result version and supersedes the prior result', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE FUNCTION sentinel_private.finalize_assessment_mark_correction');
    expect(sql).toContain('v_previous_result.result_version + 1');
    expect(sql).toContain('supersedes_result_id');
    expect(sql).toContain("'result_superseded'");
    expect(sql).toContain('assessment.result_corrected');
    expect(sql).toContain('Every required task must have a captured response and latest mark');
    expect(sql).not.toMatch(/UPDATE\s+public\.assessment_results/i);
  });

  it('exposes correction operations only through narrow privileged functions', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    for (const signature of [
      'record_assessment_mark_correction(uuid, uuid, numeric, text, uuid)',
      'finalize_assessment_mark_correction(uuid)',
    ]) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION sentinel_private.${signature} FROM PUBLIC`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION sentinel_private.${signature} TO sentinel_learner_runtime`);
    }
  });
});
