import { auth } from '@/lib/auth/server';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';
import { reviewTransferEligibility, TransferRegistryError } from '@/application/organisation/transfer-registry-service';

export async function POST(request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A JSON request body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid institution review' }, { status: 400 });
  const value = body as Record<string, unknown>;
  try {
    return Response.json(await reviewTransferEligibility(data.user.id, organisationId, {
      decision: String(value.decision ?? ''),
      verificationMethod: typeof value.verificationMethod === 'string' ? value.verificationMethod : null,
      reviewEvidenceReference: typeof value.reviewEvidenceReference === 'string' ? value.reviewEvidenceReference : null,
      validUntil: typeof value.validUntil === 'string' ? value.validUntil : null,
      rejectionReason: typeof value.rejectionReason === 'string' ? value.rejectionReason : null,
    }));
  } catch (error) {
    if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Transfer registry is temporarily unavailable' }, { status: 503 });
    if (error instanceof TransferRegistryError) return Response.json({ error: error.message }, { status: error.status });
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === '42501') return Response.json({ error: 'An independent active platform administrator is required.' }, { status: 403 });
    if (code === '23514') return Response.json({ error: error instanceof Error ? error.message : 'Only pending eligibility requests can be reviewed.' }, { status: 409 });
    return Response.json({ error: 'Unable to review institution eligibility' }, { status: 500 });
  }
}
