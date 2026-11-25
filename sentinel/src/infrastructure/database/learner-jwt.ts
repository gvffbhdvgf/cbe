import { jwtVerify, type JWTVerifyGetKey, type JWTPayload } from 'jose';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function verifyNeonAccessToken(
  token: string | null | undefined,
  jwks: JWTVerifyGetKey,
  issuer: string,
  expectedSubject: string,
): Promise<JWTPayload> {
  if (!token) throw new Error('A Neon Auth access token is required');
  if (!issuer) throw new Error('Neon Auth issuer is not configured');
  if (!uuidPattern.test(expectedSubject)) throw new Error('The authenticated user ID is invalid');

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, jwks, { issuer }));
  } catch {
    throw new Error('The Neon Auth access token is invalid or expired');
  }

  if (typeof payload.sub !== 'string' || !uuidPattern.test(payload.sub)) {
    throw new Error('The Neon Auth access token has no valid UUID subject');
  }
  if (payload.sub !== expectedSubject) {
    throw new Error('The Neon Auth access token does not match the authenticated session');
  }

  return payload;
}
