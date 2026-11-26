import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const migrationPath = new URL('./migrations/0024_curriculum_pathway_grade_levels.sql', import.meta.url);
const journalPath = new URL('./migrations/meta/_journal.json', import.meta.url);

describe('adapted curriculum pathway grade coverage migration', () => {
  it('registers the grade coverage migration after learner lifecycle transitions', async () => {
    const journal = JSON.parse(await readFile(journalPath, 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
    expect(journal.entries).toHaveLength(25);
    expect(journal.entries[24]).toMatchObject({ idx: 24, tag: '0024_curriculum_pathway_grade_levels' });
  });

  it('records source-backed grade coverage without inferring adapted learning outcomes', async () => {
    const sql = await readFile(migrationPath, 'utf8');
    expect(sql).toContain('CREATE TABLE public.curriculum_pathway_grade_levels');
    expect(sql).toContain('UNIQUE (edition_id, pathway_id, grade)');
    expect(sql).toContain('CHECK (grade BETWEEN 1 AND 9)');
    expect(sql).toContain("availability_status IN ('document_listed','document_available','awaiting_publication','catalogue_discrepancy','not_confirmed')");
    expect(sql).toContain("p.pathway_code IN ('adapted_hearing_impairment','adapted_physical_impairment','adapted_visual_impairment')");
    expect(sql).toContain('CROSS JOIN generate_series(1,9)');
    expect(sql).toContain("'document_listed'");
    expect(sql).toContain('no regular-curriculum outcomes are inferred');
    expect(sql).toContain('ON CONFLICT (edition_id,pathway_id,grade) DO UPDATE');
  });
});
