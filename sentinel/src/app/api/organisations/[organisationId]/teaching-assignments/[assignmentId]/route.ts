import { auth } from '@/lib/auth/server';
import { reviseTeacherWeeklyWorkloadAllocation, revokeTeacherClassAssignment, TeacherAssignmentError } from '@/application/organisation/teacher-assignment-service';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(_request: Request, context: { params: Promise<{ organisationId: string; assignmentId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId, assignmentId } = await context.params;
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(assignmentId)) return Response.json({ error: 'Invalid assignment identifier' }, { status: 400 });
  try {
    return Response.json(await revokeTeacherClassAssignment(data.user.id, organisationId, assignmentId));
  } catch (error) {
    if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Teacher assignment service is temporarily unavailable' }, { status: 503 });
    if (error instanceof TeacherAssignmentError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Unable to revoke teacher assignment' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ organisationId: string; assignmentId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId, assignmentId } = await context.params;
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(assignmentId)) return Response.json({ error: 'Invalid assignment identifier' }, { status: 400 });
  let body: unknown; try { body = await request.json(); } catch { return Response.json({ error: 'A JSON request body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid workload revision' }, { status: 400 });
  const value = body as Record<string, unknown>;
  if (!Number.isInteger(value.weeklyPeriods) || typeof value.effectiveFrom !== 'string' || typeof value.reason !== 'string') {
    return Response.json({ error: 'Weekly periods, effective date and reason are required' }, { status: 400 });
  }
  try {
    return Response.json(await reviseTeacherWeeklyWorkloadAllocation(data.user.id, organisationId, assignmentId, value.weeklyPeriods as number, value.effectiveFrom, value.reason));
  } catch (error) {
    if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Teacher assignment service is temporarily unavailable' }, { status: 503 });
    if (error instanceof TeacherAssignmentError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Unable to revise weekly workload allocation' }, { status: 500 });
  }
}
