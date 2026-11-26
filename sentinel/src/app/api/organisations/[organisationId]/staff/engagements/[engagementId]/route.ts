import { auth } from '@/lib/auth/server';
import { endStaffEngagement, StaffProfileError } from '@/application/organisation/staff-service';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: { params: Promise<{ organisationId: string; engagementId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId, engagementId } = await context.params;
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(engagementId)) return Response.json({ error: 'Invalid organisation or engagement ID' }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A JSON request body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || typeof (body as Record<string, unknown>).endsOn !== 'string') return Response.json({ error: 'An engagement end date is required' }, { status: 400 });
  try {
    return Response.json(await endStaffEngagement(data.user.id, organisationId, engagementId, (body as Record<string, string>).endsOn));
  } catch (error) {
    if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Staff register is temporarily unavailable' }, { status: 503 });
    if (error instanceof StaffProfileError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Unable to update staff engagement' }, { status: 500 });
  }
}
