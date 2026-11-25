import { auth } from '@/lib/auth/server';
import { AssessmentAccessError, AssessmentTransitionError, captureAssessmentResponse } from '@/application/assessment/assessment-service';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: { params: Promise<{ organisationId: string; attemptId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId, attemptId } = await context.params;
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(attemptId)) return Response.json({ error: 'Invalid identifier' }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A JSON request body is required' }, { status: 400 }); }
  const taskId = body && typeof body === 'object' && 'taskId' in body ? body.taskId : null;
  const response = body && typeof body === 'object' && 'response' in body ? body.response : null;
  if (typeof taskId !== 'string' || !uuidPattern.test(taskId) || !response || typeof response !== 'object' || Array.isArray(response)) {
    return Response.json({ error: 'A valid taskId and object response are required' }, { status: 400 });
  }
  try {
    const responseId = await captureAssessmentResponse(data.user.id, organisationId, attemptId, taskId, response as Record<string, unknown>);
    return Response.json({ responseId, attemptId }, { status: 201 });
  } catch (error) {
    if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Assessment data service is temporarily unavailable' }, { status: 503 });
    if (error instanceof AssessmentAccessError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof AssessmentTransitionError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Unable to capture assessment response' }, { status: 500 });
  }
}
