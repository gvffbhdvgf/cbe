import { connection } from 'next/server';
import { auth } from '@/lib/auth/server';
import { getGuardianPortalSummary } from '@/application/guardian/guardian-portal-service';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';

export async function GET() {
  await connection();
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  try {
    return Response.json({ learners: await getGuardianPortalSummary(data.user.id) });
  } catch (error) {
    if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Guardian portal is temporarily unavailable' }, { status: 503 });
    return Response.json({ error: 'Unable to load verified guardian relationships' }, { status: 500 });
  }
}
