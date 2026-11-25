import { describe, expect, it } from 'vitest';
import {
  LearnerAuthenticationError,
  LearnerRlsUnavailableError,
  mapLearnerApiError,
} from './learner-errors';

describe('learner API error mapping', () => {
  it('returns 503 without exposing connection configuration details', () => {
    expect(mapLearnerApiError(new LearnerRlsUnavailableError(), 'fallback', 500)).toEqual({
      message: 'Learner data service is temporarily unavailable',
      status: 503,
    });
  });

  it('returns 401 for missing or invalid learner identity', () => {
    expect(mapLearnerApiError(new LearnerAuthenticationError(), 'fallback', 500).status).toBe(401);
  });

  it('returns 403 for an organisation permission failure', () => {
    expect(mapLearnerApiError(new Error('You do not have permission'), 'fallback', 500).status).toBe(403);
  });

  it('returns 409 for a duplicate class or record constraint', () => {
    expect(mapLearnerApiError({ code: '23505' }, 'fallback', 400).status).toBe(409);
  });

  it('returns 403 when PostgreSQL rejects an RLS-protected write', () => {
    expect(mapLearnerApiError({ code: '42501' }, 'fallback', 500).status).toBe(403);
  });

  it('returns the caller-selected default for unclassified errors', () => {
    expect(mapLearnerApiError(new Error('Invalid grade'), 'fallback', 400).status).toBe(400);
    expect(mapLearnerApiError(new Error('Unexpected database error'), 'fallback', 500).status).toBe(500);
  });
});
