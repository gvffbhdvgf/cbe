import { auth } from '@/lib/auth/server';
import { mapLearnerRecordCorrectionApiError, reviewLearnerRecordCorrection } from '@/application/learner/record-correction-service';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: { params: Promise<{ organisationId: string; correctionId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId, correctionId } = await context.params;
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(correctionId)) {
    return Response.json({ error: 'Invalid organisation or correction-request ID' }, { status: 400 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A valid JSON body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Response.json({ error: 'A correction decision and review reason are required' }, { status: 400 });
  }
  const value = body as Record<string, unknown>;
  if (typeof value.decision !== 'string' || typeof value.reason !== 'string') {
    return Response.json({ error: 'A correction decision and review reason are required' }, { status: 400 });
  }
  try {
    return Response.json(await reviewLearnerRecordCorrection(data.user.id, organisationId, correctionId, value.decision, value.reason));
  } catch (error) {
    const mapped = mapLearnerRecordCorrectionApiError(error);
    return Response.json({ error: mapped.message }, { status: mapped.status });
  }
}
