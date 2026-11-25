import { Pool } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { createRemoteJWKSet } from 'jose';
import { auth } from '@/lib/auth/server';
import * as schema from './schema';
import { verifyNeonAccessToken } from './learner-jwt';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/application/learner/learner-errors';

function createLearnerDatabase() {
  const connectionString = process.env.DATABASE_AUTHENTICATED_URL;
  if (!connectionString) throw new LearnerRlsUnavailableError();
  return drizzle(new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: true,
  }), { schema });
}

type LearnerDatabase = ReturnType<typeof createLearnerDatabase>;
export type LearnerTransaction = Parameters<Parameters<LearnerDatabase['transaction']>[0]>[0];

let database: LearnerDatabase | undefined;
let cachedJwksUrl: string | undefined;
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function getJwks(url: string) {
  if (cachedJwks && cachedJwksUrl === url) return cachedJwks;
  cachedJwks = createRemoteJWKSet(new URL(url));
  cachedJwksUrl = url;
  return cachedJwks;
}

async function getVerifiedClaims(expectedSubject: string) {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const jwksUrl = process.env.NEON_AUTH_JWKS_URL;
  if (!baseUrl || !jwksUrl) throw new LearnerRlsUnavailableError();

  // @neon/auth 0.8.2 exposes the server JWT endpoint at runtime, but its generated
  // NeonAuthServer declaration currently types this plugin method as unknown.
  const tokenMethod = auth.token as unknown as (() => Promise<{ data?: { token?: string } | null; error?: unknown }>);
  if (typeof tokenMethod !== 'function') throw new LearnerRlsUnavailableError();
  const { data, error } = await tokenMethod.call(auth);
  if (error || !data?.token) throw new LearnerAuthenticationError();

  let issuer: string;
  try {
    issuer = new URL(baseUrl).origin;
    new URL(jwksUrl);
  } catch {
    throw new LearnerRlsUnavailableError();
  }

  return verifyNeonAccessToken(data.token, getJwks(jwksUrl), issuer, expectedSubject);
}

export async function withAuthenticatedLearnerDb<T>(
  actorUserId: string,
  work: (tx: LearnerTransaction) => Promise<T>,
): Promise<T> {
  if (!process.env.DATABASE_AUTHENTICATED_URL) {
    throw new LearnerRlsUnavailableError();
  }

  const claims = await getVerifiedClaims(actorUserId);
  database ??= createLearnerDatabase();

  return database.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`);
    const identity = await tx.execute(sql`SELECT sentinel_private.current_user_id() AS user_id`);
    if (identity.rows[0]?.user_id !== actorUserId) {
      throw new Error('The database did not establish the verified learner identity');
    }
    return work(tx);
  });
}
