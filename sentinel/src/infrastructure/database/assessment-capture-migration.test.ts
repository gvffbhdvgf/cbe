import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0014_controlled_assessment_capture.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);

describe('controlled assessment capture migration contract', () => {
  it('registers the next additive migration', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries).toHaveLength(26);
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

  it('requires verified identity and active organisation assessment authority inside every privileged operation', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    const functions = [
      'open_assessment_event',
      'create_assessment_attempt',
      'capture_assessment_response',
      'submit_assessment_attempt',
    ];
    for (const name of functions) {
      const start = sql.indexOf(`CREATE FUNCTION sentinel_private.${name}`);
      expect(start, `${name} function must exist`).toBeGreaterThanOrEqual(0);
      const next = sql.indexOf('CREATE FUNCTION sentinel_private.', start + 1);
      const body = sql.slice(start, next < 0 ? sql.length : next);
      expect(body).toContain('SECURITY DEFINER');
      expect(body).toContain('sentinel_private.current_user_id()');
      expect(body).toContain('sentinel_private.can_access_assessment_data(');
      expect(body).toContain('Authentication required');
    }
  });

  it('serializes event and attempt transitions to prevent concurrent duplicate lifecycle changes', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql.match(/FROM public\.assessment_events AS event_record[\s\S]*?FOR UPDATE/g)).toHaveLength(4);
    expect(sql).toContain('FROM public.assessment_attempts AS attempt');
    expect(sql).toContain('FOR UPDATE');
  });

  it('keeps captured responses immutable and makes all four lifecycle operations auditable', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON public.assessment_responses');
    expect(sql).toContain('Captured assessment responses are append-only');
    for (const action of ['assessment.event_opened', 'assessment.attempt_created', 'assessment.response_captured', 'assessment.attempt_submitted']) {
      expect(sql).toContain(`'${action}'`);
    }
  });

  it('grants runtime execution only on the four narrow lifecycle functions', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    for (const signature of [
      'open_assessment_event(uuid)',
      'create_assessment_attempt(uuid, uuid)',
      'capture_assessment_response(uuid, uuid, jsonb)',
      'submit_assessment_attempt(uuid)',
    ]) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION sentinel_private.${signature} FROM PUBLIC`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION sentinel_private.${signature} TO sentinel_learner_runtime`);
    }
    expect(sql).not.toMatch(/GRANT\s+(?:ALL|INSERT|UPDATE|DELETE)[^;]*assessment_(?:events|attempts|responses)/i);
  });
});
