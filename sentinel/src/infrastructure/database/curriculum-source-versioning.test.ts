import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const migration = new URL('./migrations/0011_grade6_cre_revised_source.sql', import.meta.url);

describe('Grade 6 CRE revised source registration', () => {
  it('registers the official revised 2024 PDF without approving its rights or content', async () => {
    const sql = await readFile(migration, 'utf8');
    expect(sql).toContain('CRE-GRADE-6-DESIGN-Revised.pdf');
    expect(sql).toContain('First Published in 2021');
    expect(sql).toContain('Revised 2024');
    expect(sql).toContain("'not_assessed'");
    expect(sql).toContain("'pending'");
  });

  it('preserves the older June 2024 document as a separate historical source', async () => {
    const sql = await readFile(migration, 'utf8');
    expect(sql).toContain("WHERE document_code = 'KICD-CRE-G6-2024-PDF'");
    expect(sql).toContain('Retained for historical comparison');
  });

  it('indexes headings only and does not import outcome body text', async () => {
    const sql = await readFile(migration, 'utf8');
    expect(sql).toContain("'Christian Living'");
    expect(sql).toContain("'Jacob wrestles an Angel'");
    expect(sql).toContain("'heading_only'");
    expect(sql).toContain('No specific learning outcome');
    expect(sql).not.toMatch(/INSERT INTO public\.curriculum_source_nodes[^;]*source_text/i);
  });

  it('keeps the catalogue browser on the newest document record for a grade and area', async () => {
    const service = await readFile(new URL('../../application/curriculum/catalogue-service.ts', import.meta.url), 'utf8');
    expect(service).toContain('desc(curriculumDesignDocuments.createdAt)');
  });
});
