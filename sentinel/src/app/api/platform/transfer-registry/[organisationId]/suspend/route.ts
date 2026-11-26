import { auth } from '@/lib/auth/server';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';
import { suspendTransferEligibility, TransferRegistryError } from '@/application/organisation/transfer-registry-service';

export async function POST(request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A JSON request body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || typeof (body as Record<string, unknown>).reason !== 'string') {
    return Response.json({ error: 'A suspension reason is required' }, { status: 400 });
  }
  try { return Response.json(await suspendTransferEligibility(data.user.id, organisationId, (body as Record<string, string>).reason)); }
  catch (error) {
    if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Transfer registry is temporarily unavailable' }, { status: 503 });
    if (error instanceof TransferRegistryError) return Response.json({ error: error.message }, { status: error.status });
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === '42501') return Response.json({ error: 'Active platform-administrator access is required.' }, { status: 403 });
    if (code === '23514') return Response.json({ error: error instanceof Error ? error.message : 'Only verified institutions can be suspended.' }, { status: 409 });
    return Response.json({ error: 'Unable to suspend institution transfer eligibility' }, { status: 500 });
  }
}
