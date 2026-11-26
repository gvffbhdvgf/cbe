import { auth } from '@/lib/auth/server';
import { AssessmentAccessError, getAssessmentAttemptMarkingSheet } from '@/application/assessment/assessment-service';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: { params: Promise<{ organisationId: string; attemptId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId, attemptId } = await context.params;
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(attemptId)) return Response.json({ error: 'Invalid identifier' }, { status: 400 });
  try {
    const tasks = await getAssessmentAttemptMarkingSheet(data.user.id, organisationId, attemptId);
    if (tasks.length === 0) return Response.json({ error: 'Assessment attempt not found' }, { status: 404 });
    return Response.json({ attemptId, tasks });
  } catch (error) {
    if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Assessment data service is temporarily unavailable' }, { status: 503 });
    if (error instanceof AssessmentAccessError) return Response.json({ error: error.message }, { status: 403 });
    return Response.json({ error: 'Unable to retrieve assessment marking sheet' }, { status: 500 });
  }
}
