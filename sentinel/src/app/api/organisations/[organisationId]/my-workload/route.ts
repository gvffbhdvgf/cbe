import { auth } from '@/lib/auth/server';
import { getMyTeacherWorkloadSummary, TeacherAssignmentError } from '@/application/organisation/teacher-assignment-service';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  const year = Number(new URL(request.url).searchParams.get('academicYear') || new Date().getFullYear());
  try { return Response.json(await getMyTeacherWorkloadSummary(data.user.id, organisationId, year)); }
  catch (error) {
    if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Teacher workload is temporarily unavailable' }, { status: 503 });
    if (error instanceof TeacherAssignmentError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Unable to load your teaching workload' }, { status: 500 });
  }
}