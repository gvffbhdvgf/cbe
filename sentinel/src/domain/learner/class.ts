export type ClassCreationInput = {
  grade: number;
  academicYear: number;
  classCode: string;
  displayName: string;
  capacity?: number | null;
};

export function createClassDefinition(input: ClassCreationInput) {
  const classCode = input.classCode.trim().toUpperCase();
  const displayName = input.displayName.trim();

  if (!Number.isInteger(input.grade) || input.grade < 1 || input.grade > 9) {
    throw new Error('Grade must be an integer from 1 to 9');
  }
  if (!Number.isInteger(input.academicYear) || input.academicYear < 2000 || input.academicYear > 2100) {
    throw new Error('Academic year must be between 2000 and 2100');
  }
  if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(classCode)) {
    throw new Error('Class code must use 1–40 letters, numbers, hyphens or underscores');
  }
  if (input.capacity !== undefined && input.capacity !== null && (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 500)) {
    throw new Error('Class capacity must be an integer from 1 to 500, or left empty for unlimited');
  }
  if (!displayName) throw new Error('Class name is required');
  if (displayName.length > 120) throw new Error('Class name must be 120 characters or fewer');

  return { grade: input.grade, academicYear: input.academicYear, classCode, displayName, capacity: input.capacity ?? null };
}
