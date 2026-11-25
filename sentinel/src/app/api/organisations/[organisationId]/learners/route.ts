import { auth } from '@/lib/auth/server';
import { listLearners, registerLearner } from '@/application/learner/learner-service';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  try {
    const learners = await listLearners(data.user.id, organisationId);
    return Response.json({ learners });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load learner register';
    return Response.json({ error: message }, { status: message.includes('permission') ? 403 : 404 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A valid JSON body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || !('firstName' in body) || typeof body.firstName !== 'string' || !('lastName' in body) || typeof body.lastName !== 'string' || !('grade' in body) || typeof body.grade !== 'number' || !('academicYear' in body) || typeof body.academicYear !== 'number') {
    return Response.json({ error: 'First name, last name, grade and academic year are required' }, { status: 400 });
  }
  const optionalString = (key: string) => key in body && typeof body[key as keyof typeof body] === 'string' ? body[key as keyof typeof body] as string : undefined;
  try {
    const learner = await registerLearner(data.user.id, organisationId, {
      firstName: body.firstName,
      middleName: optionalString('middleName'),
      lastName: body.lastName,
      preferredName: optionalString('preferredName'),
      dateOfBirth: optionalString('dateOfBirth'),
      grade: body.grade,
      academicYear: body.academicYear,
    });
    return Response.json({ learner }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to register learner';
    return Response.json({ error: message }, { status: message.includes('permission') ? 403 : message.includes('not found') ? 404 : 400 });
  }
}
