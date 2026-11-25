import { auth } from '@/lib/auth/server';
import { AssessmentAccessError, listAssessmentEvents } from '@/application/assessment/assessment-service';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });

  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });

  try {
    const events = await listAssessmentEvents(data.user.id, organisationId);
    return Response.json({ events });
  } catch (error) {
    if (error instanceof LearnerAuthenticationError) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (error instanceof LearnerRlsUnavailableError) {
      return Response.json({ error: 'Assessment data service is temporarily unavailable' }, { status: 503 });
    }
    if (error instanceof AssessmentAccessError) {
      const notFound = error.message.includes('not found') || error.message.includes('inactive');
      return Response.json({ error: error.message }, { status: notFound ? 404 : 403 });
    }
    return Response.json({ error: 'Unable to load assessment events' }, { status: 500 });
  }
}

