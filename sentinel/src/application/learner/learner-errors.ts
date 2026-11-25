import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '../../domain/learner/errors';

export { LearnerAuthenticationError, LearnerRlsUnavailableError };

export function mapLearnerApiError(
  error: unknown,
  fallback: string,
  defaultStatus: number,
): { message: string; status: number } {
  if (error instanceof LearnerRlsUnavailableError) {
    return { message: 'Learner data service is temporarily unavailable', status: 503 };
  }
  if (error instanceof LearnerAuthenticationError) {
    return { message: 'Authentication required', status: 401 };
  }
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === '23505') return { message: 'A record with these details already exists', status: 409 };
  if (code === '42501') return { message: 'You do not have permission to perform this operation', status: 403 };
  const message = error instanceof Error ? error.message : fallback;
  if (message.toLowerCase().includes('permission')) return { message, status: 403 };
  if (message.toLowerCase().includes('not found') || message.toLowerCase().includes('inactive')) {
    return { message, status: 404 };
  }
  return { message, status: defaultStatus };
}
