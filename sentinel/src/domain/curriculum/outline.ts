export type CurriculumOutlineRecord = {
  id: string; parentId: string | null; nodeType: string; nodeCode: string; title: string;
  sourcePage: number | null; displayOrder: number; extractionStatus: string; notes: string | null;
};
export type CurriculumOutlineNode = CurriculumOutlineRecord & { children: CurriculumOutlineNode[] };
function compareNodes(left: CurriculumOutlineRecord, right: CurriculumOutlineRecord) {
  return left.displayOrder - right.displayOrder || left.nodeCode.localeCompare(right.nodeCode);
}
/** Builds a display tree without dropping orphaned or cyclic source records. */
export function buildCurriculumOutline(records: CurriculumOutlineRecord[]): CurriculumOutlineNode[] {
  const ordered = [...records].sort(compareNodes);
  const byId = new Map(ordered.map((record) => [record.id, record]));
  const childrenByParent = new Map<string, CurriculumOutlineRecord[]>();
  for (const record of ordered) {
    if (!record.parentId || !byId.has(record.parentId) || record.parentId === record.id) continue;
    const children = childrenByParent.get(record.parentId) ?? [];
    children.push(record);
    childrenByParent.set(record.parentId, children);
  }
  const visited = new Set<string>();
  const build = (record: CurriculumOutlineRecord, ancestors: Set<string>): CurriculumOutlineNode => {
    if (ancestors.has(record.id) || visited.has(record.id)) return { ...record, children: [] };
    visited.add(record.id);
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(record.id);
    const children = (childrenByParent.get(record.id) ?? [])
      .filter((child) => !nextAncestors.has(child.id))
      .map((child) => build(child, nextAncestors));
    return { ...record, children };
  };
  const roots = ordered.filter((record) => !record.parentId || !byId.has(record.parentId) || record.parentId === record.id);
  const result = roots.map((record) => build(record, new Set()));
  // A disconnected cycle has no natural root. Keep it visible as a root entry.
  for (const record of ordered) if (!visited.has(record.id)) result.push(build(record, new Set()));
  return result;
}
