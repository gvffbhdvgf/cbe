import { auth } from '@/lib/auth/server';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';
import { getTransferRegistryQueue, TransferRegistryError } from '@/application/organisation/transfer-registry-service';

export async function GET() {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  try { return Response.json(await getTransferRegistryQueue(data.user.id)); }
  catch (error) {
    if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Transfer registry is temporarily unavailable' }, { status: 503 });
    if (error instanceof TransferRegistryError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Unable to load the institution transfer registry' }, { status: 500 });
  }
}
