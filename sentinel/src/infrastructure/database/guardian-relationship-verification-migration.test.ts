import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0026_guardian_relationship_verification.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);

describe('guardian relationship verification migration', () => {
  it('registers migration 0026 after staff workforce records', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries[26]).toMatchObject({ idx: 26, tag: '0026_guardian_relationship_verification' });
  });

  it('stores a tenant-scoped guardian profile separately from learner relationships', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE TABLE public.guardian_profiles');
    expect(sql).toContain('FOREIGN KEY (tenant_organisation_id, person_id)');
    expect(sql).toContain('CREATE UNIQUE INDEX guardian_profiles_org_user_unique');
    expect(sql).toContain('ALTER TABLE public.guardian_relationships');
    expect(sql).toContain('guardian_relationships_active_unique');
  });

  it('requires explicit identity de-duplication and independently verified evidence', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('p_confirm_distinct_person boolean');
    expect(sql).toContain('Confirm that you checked for an existing Person record');
    expect(sql).toContain('sentinel_private.review_guardian_profile');
    expect(sql).toContain('v_profile.created_by = v_actor_id');
    expect(sql).toContain('verification_method');
    expect(sql).toContain('evidence_reference');
  });

  it('requires a verified guardian profile before relationship approval', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('sentinel_private.review_guardian_relationship');
    expect(sql).toContain('The guardian Person identity must be independently verified first');
    expect(sql).toContain('can_view_progress = COALESCE(p_can_view_progress, false)');
    expect(sql).toContain('can_receive_messages = COALESCE(p_can_receive_messages, false)');
    expect(sql).toContain("verification_status = 'verified' OR (can_view_progress = false AND can_receive_messages = false)");
  });

  it('links only an active verified account matching the institution-verified contact email', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('sentinel_private.link_guardian_account');
    expect(sql).toContain('u."emailVerified" = true');
    expect(sql).toContain('COALESCE(u.banned, false) = false');
    expect(sql).toContain('The email must match the guardian contact email verified by the institution');
  });

  it('revokes permissions and records the reason when a relationship is withdrawn', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('sentinel_private.revoke_guardian_relationship');
    expect(sql).toContain("status = 'revoked'");
    expect(sql).toContain('can_view_progress = false');
    expect(sql).toContain('can_receive_messages = false');
    expect(sql).toContain('guardian.relationship_revoked');
  });

  it('forces RLS and grants no direct writes to runtime roles', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('ALTER TABLE public.guardian_profiles FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE public.guardian_relationships FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('guardian_profiles_select_policy');
    expect(sql).toContain('guardian_relationships_select_policy');
    expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON public.guardian_profiles, public.guardian_relationships FROM PUBLIC, sentinel_learner_runtime');
    expect(sql).toContain('REVOKE ALL ON FUNCTION sentinel_private.create_guardian_relationship');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION sentinel_private.create_guardian_relationship');
    expect(sql).toContain('REVOKE ALL ON FUNCTION sentinel_private.review_guardian_profile');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION sentinel_private.review_guardian_profile');
    expect(sql).toContain('REVOKE ALL ON FUNCTION sentinel_private.review_guardian_relationship');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION sentinel_private.review_guardian_relationship');
  });
});
