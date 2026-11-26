import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0022_teacher_class_assignments_and_scoped_assessment.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);

describe('teacher assignment and class-scoped assessment migration', () => {
  it('registers migration 0022 after curriculum mapping and timezone support', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries[22]).toMatchObject({ idx: 22, tag: '0022_teacher_class_assignments_and_scoped_assessment' });
  });

  it('creates effective-dated teacher assignments with verified teacher membership and audit history', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE TABLE public.teacher_class_assignments');
    expect(sql).toContain('FOREIGN KEY');
    expect(sql).toContain("membership.role = 'teacher'");
    expect(sql).toContain('auth_user."emailVerified" = true');
    expect(sql).toContain('daterange(existing.starts_on, existing.ends_on');
    expect(sql).toContain('teacher.class_assignment_created');
    expect(sql).toContain('teacher.class_assignment_revoked');
    expect(sql).toContain('revoke_teacher_class_assignment');
    expect(sql).toContain('GRANT SELECT ON TABLE public.teacher_class_assignments TO sentinel_learner_runtime');
    expect(sql).not.toMatch(/GRANT\\s+(INSERT|UPDATE|DELETE|ALL)\\s+ON\\s+TABLE\\s+public\\.teacher_class_assignments/i);
  });

  it('keeps teacher access restricted to assigned class, learning area and event date', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('can_teach_assessment_event');
    expect(sql).toContain('assignment.class_id = event_record.class_id');
    expect(sql).toContain('assignment.learning_area_id = event_record.learning_area_id');
    expect(sql).toContain('assignment.starts_on <= (event_record.starts_at AT TIME ZONE event_record.time_zone)::date');
    expect(sql).toContain('membership.role = \'teacher\'');
    expect(sql).toContain('can_access_assessment_event');
    expect(sql).toContain('can_access_assessment_attempt');
    expect(sql).not.toContain('can_access_assessment_data(uuid) RETURNS boolean');
  });

  it('freezes only the targeted class roster and keeps event authoring under administrator authority', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('ADD COLUMN class_id uuid');
    expect(sql).toContain('create_class_assessment_event_local');
    expect(sql).toContain('(v_event.class_id IS NULL OR enrolment.class_id=v_event.class_id)');
    expect(sql).toContain('sentinel_private.can_access_assessment_data(p_organisation_id)');
    expect(sql).toContain('sentinel_private.can_access_assessment_event(event_record.id)');
  });

  it('does not grant teachers marking, moderation, approval or publication access', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).not.toContain('DROP POLICY assessment_response_marks_select');
    expect(sql).not.toContain('CREATE POLICY assessment_response_marks_select');
    expect(sql).toContain('sentinel_private.can_access_assessment_data(organisation_id)');
  });
});
