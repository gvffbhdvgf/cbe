import { auth } from '@/lib/auth/server';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';
import { LearnerTransferError, requestOrganisationTransferEligibility } from '@/application/learner/transfer-service';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A JSON request body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid transfer-eligibility request' }, { status: 400 });
  const value = body as Record<string, unknown>;
  if (typeof value.registryIssuer !== 'string' || typeof value.registryIdentifier !== 'string' || typeof value.submittedEvidenceReference !== 'string') {
    return Response.json({ error: 'Institution identifier type, identifier and evidence reference are required' }, { status: 400 });
  }
  try {
    return Response.json(await requestOrganisationTransferEligibility(data.user.id, organisationId, {
      registryIssuer: value.registryIssuer,
      registryIdentifier: value.registryIdentifier,
      submittedEvidenceReference: value.submittedEvidenceReference,
    }), { status: 201 });
  } catch (error) {
    if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Transfer registry is temporarily unavailable' }, { status: 503 });
    if (error instanceof LearnerTransferError) return Response.json({ error: error.message }, { status: error.status });
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === '23505') return Response.json({ error: 'This official identifier is already registered to another institution.' }, { status: 409 });
    if (code === '23514') return Response.json({ error: error instanceof Error ? error.message : 'A pending or verified eligibility request already exists.' }, { status: 409 });
    if (code === '42501') return Response.json({ error: 'Institution transfer administration authority is required.' }, { status: 403 });
    return Response.json({ error: 'Unable to submit institution transfer eligibility' }, { status: 500 });
  }
}
