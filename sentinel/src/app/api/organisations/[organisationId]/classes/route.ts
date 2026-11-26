import { auth } from '@/lib/auth/server';
import { createClass, listClasses } from '@/application/learner/class-service';
import { mapLearnerApiError } from '@/application/learner/learner-errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  try {
    const classes = await listClasses(data.user.id, organisationId);
    return Response.json({ classes });
  } catch (error) {
    const mapped = mapLearnerApiError(error, 'Unable to load class register', 500);
    return Response.json({ error: mapped.message }, { status: mapped.status });
  }
}

export async function POST(request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A valid JSON body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || !('grade' in body) || typeof body.grade !== 'number' || !('academicYear' in body) || typeof body.academicYear !== 'number' || !('classCode' in body) || typeof body.classCode !== 'string' || !('displayName' in body) || typeof body.displayName !== 'string') {
    return Response.json({ error: 'Grade, academic year, class code and class name are required' }, { status: 400 });
  }
  try {
    const classRecord = await createClass(data.user.id, organisationId, {
      grade: body.grade,
      academicYear: body.academicYear,
      classCode: body.classCode,
      displayName: body.displayName,
      capacity: 'capacity' in body && typeof body.capacity === 'number' ? body.capacity : null,
    });
    return Response.json({ class: classRecord }, { status: 201 });
  } catch (error) {
    const mapped = mapLearnerApiError(error, 'Unable to create class', 400);
    return Response.json({ error: mapped.message }, { status: mapped.status });
  }
}
