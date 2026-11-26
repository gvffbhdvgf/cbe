import { auth } from '@/lib/auth/server';
import { AssessmentAccessError, AssessmentTransitionError, approveAssessmentInstrumentVersion } from '@/application/assessment/assessment-service';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(_request: Request, context: { params: Promise<{ organisationId: string; instrumentVersionId: string }> }) {
  const { data } = await auth.getSession(); if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId, instrumentVersionId } = await context.params; if (!uuidPattern.test(organisationId) || !uuidPattern.test(instrumentVersionId)) return Response.json({ error: 'Invalid identifier' }, { status: 400 });
  try { const approvedAt = await approveAssessmentInstrumentVersion(data.user.id, organisationId, instrumentVersionId); return Response.json({ instrumentVersionId, status: 'approved', approvedAt }); }
  catch (error) { if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 }); if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Assessment data service is temporarily unavailable' }, { status: 503 }); if (error instanceof AssessmentAccessError) return Response.json({ error: error.message }, { status: 403 }); if (error instanceof AssessmentTransitionError) return Response.json({ error: error.message }, { status: error.status }); return Response.json({ error: 'Unable to approve assessment instrument' }, { status: 500 }); }
}
