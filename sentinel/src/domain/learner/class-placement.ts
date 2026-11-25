const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ClassPlacementInput = { classId: string; effectiveAt: string };

export function createClassPlacement(input: ClassPlacementInput) {
  if (!uuidPattern.test(input.classId)) throw new Error('A valid class ID is required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveAt)) throw new Error('Effective date must use YYYY-MM-DD');
  const parsed = new Date(`${input.effectiveAt}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== input.effectiveAt) {
    throw new Error('Effective date must be a real calendar date');
  }
  return { classId: input.classId, effectiveAt: input.effectiveAt };
}
