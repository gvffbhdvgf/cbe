import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0020_assessment_authoring.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);

describe('assessment authoring migration contract', () => {
  it('registers migration 0020 in sequence', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries).toHaveLength(21);
    expect(journal.entries[20]).toMatchObject({ idx: 20, tag: '0020_assessment_authoring' });
  });

  it('exposes authoring only through narrow authenticated operations', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    for (const operation of ['create_assessment_programme', 'create_assessment_instrument_version', 'approve_assessment_instrument_version', 'create_assessment_event']) {
      expect(sql).toContain(`CREATE FUNCTION sentinel_private.${operation}`);
      expect(sql).toContain(`REVOKE ALL ON FUNCTION sentinel_private.${operation}`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION sentinel_private.${operation}`);
    }
    expect(sql).toContain('sentinel_private.current_user_id()');
    expect(sql).toContain('sentinel_private.can_access_assessment_data');
    expect(sql).not.toMatch(/GRANT\s+(INSERT|UPDATE|DELETE|ALL)\s+ON\s+TABLE\s+public\.assessment_/i);
  });

  it('creates versioned instruments with bounded, typed task definitions', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('jsonb_array_length(p_tasks) NOT BETWEEN 1 AND 100');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('assessment_tasks');
    expect(sql).toContain('maximumScore');
    expect(sql).toContain('v_maximum_score > 100000');
  });

  it('requires independent instrument approval and an approved instrument for event creation', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('v_instrument.created_by = v_actor_id');
    expect(sql).toContain('Instrument approval requires a different authorised officer');
    expect(sql).toContain("instrument.status = 'approved'");
    expect(sql).toContain('create_assessment_event');
    expect(sql).toContain('assessment_event_eligible_enrolments');
  });

  it('returns only the immutable event roster and any existing attempt reference', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('list_assessment_eligible_enrolments');
    expect(sql).toContain('LEFT JOIN public.assessment_attempts');
    expect(sql).toContain('sentinel_private.can_access_assessment_data(roster.organisation_id)');
  });
});
