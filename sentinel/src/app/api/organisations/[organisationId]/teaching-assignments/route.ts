import { auth } from '@/lib/auth/server';
import { createTeacherClassAssignment, getTeacherAssignmentManagementSummary, TeacherAssignmentError } from '@/application/organisation/teacher-assignment-service';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  try { return Response.json(await getTeacherAssignmentManagementSummary(data.user.id, organisationId)); }
  catch (error) {
    if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Teacher assignment service is temporarily unavailable' }, { status: 503 });
    if (error instanceof TeacherAssignmentError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Unable to load teacher assignments' }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  let body: unknown; try { body = await request.json(); } catch { return Response.json({ error: 'A JSON request body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid teacher assignment details' }, { status: 400 });
  const value = body as Record<string, unknown>;
  if (typeof value.teacherUserId !== 'string' || typeof value.classId !== 'string' || typeof value.learningAreaId !== 'string'
    || typeof value.startsOn !== 'string' || (value.endsOn !== null && typeof value.endsOn !== 'string')
    || !Number.isInteger(value.weeklyPeriods) || typeof value.workloadReason !== 'string') {
    return Response.json({ error: 'Teacher, class, learning area and effective start date are required' }, { status: 400 });
  }
  try {
    const result = await createTeacherClassAssignment(data.user.id, organisationId, value.teacherUserId, value.classId,
      value.learningAreaId, value.startsOn, value.endsOn as string | null, value.weeklyPeriods as number, value.workloadReason as string);
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Teacher assignment service is temporarily unavailable' }, { status: 503 });
    if (error instanceof TeacherAssignmentError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Unable to create teacher assignment' }, { status: 500 });
  }
}
