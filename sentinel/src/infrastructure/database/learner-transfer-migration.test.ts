import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0027_privacy_preserving_learner_transfers.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);

describe('privacy-preserving learner transfer migration', () => {
  it('registers migration 0027 after guardian relationship verification', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries[27]).toMatchObject({ idx: 27, tag: '0027_privacy_preserving_learner_transfers' });
  });

  it('keeps cross-institution workflow metadata free of direct learner identity', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    const requestTable = sql.split('CREATE TABLE public.learner_transfer_requests')[1]?.split('--> statement-breakpoint')[0] ?? '';
    expect(requestTable).toContain('sending_organisation_id');
    expect(requestTable).toContain('receiving_organisation_id');
    expect(requestTable).toContain('transfer_reference');
    expect(requestTable).not.toMatch(/source_learner_id|source_enrolment_id|destination_learner_id|destination_enrolment_id|first_name|last_name|contact_email/i);
    expect(sql).toContain('CREATE TABLE public.learner_transfer_source_links');
    expect(sql).toContain('CREATE TABLE public.learner_transfer_destination_links');
  });

  it('keeps source and destination identity links in separately scoped tenant tables', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('learner_transfer_source_links_select');
    expect(sql).toContain('can_manage_learner_records(sending_organisation_id)');
    expect(sql).toContain('learner_transfer_destination_links_select');
    expect(sql).toContain('can_manage_learner_records(receiving_organisation_id)');
    expect(sql).toContain('learner_transfer_source_learner_fk');
    expect(sql).toContain('learner_transfer_destination_learner_fk');
  });

  it('implements sender request, receiver decision, sender release and receiver completion', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    for (const name of ['request_learner_transfer', 'accept_learner_transfer', 'reject_learner_transfer', 'cancel_learner_transfer', 'release_learner_transfer', 'complete_learner_transfer']) {
      expect(sql).toContain(`sentinel_private.${name}`);
    }
    expect(sql).toContain("status IN ('requested','accepted','rejected','released','completed','cancelled')");
    expect(sql).toContain('A transfer cannot be released before its effective date');
    expect(sql).toContain('Only a released transfer addressed to this institution can be completed');
  });

  it('preserves source history and records both sides of progression', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain("SET status = 'transferred', ends_at = v_request.effective_at");
    expect(sql).toContain("'transferred_out'");
    expect(sql).toContain("'transferred_in'");
    expect(sql).toContain("status = CASE WHEN placement.starts_at >= v_effective_at_ts THEN 'cancelled' ELSE 'ended' END");
    expect(sql).toContain("(status = 'cancelled' AND ends_at = starts_at)");
  });

  it('validates the destination enrolment and preserves institution-local effective dates', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('p_destination_grade integer');
    expect(sql).toContain('p_destination_academic_year integer');
    expect(sql).toContain('p_effective_at date');
    expect(sql).toContain('v_request.effective_at > v_today');
    expect(sql).toContain('v_destination.starts_at <> v_request.effective_at');
    expect(sql).toContain('destination enrolment must be active');
  });

  it('forces RLS, denies direct writes and grants only controlled functions', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('ALTER TABLE public.learner_transfer_requests FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE public.learner_transfer_source_links FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE public.learner_transfer_destination_links FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('REVOKE ALL ON TABLE public.learner_transfer_requests FROM sentinel_learner_runtime');
    expect(sql).toContain('GRANT SELECT ON TABLE public.learner_transfer_requests TO sentinel_learner_runtime');
    expect(sql).toContain('REVOKE ALL ON FUNCTION sentinel_private.request_learner_transfer');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION sentinel_private.request_learner_transfer');
    expect(sql).toContain('REVOKE ALL ON FUNCTION sentinel_private.complete_learner_transfer');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION sentinel_private.complete_learner_transfer');
  });
});
