import { auth } from '@/lib/auth/server';
import { setTeacherWorkloadPolicy, TeacherAssignmentError } from '@/application/organisation/teacher-assignment-service';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  let body: unknown; try { body = await request.json(); } catch { return Response.json({ error: 'A JSON request body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid workload policy' }, { status: 400 });
  const value = body as Record<string, unknown>;
  if (!Number.isInteger(value.academicYear) || !Number.isInteger(value.referenceWeeklyPeriods) || !Number.isInteger(value.maximumWeeklyPeriods)
    || (value.periodDurationMinutes !== null && !Number.isInteger(value.periodDurationMinutes)) || typeof value.effectiveFrom !== 'string' || typeof value.reason !== 'string') {
    return Response.json({ error: 'Workload thresholds, effective date and reason are required' }, { status: 400 });
  }
  try {
    const result = await setTeacherWorkloadPolicy(data.user.id, organisationId, value.academicYear as number, value.referenceWeeklyPeriods as number, value.maximumWeeklyPeriods as number, value.periodDurationMinutes as number | null, value.effectiveFrom, value.reason);
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Workload policy service is temporarily unavailable' }, { status: 503 });
    if (error instanceof TeacherAssignmentError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Unable to save workload policy' }, { status: 500 });
  }
}