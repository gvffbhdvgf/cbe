import { auth } from '@/lib/auth/server';
import { getLearnerRecordCorrectionOverview, mapLearnerRecordCorrectionApiError } from '@/application/learner/record-correction-service';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  try {
    return Response.json(await getLearnerRecordCorrectionOverview(data.user.id, organisationId));
  } catch (error) {
    const mapped = mapLearnerRecordCorrectionApiError(error);
    return Response.json({ error: mapped.message }, { status: mapped.status });
  }
}
