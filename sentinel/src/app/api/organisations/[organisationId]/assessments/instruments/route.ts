import { auth } from '@/lib/auth/server';
import { AssessmentAccessError, AssessmentTransitionError, createAssessmentInstrumentVersion } from '@/application/assessment/assessment-service';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const responseTypes = ['text','numeric','boolean','choice','observation','evidence'] as const;
export async function POST(request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession(); if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params; if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  let body: unknown; try { body = await request.json(); } catch { return Response.json({ error: 'A JSON request body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid instrument details' }, { status: 400 });
  const value = body as Record<string, unknown>;
  if (typeof value.curriculumGradeOfferingId !== 'string' || !uuidPattern.test(value.curriculumGradeOfferingId) || typeof value.instrumentCode !== 'string' || typeof value.title !== 'string' || !Array.isArray(value.tasks) || value.tasks.length < 1 || value.tasks.length > 100) return Response.json({ error: 'Instrument details and 1–100 tasks are required' }, { status: 400 });
  const tasks = value.tasks.map((item, index) => {
    if (!item || typeof item !== 'object') return null;
    const task = item as Record<string, unknown>;
    if (typeof task.taskCode !== 'string' || typeof task.title !== 'string' || !responseTypes.includes(task.responseType as typeof responseTypes[number]) || typeof task.maximumScore !== 'number' || !Number.isFinite(task.maximumScore) || typeof task.required !== 'boolean') return null;
    return { taskCode: task.taskCode, title: task.title, responseType: task.responseType as typeof responseTypes[number], maximumScore: task.maximumScore, required: task.required, displayOrder: index };
  });
  if (tasks.some(task => task === null) || !tasks.some(task => task?.required)) return Response.json({ error: 'Each task must be valid and at least one task must be required' }, { status: 400 });
  try { const instrumentVersionId = await createAssessmentInstrumentVersion(data.user.id, organisationId, value.curriculumGradeOfferingId, value.instrumentCode, value.title, tasks as NonNullable<(typeof tasks)[number]>[]); return Response.json({ instrumentVersionId, status: 'draft' }, { status: 201 }); }
  catch (error) { if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 }); if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Assessment data service is temporarily unavailable' }, { status: 503 }); if (error instanceof AssessmentAccessError) return Response.json({ error: error.message }, { status: 403 }); if (error instanceof AssessmentTransitionError) return Response.json({ error: error.message }, { status: error.status }); return Response.json({ error: 'Unable to create assessment instrument' }, { status: 500 }); }
}
