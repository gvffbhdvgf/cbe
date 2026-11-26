export type LearnerRecordCorrectionChanges = {
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  preferredName?: string | null;
  dateOfBirth?: string | null;
};

export type LearnerRecordCorrectionInput = LearnerRecordCorrectionChanges & {
  reason: string;
  evidenceReference?: string | null;
};

const supportedFields = new Set(['firstName', 'middleName', 'lastName', 'preferredName', 'dateOfBirth']);
const allowedFields = new Set([...supportedFields, 'reason', 'evidenceReference']);

function normaliseName(value: unknown, label: string, required: boolean): string | null {
  if (value === null && !required) return null;
  if (typeof value !== 'string') throw new Error(`${label} must be text`);
  const normalised = value.trim();
  if (!normalised) {
    if (required) throw new Error(`${label} cannot be blank`);
    return null;
  }
  if (normalised.length > 120) throw new Error(`${label} must be 120 characters or fewer`);
  return normalised;
}

function normaliseDateOfBirth(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string') throw new Error('Date of birth must be a valid YYYY-MM-DD date');
  const dateOfBirth = value.trim();
  if (!dateOfBirth) return null;
  const parsed = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dateOfBirth) || dateOfBirth.startsWith('0000-')
    || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateOfBirth) {
    throw new Error('Date of birth must be a valid YYYY-MM-DD date');
  }
  return dateOfBirth;
}

export function createLearnerRecordCorrection(input: unknown): {
  changes: LearnerRecordCorrectionChanges;
  reason: string;
  evidenceReference: string | null;
} {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('A learner correction request is required');
  }
  const value = input as Record<string, unknown>;
  for (const key of Object.keys(value)) {
    if (!allowedFields.has(key)) throw new Error(`Unsupported learner correction field: ${key}`);
  }

  const changes: LearnerRecordCorrectionChanges = {};
  if ('firstName' in value) changes.firstName = normaliseName(value.firstName, 'First name', true)!;
  if ('middleName' in value) changes.middleName = normaliseName(value.middleName, 'Middle name', false);
  if ('lastName' in value) changes.lastName = normaliseName(value.lastName, 'Last name', true)!;
  if ('preferredName' in value) changes.preferredName = normaliseName(value.preferredName, 'Preferred name', false);
  if ('dateOfBirth' in value) changes.dateOfBirth = normaliseDateOfBirth(value.dateOfBirth);

  if (Object.keys(changes).length === 0) {
    throw new Error('At least one supported identity field must be supplied');
  }

  if (typeof value.reason !== 'string') throw new Error('A correction reason of 10 to 500 characters is required');
  const reason = value.reason.trim();
  if (reason.length < 10 || reason.length > 500) {
    throw new Error('A correction reason of 10 to 500 characters is required');
  }

  let evidenceReference: string | null = null;
  if (value.evidenceReference !== undefined && value.evidenceReference !== null) {
    if (typeof value.evidenceReference !== 'string') throw new Error('Evidence reference must be text');
    evidenceReference = value.evidenceReference.trim() || null;
    if (evidenceReference && (evidenceReference.length < 3 || evidenceReference.length > 180)) {
      throw new Error('Evidence reference must be between 3 and 180 characters');
    }
  }

  return { changes, reason, evidenceReference };
}
