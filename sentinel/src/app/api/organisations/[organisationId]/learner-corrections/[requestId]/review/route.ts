import { auth } from '@/lib/auth/server';
import { reviewLearnerRecordCorrection } from '@/application/learner/learner-correction-service';
import { mapLearnerApiError } from '@/application/learner/learner-errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: { params: Promise<{ organisationId: string; requestId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId, requestId } = await context.params;
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(requestId)) return Response.json({ error: 'Invalid identifier' }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A valid JSON body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || !('decision' in body) || !['approved','rejected'].includes(String(body.decision)) || !('reviewReason' in body) || typeof body.reviewReason !== 'string') {
    return Response.json({ error: 'A supported decision and review reason are required' }, { status: 400 });
  }
  try {
    const result = await reviewLearnerRecordCorrection(data.user.id, organisationId, requestId, body.decision as 'approved'|'rejected', body.reviewReason);
    return Response.json({ requestId: result.id, decision: body.decision });
  } catch (error) { const mapped = mapLearnerApiError(error, 'Unable to review learner correction request', 400); return Response.json({ error: mapped.message }, { status: mapped.status }); }
}
