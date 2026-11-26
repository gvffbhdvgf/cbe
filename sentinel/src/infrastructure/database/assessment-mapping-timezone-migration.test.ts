import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0021_curriculum_mapping_and_timezone.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);

describe('curriculum mapping and timezone migration contract', () => {
  it('registers migration 0021 after assessment authoring', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries).toHaveLength(25);
    expect(journal.entries[21]).toMatchObject({ idx: 21, tag: '0021_curriculum_mapping_and_timezone' });
  });

  it('validates and snapshots IANA time zones for organisations and assessment events', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain("ADD COLUMN time_zone varchar(64) NOT NULL DEFAULT 'Africa/Nairobi'");
    expect(sql).toContain('pg_catalog.pg_timezone_names');
    expect(sql).toContain('GRANT SELECT ON TABLE');
    expect(sql).toContain('public.curriculum_grade_offerings');
    expect(sql).toContain('list_assessment_instrument_outcome_options');
    expect(sql).toContain('list_assessment_instrument_outcome_mappings');
    expect(sql).not.toContain('GRANT SELECT ON TABLE public.curriculum_source_nodes');
    expect(sql).not.toContain('GRANT SELECT ON TABLE public.curriculum_design_documents');
    expect(sql).toContain("document.rights_status = 'confirmed'");
    expect(sql).toContain('CASE WHEN document.id IS NOT NULL AND offering.id IS NOT NULL');
    expect(sql).toContain('assessment_events_time_zone_validation');
    expect(sql).toContain('time_zone,');
    expect(sql).toContain("'timeZone', v_time_zone");
  });

  it('converts institution-local wall-clock times in PostgreSQL, not the browser timezone', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('create_assessment_event_local');
    expect(sql).toContain('p_starts_at_local AT TIME ZONE v_time_zone');
    expect(sql).toContain('p_ends_at_local AT TIME ZONE v_time_zone');
    expect(sql).toContain('v_event.starts_at AT TIME ZONE v_event.time_zone');
    expect(sql).not.toContain("v_event.starts_at AT TIME ZONE 'UTC'");
  });

  it('creates task outcome mappings only against approved, rights-cleared, matching outcomes', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('create_assessment_task_outcome_mapping');
    expect(sql).toContain('p_instrument_version_id');
    expect(sql).toContain("node.node_type = 'specific_outcome'");
    expect(sql).toContain("node.extraction_status = 'approved'");
    expect(sql).toContain("document.review_status = 'approved'");
    expect(sql).toContain("document.rights_status = 'confirmed'");
    expect(sql).toContain('offering.grade = v_grade');
    expect(sql).toContain('offering.learning_area_id = v_learning_area_id');
    expect(sql).toContain('offering.id = v_curriculum_grade_offering_id');
    expect(sql).toContain('instrument.id = p_instrument_version_id');
    expect(sql).toContain('create_assessment_instrument_version_from_offering');
    expect(sql).toContain('assessment_instrument_curriculum_offering_validation');
    expect(sql).toContain('validate_instrument_curriculum_offering');
    expect(sql).toContain('curriculum_grade_offering_id, instrument_code');
  });

  it('requires independent, reasoned mapping review and narrow database grants', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('review_assessment_task_outcome_mapping');
    expect(sql).toContain('v_mapping.created_by = v_actor_id');
    expect(sql).toContain('Outcome mapping review requires an independent reviewer');
    expect(sql).toContain('p_review_note');
    expect(sql).toContain('REVOKE ALL ON FUNCTION sentinel_private.create_assessment_task_outcome_mapping');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION sentinel_private.create_assessment_task_outcome_mapping');
    expect(sql).toContain('REVOKE ALL ON FUNCTION sentinel_private.review_assessment_task_outcome_mapping');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION sentinel_private.review_assessment_task_outcome_mapping');
    expect(sql).not.toMatch(/GRANT\s+(INSERT|UPDATE|DELETE|ALL)\s+ON\s+TABLE\s+public\.assessment_/i);
  });
});
