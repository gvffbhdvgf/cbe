import { auth } from '@/lib/auth/server';
import { AssessmentAccessError, AssessmentTransitionError, createAssessmentProgramme } from '@/application/assessment/assessment-service';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  let body: unknown; try { body = await request.json(); } catch { return Response.json({ error: 'A JSON request body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid programme details' }, { status: 400 });
  const value = body as Record<string, unknown>;
  if (typeof value.programmeCode !== 'string' || typeof value.title !== 'string' || !['formative','summative','diagnostic'].includes(String(value.programmeType))) return Response.json({ error: 'Programme code, title and valid type are required' }, { status: 400 });
  try { const programmeId = await createAssessmentProgramme(data.user.id, organisationId, value.programmeCode, value.title, value.programmeType as 'formative'|'summative'|'diagnostic'); return Response.json({ programmeId }, { status: 201 }); }
  catch (error) { if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 }); if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Assessment data service is temporarily unavailable' }, { status: 503 }); if (error instanceof AssessmentAccessError) return Response.json({ error: error.message }, { status: 403 }); if (error instanceof AssessmentTransitionError) return Response.json({ error: error.message }, { status: error.status }); return Response.json({ error: 'Unable to create assessment programme' }, { status: 500 }); }
}
