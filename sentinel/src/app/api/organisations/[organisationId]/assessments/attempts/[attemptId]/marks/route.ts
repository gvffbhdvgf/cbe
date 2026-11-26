import { auth } from '@/lib/auth/server';
import { AssessmentAccessError, AssessmentTransitionError, recordAssessmentMark } from '@/application/assessment/assessment-service';
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
  const awardedScore = body && typeof body === 'object' && 'awardedScore' in body ? body.awardedScore : null;
  const markerNote = body && typeof body === 'object' && 'markerNote' in body ? body.markerNote : null;
  const supersedesMarkId = body && typeof body === 'object' && 'supersedesMarkId' in body ? body.supersedesMarkId : null;
  if (typeof taskId !== 'string' || !uuidPattern.test(taskId) || typeof awardedScore !== 'number' || !Number.isFinite(awardedScore)) {
    return Response.json({ error: 'A valid taskId and finite awardedScore are required' }, { status: 400 });
  }
  if (markerNote !== null && typeof markerNote !== 'string') return Response.json({ error: 'markerNote must be a string or null' }, { status: 400 });
  if (supersedesMarkId !== null && (typeof supersedesMarkId !== 'string' || !uuidPattern.test(supersedesMarkId))) {
    return Response.json({ error: 'supersedesMarkId must be a valid UUID or null' }, { status: 400 });
  }
  try {
    const markId = await recordAssessmentMark(data.user.id, organisationId, attemptId, taskId, awardedScore, markerNote, supersedesMarkId);
    return Response.json({ markId, attemptId, taskId }, { status: 201 });
  } catch (error) {
    if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Assessment data service is temporarily unavailable' }, { status: 503 });
    if (error instanceof AssessmentAccessError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof AssessmentTransitionError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Unable to record assessment mark' }, { status: 500 });
  }
}
