import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0019_assessment_correction_guard.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);

describe('assessment correction guard migration contract', () => {
  it('registers migration 0019 in sequence', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries).toHaveLength(24);
    expect(journal.entries[19]).toMatchObject({ idx: 19, tag: '0019_assessment_correction_guard' });
  });

  it('requires a correction request on the superseded result', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('NEW.supersedes_result_id');
    expect(sql).toContain("decision.decision_type = 'correction_requested'");
    expect(sql).toContain('A recorded moderation correction request is required');
  });

  it('requires a new versioned mark on a required task after the correction request', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('mark.supersedes_mark_id IS NOT NULL');
    expect(sql).toContain('mark.marked_at > v_correction_requested_at');
    expect(sql).toContain('task.required = true');
    expect(sql).toContain('At least one required task mark must be corrected');
  });

  it('guards result inserts without making result history mutable', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE TRIGGER assessment_results_correction_requires_new_mark');
    expect(sql).toContain('BEFORE INSERT ON public.assessment_results');
    expect(sql).not.toMatch(/UPDATE\s+public\.assessment_results/i);
    expect(sql).toContain('REVOKE ALL ON FUNCTION sentinel_private.require_corrected_assessment_mark() FROM PUBLIC');
  });
});
