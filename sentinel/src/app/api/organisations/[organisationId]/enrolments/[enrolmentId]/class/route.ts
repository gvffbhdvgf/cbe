import { auth } from '@/lib/auth/server';
import { placeLearnerInClass, reassignLearnerToClass } from '@/application/learner/class-placement-service';
import { mapLearnerApiError } from '@/application/learner/learner-errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: { params: Promise<{ organisationId: string; enrolmentId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId, enrolmentId } = await context.params;
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(enrolmentId)) {
    return Response.json({ error: 'Invalid organisation or enrolment ID' }, { status: 400 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A valid JSON body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || !('classId' in body) || typeof body.classId !== 'string' || ('effectiveAt' in body && typeof body.effectiveAt !== 'string')) {
    return Response.json({ error: 'A class ID and optional effective date are required' }, { status: 400 });
  }
  const effectiveAt = 'effectiveAt' in body && typeof body.effectiveAt === 'string'
    ? body.effectiveAt
    : new Date().toISOString().slice(0, 10);
  try {
    const placement = await placeLearnerInClass(data.user.id, organisationId, enrolmentId, {
      classId: body.classId,
      effectiveAt,
    });
    return Response.json({ placement });
  } catch (error) {
    const mapped = mapLearnerApiError(error, 'Unable to place learner in class', 400);
    return Response.json({ error: mapped.message }, { status: mapped.status });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ organisationId: string; enrolmentId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId, enrolmentId } = await context.params;
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(enrolmentId)) return Response.json({ error: 'Invalid organisation or enrolment ID' }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A valid JSON body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || !('classId' in body) || typeof body.classId !== 'string'
    || !('effectiveAt' in body) || typeof body.effectiveAt !== 'string' || !('reason' in body) || typeof body.reason !== 'string') {
    return Response.json({ error: 'Target class, effective date and reassignment reason are required' }, { status: 400 });
  }
  try {
    const placement = await reassignLearnerToClass(data.user.id, organisationId, enrolmentId, {
      classId: body.classId, effectiveAt: body.effectiveAt, reason: body.reason,
    });
    return Response.json({ placement });
  } catch (error) {
    const mapped = mapLearnerApiError(error, 'Unable to reassign learner to class', 400);
    return Response.json({ error: mapped.message }, { status: mapped.status });
  }
}
