import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0029_organisation_transfer_eligibility.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);
const transferServicePath = new URL('../../application/learner/transfer-service.ts', import.meta.url);

describe('institution transfer-eligibility registry migration', () => {
  it('registers migration 0029 after the guardian portal read model', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries[29]).toMatchObject({ idx: 29, tag: '0029_organisation_transfer_eligibility' });
  });

  it('stores one governed institutional identity and blocks duplicate issuer identifiers', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE TABLE public.organisation_transfer_eligibility');
    expect(sql).toContain("'moe_registration_number'");
    expect(sql).toContain("'nemis_uic'");
    expect(sql).toContain("'kemis_institution_id'");
    expect(sql).toContain("'tveta_registration_number'");
    expect(sql).not.toContain("'knec_centre_code'");
    expect(sql).toContain('lower(btrim(registry_identifier))');
    expect(sql).toContain('organisation_transfer_eligibility_state_check');
  });

  it('forces RLS and permits only scoped reads with no direct runtime writes', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('ALTER TABLE public.organisation_transfer_eligibility ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('ALTER TABLE public.organisation_transfer_eligibility FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('organisation_transfer_eligibility_select');
    expect(sql).toContain('sentinel_private.can_manage_learner_records(organisation_id)');
    expect(sql).toContain('sentinel_private.is_platform_administrator()');
    expect(sql).toContain('REVOKE ALL ON TABLE public.organisation_transfer_eligibility FROM sentinel_learner_runtime');
    expect(sql).toContain('GRANT SELECT ON TABLE public.organisation_transfer_eligibility TO sentinel_learner_runtime');
  });

  it('requires a different active platform administrator to verify or reject a request', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('sentinel_private.request_organisation_transfer_eligibility');
    expect(sql).toContain('sentinel_private.review_organisation_transfer_eligibility');
    expect(sql).toContain('sentinel_private.suspend_organisation_transfer_eligibility');
    expect(sql).toContain('v_request.requested_by = v_actor_id');
    expect(sql).toContain('The requester cannot review their own institution eligibility');
    expect(sql).toContain('An inactive institution cannot be verified for transfers');
    expect(sql).toContain('v_request.requested_by = v_actor_id');
    expect(sql).toContain("'organisation.transfer_eligibility_requested'");
    expect(sql).toContain("'organisation.transfer_eligibility_verified'");
    expect(sql).toContain("'organisation.transfer_eligibility_rejected'");
    expect(sql).toContain("'organisation.transfer_eligibility_suspended'");
  });


  it('allows renewal after rejection, suspension or local-date expiry only', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain("public.organisation_transfer_eligibility.status IN ('rejected','suspended')");
    expect(sql).toContain("public.organisation_transfer_eligibility.status = 'verified'");
    expect(sql).toContain('public.organisation_transfer_eligibility.valid_until < v_today');
  });

  it('enforces receiver eligibility on request, acceptance and release at the database boundary', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE FUNCTION sentinel_private.enforce_verified_transfer_destination()');
    expect(sql).toContain('BEFORE INSERT OR UPDATE OF status ON public.learner_transfer_requests');
    expect(sql).toContain("NEW.status NOT IN ('requested','accepted','released')");
    expect(sql).toContain("v_eligibility_status <> 'verified'");
    expect(sql).toContain('v_valid_until < v_today');
    expect(sql).toContain('Receiving institution is not verified and transfer-eligible');
    expect(sql).toContain("v_organisation_status <> 'active'");
  });

  it('exposes only verified institution IDs and names in the receiving directory', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    const directoryFunction = sql.split('CREATE FUNCTION sentinel_private.list_verified_transfer_institutions()')[1]?.split('--> statement-breakpoint')[0] ?? '';
    expect(directoryFunction).toContain('RETURNS TABLE (organisation_id uuid, organisation_name text)');
    expect(directoryFunction).toContain("eligibility.status = 'verified'");
    expect(directoryFunction).toContain("organisation.status = 'active'");
    expect(directoryFunction).toContain('eligibility.valid_until');
    expect(directoryFunction).not.toMatch(/registry_identifier|evidence_reference|requested_by|learner_reference|first_name|last_name/i);
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION sentinel_private.list_verified_transfer_institutions() TO sentinel_learner_runtime');
    expect(directoryFunction).toContain("organisation.status = 'active'");
  });

  it('keeps learner and enrolment reads inside the authenticated RLS transaction', async () => {
    const source = await readFile(transferServicePath, 'utf8');
    expect(source).toContain('withAuthenticatedLearnerDb(actorUserId');
    expect(source).toContain('sentinel_private.list_verified_transfer_institutions()');
    const privilegedQuery = source.slice(source.indexOf('db.select(')).split(';', 1)[0];
    expect(privilegedQuery).toContain('.from(organisations)');
    expect(privilegedQuery).not.toContain('learnerEnrolments');
    expect(privilegedQuery).not.toContain('learnerTransferRequests');
  });
});
