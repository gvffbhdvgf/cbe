import { describe, expect, it } from 'vitest';
import { buildCurriculumOutline, type CurriculumOutlineRecord } from './outline';
const node = (overrides: Partial<CurriculumOutlineRecord> & Pick<CurriculumOutlineRecord, 'id' | 'nodeCode' | 'title'>): CurriculumOutlineRecord => ({
  parentId: null, nodeType: 'strand', sourcePage: 1, displayOrder: 0, extractionStatus: 'catalogued', notes: null, ...overrides,
});
describe('curriculum outline', () => {
  it('nests sub-strands under their source strand and preserves source ordering', () => {
    const outline = buildCurriculumOutline([
      node({ id: 'sub-2', parentId: 'strand-1', nodeType: 'sub_strand', nodeCode: '1.2', title: 'Second', displayOrder: 2 }),
      node({ id: 'strand-1', nodeCode: '1.0', title: 'Creation', displayOrder: 1 }),
      node({ id: 'sub-1', parentId: 'strand-1', nodeType: 'sub_strand', nodeCode: '1.1', title: 'First', displayOrder: 1 }),
    ]);
    expect(outline).toHaveLength(1);
    expect(outline[0].title).toBe('Creation');
    expect(outline[0].children.map((item) => item.title)).toEqual(['First', 'Second']);
  });
  it('keeps orphaned nodes visible instead of silently dropping them', () => {
    const outline = buildCurriculumOutline([node({ id: 'orphan', parentId: 'missing-parent', nodeType: 'sub_strand', nodeCode: '9.1', title: 'Orphan' })]);
    expect(outline).toHaveLength(1);
    expect(outline[0].title).toBe('Orphan');
  });
  it('terminates safely when malformed source relationships contain a cycle', () => {
    const outline = buildCurriculumOutline([
      node({ id: 'a', parentId: 'b', nodeCode: '1', title: 'A' }),
      node({ id: 'b', parentId: 'a', nodeCode: '2', title: 'B' }),
    ]);
    expect(outline).toHaveLength(1);
    expect(outline[0].children).toHaveLength(1);
  });
});
