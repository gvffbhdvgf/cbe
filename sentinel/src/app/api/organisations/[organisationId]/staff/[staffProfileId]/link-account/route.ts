import { auth } from '@/lib/auth/server';
import { linkStaffAccount, StaffProfileError } from '@/application/organisation/staff-service';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: { params: Promise<{ organisationId: string; staffProfileId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId, staffProfileId } = await context.params;
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(staffProfileId)) return Response.json({ error: 'Invalid organisation or staff profile ID' }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A JSON request body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || typeof (body as Record<string, unknown>).userId !== 'string') return Response.json({ error: 'A verified Teacher account is required' }, { status: 400 });
  try {
    return Response.json(await linkStaffAccount(data.user.id, organisationId, staffProfileId, (body as Record<string, string>).userId));
  } catch (error) {
    if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
    if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Staff register is temporarily unavailable' }, { status: 503 });
    if (error instanceof StaffProfileError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: 'Unable to link the Teacher account' }, { status: 500 });
  }
}
