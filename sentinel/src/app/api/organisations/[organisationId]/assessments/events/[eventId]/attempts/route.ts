import { auth } from '@/lib/auth/server';
import { AssessmentAccessError, AssessmentTransitionError, createAssessmentAttempt } from '@/application/assessment/assessment-service';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: { params: Promise<{ organisationId: string; eventId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId, eventId } = await context.params;
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(eventId)) return Response.json({ error: 'Invalid identifier' }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A JSON request body is required' }, { status: 400 }); }
  const enrolmentId = body && typeof body === 'object' && 'enrolmentId' in body ? body.enrolmentId : null;
  if (typeof enrolmentId !== 'string' || !uuidPattern.test(enrolmentId)) return Response.json({ error: 'A valid enrolmentId is required' }, { status: 400 });
  try {
    const attemptId = await createAssessmentAttempt(data.user.id, organisationId, eventId, enrolmentId);
    return Response.json({ attemptId, eventId, status: 'in_progress' }, { status: 201 });
  } catch (error) {
    if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Assessment data service is temporarily unavailable' }, { status: 503 });
    if (error instanceof AssessmentAccessError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof AssessmentTransitionError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Unable to create assessment attempt' }, { status: 500 });
  }
}
