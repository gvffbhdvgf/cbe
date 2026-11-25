import { jwtVerify, type JWTVerifyGetKey, type JWTPayload } from 'jose';
import { LearnerAuthenticationError } from '@/application/learner/learner-errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function verifyNeonAccessToken(
  token: string | null | undefined,
  jwks: JWTVerifyGetKey,
  issuer: string,
  expectedSubject: string,
): Promise<JWTPayload> {
  if (!token) throw new LearnerAuthenticationError();
  if (!issuer) throw new LearnerAuthenticationError('Neon Auth issuer is not configured');
  if (!uuidPattern.test(expectedSubject)) throw new LearnerAuthenticationError('The authenticated user ID is invalid');

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, jwks, { issuer }));
  } catch {
    throw new LearnerAuthenticationError('The Neon Auth access token is invalid or expired');
  }

  if (typeof payload.sub !== 'string' || !uuidPattern.test(payload.sub)) {
    throw new LearnerAuthenticationError('The Neon Auth access token has no valid UUID subject');
  }
  if (payload.sub !== expectedSubject) {
    throw new LearnerAuthenticationError('The Neon Auth access token does not match the authenticated session');
  }

  return payload;
}
