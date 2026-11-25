import { beforeAll, describe, expect, it } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { JWTVerifyGetKey } from 'jose';
import { verifyNeonAccessToken } from './learner-jwt';

const subject = '11111111-1111-4111-8111-111111111111';
const issuer = 'https://auth.example.test';
let privateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
let otherPrivateKey: Awaited<ReturnType<typeof generateKeyPair>>['privateKey'];
let jwks: JWTVerifyGetKey;

async function signToken(options: { sub?: string; iss?: string; exp?: number; key?: typeof privateKey } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: 'authenticated' })
    .setProtectedHeader({ alg: 'EdDSA', kid: 'sentinel-test-key' })
    .setIssuer(options.iss ?? issuer)
    .setSubject(options.sub ?? subject)
    .setIssuedAt(now)
    .setExpirationTime(options.exp ?? now + 120)
    .sign(options.key ?? privateKey);
}

beforeAll(async () => {
  const generated = await generateKeyPair('EdDSA');
  privateKey = generated.privateKey;
  otherPrivateKey = (await generateKeyPair('EdDSA')).privateKey;
  const publicJwk = await exportJWK(generated.publicKey);
  jwks = createLocalJWKSet({ keys: [{ ...publicJwk, kid: 'sentinel-test-key', alg: 'EdDSA', use: 'sig' }] });
});

describe('verifyNeonAccessToken', () => {
  it('rejects a missing token', async () => {
    await expect(verifyNeonAccessToken(null, jwks, issuer, subject)).rejects.toThrow('access token is required');
  });
  it('accepts a signed, unexpired token for the authenticated user', async () => {
    const payload = await verifyNeonAccessToken(await signToken(), jwks, issuer, subject);
    expect(payload.sub).toBe(subject);
    expect(payload.role).toBe('authenticated');
  });
  it('rejects malformed tokens', async () => {
    await expect(verifyNeonAccessToken('not.a.jwt', jwks, issuer, subject)).rejects.toThrow('invalid or expired');
  });
  it('rejects tokens signed by an untrusted key', async () => {
    await expect(verifyNeonAccessToken(await signToken({ key: otherPrivateKey }), jwks, issuer, subject)).rejects.toThrow('invalid or expired');
  });
  it('rejects a token from a different issuer', async () => {
    await expect(verifyNeonAccessToken(await signToken({ iss: 'https://attacker.example' }), jwks, issuer, subject)).rejects.toThrow('invalid or expired');
  });
  it('rejects expired tokens', async () => {
    const now = Math.floor(Date.now() / 1000);
    await expect(verifyNeonAccessToken(await signToken({ exp: now - 30 }), jwks, issuer, subject)).rejects.toThrow('invalid or expired');
  });
  it('rejects a non-UUID subject', async () => {
    await expect(verifyNeonAccessToken(await signToken({ sub: 'not-a-uuid' }), jwks, issuer, subject)).rejects.toThrow('no valid UUID subject');
  });
  it('rejects a token whose subject differs from the session user', async () => {
    const otherSubject = '22222222-2222-4222-8222-222222222222';
    await expect(verifyNeonAccessToken(await signToken({ sub: otherSubject }), jwks, issuer, subject)).rejects.toThrow('does not match');
  });
});
