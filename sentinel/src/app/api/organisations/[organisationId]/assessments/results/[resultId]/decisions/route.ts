import { auth } from '@/lib/auth/server';
import { AssessmentAccessError, AssessmentTransitionError, recordAssessmentResultDecision } from '@/application/assessment/assessment-service';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const decisionTypes = ['moderation_approved', 'moderation_rejected', 'correction_requested', 'result_approved', 'result_published'] as const;

export async function POST(request: Request, context: { params: Promise<{ organisationId: string; resultId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId, resultId } = await context.params;
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(resultId)) return Response.json({ error: 'Invalid identifier' }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A JSON request body is required' }, { status: 400 }); }
  const decisionType = body && typeof body === 'object' && 'decisionType' in body ? body.decisionType : null;
  const reason = body && typeof body === 'object' && 'reason' in body ? body.reason : null;
  if (typeof decisionType !== 'string' || !decisionTypes.includes(decisionType as (typeof decisionTypes)[number]) || typeof reason !== 'string' || !reason.trim()) {
    return Response.json({ error: 'A supported decisionType and non-empty reason are required' }, { status: 400 });
  }
  try {
    const decisionId = await recordAssessmentResultDecision(data.user.id, organisationId, resultId, decisionType as (typeof decisionTypes)[number], reason.trim());
    return Response.json({ decisionId, resultId, decisionType }, { status: 201 });
  } catch (error) {
    if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Assessment data service is temporarily unavailable' }, { status: 503 });
    if (error instanceof AssessmentAccessError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof AssessmentTransitionError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Unable to record assessment result decision' }, { status: 500 });
  }
}
