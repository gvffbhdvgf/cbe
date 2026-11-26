import { auth } from '@/lib/auth/server';
import { updateClassCapacity } from '@/application/learner/class-service';
import { mapLearnerApiError } from '@/application/learner/learner-errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: { params: Promise<{ organisationId: string; classId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId, classId } = await context.params;
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(classId)) return Response.json({ error: 'Invalid organisation or class ID' }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A valid JSON body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || !('capacity' in body) || (body.capacity !== null && (typeof body.capacity !== 'number' || !Number.isInteger(body.capacity)))) {
    return Response.json({ error: 'Capacity must be a whole number or null for unlimited' }, { status: 400 });
  }
  try {
    const result = await updateClassCapacity(data.user.id, organisationId, classId, body.capacity as number | null);
    return Response.json(result);
  } catch (error) {
    const mapped = mapLearnerApiError(error, 'Unable to update class capacity', 400);
    return Response.json({ error: mapped.message }, { status: mapped.status });
  }
}
