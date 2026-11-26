import { auth } from '@/lib/auth/server';
import { AssessmentAccessError, AssessmentTransitionError, createAssessmentEvent, listAssessmentEvents } from '@/application/assessment/assessment-service';
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


export async function POST(request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  let body: unknown; try { body = await request.json(); } catch { return Response.json({ error: 'A JSON request body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid event details' }, { status: 400 });
  const value = body as Record<string, unknown>;
  if (typeof value.programmeId !== 'string' || !uuidPattern.test(value.programmeId)
    || typeof value.instrumentVersionId !== 'string' || !uuidPattern.test(value.instrumentVersionId)
    || typeof value.title !== 'string' || typeof value.startsAt !== 'string' || Number.isNaN(Date.parse(value.startsAt))
    || typeof value.endsAt !== 'string' || Number.isNaN(Date.parse(value.endsAt))
    || !Number.isInteger(value.academicYear) || typeof value.moderationRequired !== 'boolean') {
    return Response.json({ error: 'Valid programme, approved instrument, title, date window, academic year and moderation setting are required' }, { status: 400 });
  }
  try {
    const eventId = await createAssessmentEvent(data.user.id, organisationId, value.programmeId, value.instrumentVersionId, value.title, value.startsAt, value.endsAt, Number(value.academicYear), value.moderationRequired);
    return Response.json({ eventId, status: 'draft' }, { status: 201 });
  } catch (error) {
    if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Assessment data service is temporarily unavailable' }, { status: 503 });
    if (error instanceof AssessmentAccessError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof AssessmentTransitionError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Unable to create assessment event' }, { status: 500 });
  }
}
