import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0017_assessment_result_governance.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);

describe('assessment result governance migration contract', () => {
  it('registers migration 0017 in sequence', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries).toHaveLength(24);
    expect(journal.entries[17]).toMatchObject({ idx: 17, tag: '0017_assessment_result_governance' });
  });

  it('uses verified identity, tenant access and separate governance authority', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    for (const name of ['can_manage_assessment_governance', 'record_assessment_result_decision']) {
      const start = sql.indexOf(`CREATE FUNCTION sentinel_private.${name}`);
      expect(start).toBeGreaterThanOrEqual(0);
      const next = sql.indexOf('CREATE FUNCTION sentinel_private.', start + 1);
      const body = sql.slice(start, next < 0 ? sql.length : next);
      expect(body).toContain('SECURITY DEFINER');
      expect(body).toContain('sentinel_private.current_user_id()');
    }
    expect(sql).toContain('sentinel_private.can_access_assessment_data(');
    expect(sql).toContain('sentinel_private.can_manage_assessment_governance(');
    expect(sql).toContain("membership.role IN ('organisation_admin','school_admin')");
  });

  it('enforces moderation only when required and keeps moderation separate from approval', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain("p_decision_type IN ('moderation_approved','moderation_rejected')");
    expect(sql).toContain('NOT v_event.moderation_required');
    expect(sql).toContain('A marker cannot moderate their own assessment result');
    expect(sql).toContain('Moderation approval is required before result approval');
    expect(sql).toContain('The result approver must be independent of its marker and moderator');
  });

  it('requires approval before publication and independent publication authority', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain("v_latest_decision <> 'result_approved'");
    expect(sql).toContain('Only an approved result in an approved event can be published');
    expect(sql).toContain('The publisher must be independent of the marker and approver');
    expect(sql).toContain("SET status = 'published'");
  });

  it('derives result lifecycle state from append-only decisions instead of mutating result rows', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE OR REPLACE VIEW public.assessment_result_lifecycle');
    expect(sql).toContain('security_invoker = true');
    expect(sql).toContain('latest_decision_type');
    expect(sql).toContain('assessment.result_decision_recorded');
    expect(sql).not.toMatch(/UPDATE\s+public\.assessment_results/i);
    expect(sql).not.toMatch(/UPDATE\s+public\.assessment_result_decisions/i);
  });

  it('exposes decisions through one narrow function and a read-only lifecycle view', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('REVOKE ALL ON FUNCTION sentinel_private.record_assessment_result_decision(uuid, text, text) FROM PUBLIC');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION sentinel_private.record_assessment_result_decision(uuid, text, text) TO sentinel_learner_runtime');
    expect(sql).toContain('REVOKE ALL ON TABLE public.assessment_result_lifecycle FROM PUBLIC, sentinel_learner_runtime');
    expect(sql).toContain('GRANT SELECT ON TABLE public.assessment_result_lifecycle TO sentinel_learner_runtime');
  });
});
