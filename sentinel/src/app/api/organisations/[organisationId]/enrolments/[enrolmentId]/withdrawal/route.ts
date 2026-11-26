import { auth } from '@/lib/auth/server';
import { withdrawLearnerEnrolment } from '@/application/learner/class-placement-service';
import { mapLearnerApiError } from '@/application/learner/learner-errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: { params: Promise<{ organisationId: string; enrolmentId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId, enrolmentId } = await context.params;
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(enrolmentId)) return Response.json({ error: 'Invalid organisation or enrolment ID' }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A valid JSON body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || !('withdrawalDate' in body) || typeof body.withdrawalDate !== 'string'
    || !('reason' in body) || typeof body.reason !== 'string') {
    return Response.json({ error: 'Withdrawal date and reason are required' }, { status: 400 });
  }
  try {
    const result = await withdrawLearnerEnrolment(data.user.id, organisationId, enrolmentId, body.withdrawalDate, body.reason);
    return Response.json({ withdrawal: result });
  } catch (error) {
    const mapped = mapLearnerApiError(error, 'Unable to withdraw learner', 400);
    return Response.json({ error: mapped.message }, { status: mapped.status });
  }
}
