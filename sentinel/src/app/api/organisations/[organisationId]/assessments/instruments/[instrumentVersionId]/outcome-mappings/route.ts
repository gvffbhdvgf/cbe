import { auth } from '@/lib/auth/server';
import {
  AssessmentAccessError,
  AssessmentTransitionError,
  createAssessmentTaskOutcomeMapping,
  getAssessmentInstrumentOutcomeMappings,
  getAssessmentInstrumentOutcomeOptions,
} from '@/application/assessment/assessment-service';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: { params: Promise<{ organisationId: string; instrumentVersionId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId, instrumentVersionId } = await context.params;
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(instrumentVersionId)) {
    return Response.json({ error: 'Invalid organisation or instrument ID' }, { status: 400 });
  }
  try {
    const [mappings, availableOutcomes] = await Promise.all([
      getAssessmentInstrumentOutcomeMappings(data.user.id, organisationId, instrumentVersionId),
      getAssessmentInstrumentOutcomeOptions(data.user.id, organisationId, instrumentVersionId),
    ]);
    return Response.json({ mappings, availableOutcomes });
  } catch (error) {
    if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Assessment data service is temporarily unavailable' }, { status: 503 });
    if (error instanceof AssessmentAccessError) return Response.json({ error: error.message }, { status: 403 });
    return Response.json({ error: 'Unable to load curriculum outcome mappings' }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ organisationId: string; instrumentVersionId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId, instrumentVersionId } = await context.params;
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(instrumentVersionId)) {
    return Response.json({ error: 'Invalid organisation or instrument ID' }, { status: 400 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A JSON request body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid mapping details' }, { status: 400 });
  const value = body as Record<string, unknown>;
  if (typeof value.taskId !== 'string' || !uuidPattern.test(value.taskId)
    || typeof value.curriculumSourceNodeId !== 'string' || !uuidPattern.test(value.curriculumSourceNodeId)) {
    return Response.json({ error: 'A valid task and approved curriculum outcome are required' }, { status: 400 });
  }
  try {
    const mappingId = await createAssessmentTaskOutcomeMapping(data.user.id, organisationId, instrumentVersionId, value.taskId, value.curriculumSourceNodeId);
    return Response.json({ mappingId, status: 'pending' }, { status: 201 });
  } catch (error) {
    if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Assessment data service is temporarily unavailable' }, { status: 503 });
    if (error instanceof AssessmentAccessError) return Response.json({ error: error.message }, { status: 403 });
    if (error instanceof AssessmentTransitionError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Unable to propose curriculum outcome mapping' }, { status: 500 });
  }
}
