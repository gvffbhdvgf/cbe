export type LearnerRegistrationInput = {
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName?: string;
  dateOfBirth?: string;
  grade: number;
  academicYear: number;
};

export function createLearnerRegistration(input: LearnerRegistrationInput, now = new Date()) {
  const firstName = input.firstName.trim();
  const middleName = input.middleName?.trim() || null;
  const lastName = input.lastName.trim();
  const preferredName = input.preferredName?.trim() || null;
  if (!firstName || !lastName) throw new Error('Learner first and last names are required');
  for (const [label, value] of [['First name', firstName], ['Middle name', middleName], ['Last name', lastName], ['Preferred name', preferredName]] as const) {
    if (value && value.length > 120) throw new Error(`${label} must be 120 characters or fewer`);
  }
  if (!Number.isInteger(input.grade) || input.grade < 1 || input.grade > 9) throw new Error('Grade must be an integer from 1 to 9');
  if (!Number.isInteger(input.academicYear) || input.academicYear < 2000 || input.academicYear > 2100) throw new Error('Academic year must be between 2000 and 2100');

  const dateOfBirth = input.dateOfBirth?.trim() || null;
  if (dateOfBirth) {
    const parsed = new Date(`${dateOfBirth}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateOfBirth) {
      throw new Error('Date of birth must be a valid YYYY-MM-DD date');
    }
    if (parsed > new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))) throw new Error('Date of birth cannot be in the future');
  }

  return { firstName, middleName, lastName, preferredName, dateOfBirth, grade: input.grade, academicYear: input.academicYear };
}
