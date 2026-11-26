import { auth } from '@/lib/auth/server';
import { createLearnerRecordCorrectionRequest, mapLearnerRecordCorrectionApiError } from '@/application/learner/record-correction-service';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: { params: Promise<{ organisationId: string; learnerId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId, learnerId } = await context.params;
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(learnerId)) {
    return Response.json({ error: 'Invalid organisation or learner ID' }, { status: 400 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A valid JSON body is required' }, { status: 400 }); }
  try {
    return Response.json(await createLearnerRecordCorrectionRequest(data.user.id, organisationId, learnerId, body), { status: 201 });
  } catch (error) {
    const mapped = mapLearnerRecordCorrectionApiError(error);
    return Response.json({ error: mapped.message }, { status: mapped.status });
  }
}
