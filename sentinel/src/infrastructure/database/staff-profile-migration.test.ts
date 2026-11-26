import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0025_staff_profiles_and_engagements.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);

describe('staff profiles and effective-dated engagements migration', () => {
  it('registers migration 0025 after adapted curriculum pathway coverage', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries).toHaveLength(26);
    expect(journal.entries[25]).toMatchObject({ idx: 25, tag: '0025_staff_profiles_and_engagements' });
  });

  it('keeps staff identity canonical and employment history effective-dated', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE TABLE public.staff_profiles');
    expect(sql).toContain('REFERENCES public.people(tenant_organisation_id, id)');
    expect(sql).toContain('UNIQUE (organisation_id, person_id)');
    expect(sql).toContain('CREATE TABLE public.staff_engagements');
    expect(sql).toContain('REFERENCES public.staff_profiles(tenant_organisation_id, organisation_id, id)');
    expect(sql).toContain('CHECK (ends_on IS NULL OR ends_on > starts_on)');
    expect(sql).toContain("status IN ('planned','active','on_leave','ended','suspended')");
  });

  it('requires an explicit duplicate-person check and exposes only the controlled creation function', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('p_confirm_distinct_person boolean');
    expect(sql).toContain('p_confirm_distinct_person IS NOT TRUE');
    expect(sql).toContain('Confirm that this is a distinct person');
    expect(sql).toContain('sentinel_private.create_staff_profile(uuid,uuid,text,text,text,text,text,text,text,text,date,date,boolean)');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION sentinel_private.create_staff_profile(uuid,uuid,text,text,text,text,text,text,text,text,date,date,boolean) TO sentinel_learner_runtime');
    expect(sql).not.toContain('GRANT INSERT ON TABLE public.staff_profiles');
    expect(sql).not.toContain('GRANT UPDATE ON TABLE public.staff_profiles');
    expect(sql).not.toContain('GRANT DELETE ON TABLE public.staff_profiles');
  });

  it('requires an active verified Teacher membership before linking an account', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('sentinel_private.link_staff_account');
    expect(sql).toContain('auth_user."emailVerified" = true');
    expect(sql).toContain("membership.role = 'teacher'");
    expect(sql).toContain("membership.status = 'active'");
    expect(sql).toContain('staff.account_linked');
  });

  it('ends engagements using the organisation local date and preserves audit history', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('sentinel_private.end_staff_engagement');
    expect(sql).toContain('(pg_catalog.now() AT TIME ZONE v_time_zone)::date');
    expect(sql).toContain('staff.engagement_end_dated');
  });

  it('requires a linked staff profile and active engagement for teacher class allocation', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION sentinel_private.create_teacher_class_assignment');
    expect(sql).toContain('staff.user_id = p_teacher_user_id');
    expect(sql).toContain("staff.staff_category = 'teacher'");
    expect(sql).toContain("engagement.status IN ('active', 'planned')");
    expect(sql).toContain('An active teacher staff profile and engagement linked to this account are required');
  });

  it('forces row-level security and grants no direct staff table writes', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('ALTER TABLE public.staff_profiles FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE public.staff_engagements FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('CREATE POLICY staff_profiles_select');
    expect(sql).toContain('CREATE POLICY staff_engagements_select');
    expect(sql).toContain('GRANT SELECT ON TABLE public.staff_profiles TO sentinel_learner_runtime');
    expect(sql).toContain('GRANT SELECT ON TABLE public.staff_engagements TO sentinel_learner_runtime');
    expect(sql).not.toMatch(/GRANT\\s+(INSERT|UPDATE|DELETE|ALL)\\s+ON\\s+TABLE\\s+public\\.(staff_profiles|staff_engagements)/i);
  });
});
