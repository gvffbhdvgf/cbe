import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0012_assessment_lifecycle_foundation.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);

describe('assessment lifecycle migration contract', () => {
  it('registers the additive migration as sequence 0012', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries).toHaveLength(20);
    expect(journal.entries[12]).toMatchObject({ idx: 12, tag: '0012_assessment_lifecycle_foundation' });
  });

  it('enforces tenant, organisation, grade, year and instrument consistency with relational constraints', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('assessment_attempts_enrolment_fk');
    expect(sql).toContain('assessment_attempts_event_fk');
    expect(sql).toContain('assessment_events_instrument_fk');
    expect(sql).toContain('learner_enrolments_assessment_scope_unique');
    expect(sql).toContain('assessment_attempts_event_enrolment_attempt_unique');
  });

  it('allows outcome mapping approval only against reviewed, rights-cleared specific outcomes', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain("node.node_type = 'specific_outcome'");
    expect(sql).toContain("node.extraction_status = 'approved'");
    expect(sql).toContain("document.review_status = 'approved'");
    expect(sql).toContain("document.rights_status = 'confirmed'");
    expect(sql).toContain('offering.grade = instrument.grade');
    expect(sql).toContain('offering.learning_area_id = instrument.learning_area_id');
  });

  it('forces row security and exposes assessment reads only to active authorised school roles', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY');
    expect(sql).toContain("membership.role IN ('organisation_admin','school_admin','assessor')");
    expect(sql).toContain('sentinel_private.can_access_assessment_data');
    expect(sql).not.toMatch(/GRANT\s+(?:ALL|INSERT|UPDATE|DELETE)[^;]*assessment_(?:programmes|events|attempts)/i);
  });

  it('keeps result and decision history append-only and locks instruments after use', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('assessment_results_append_only');
    expect(sql).toContain('assessment_decisions_append_only');
    expect(sql).toContain('assessment_instrument_version_lock');
    expect(sql).toContain('create a new version');
  });

  it('does not treat teachers as school-wide assessment data administrators before class assignments exist', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).not.toContain("'teacher')");
    expect(sql).toContain('Assessment writes remain unavailable to the runtime role');
  });
});

