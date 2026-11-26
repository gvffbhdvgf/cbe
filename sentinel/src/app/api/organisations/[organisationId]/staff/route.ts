import { auth } from '@/lib/auth/server';
import { createStaffProfile, getStaffManagementSummary, recordStaffAccountInvitation, StaffProfileError } from '@/application/organisation/staff-service';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function handleError(error: unknown) {
  if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Staff register is temporarily unavailable' }, { status: 503 });
  if (error instanceof StaffProfileError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: 'Unable to process staff register request' }, { status: 500 });
}

export async function GET(request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  try {
    const search = new URL(request.url).searchParams.get('personSearch') ?? '';
    return Response.json(await getStaffManagementSummary(data.user.id, organisationId, search));
  } catch (error) { return handleError(error); }
}

export async function POST(request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A JSON request body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid staff profile details' }, { status: 400 });
  const value = body as Record<string, unknown>;
  if (value.action === 'record-invitation') {
    if (typeof value.staffProfileId !== 'string' || typeof value.email !== 'string') {
      return Response.json({ error: 'Staff profile and account email are required' }, { status: 400 });
    }
    try {
      return Response.json(await recordStaffAccountInvitation(data.user.id, organisationId, value.staffProfileId, value.email));
    } catch (error) { return handleError(error); }
  }
  if ((value.personId !== null && typeof value.personId !== 'string')
    || typeof value.staffReference !== 'string' || typeof value.staffCategory !== 'string'
    || typeof value.jobTitle !== 'string' || typeof value.engagementType !== 'string'
    || typeof value.startsOn !== 'string' || (value.endsOn !== null && typeof value.endsOn !== 'string')
    || typeof value.confirmDistinctPerson !== 'boolean') {
    return Response.json({ error: 'Staff reference, category, job title, engagement type and effective start date are required' }, { status: 400 });
  }
  try {
    const result = await createStaffProfile(data.user.id, organisationId, {
      personId: value.personId as string | null,
      firstName: typeof value.firstName === 'string' ? value.firstName : null,
      middleName: typeof value.middleName === 'string' ? value.middleName : null,
      lastName: typeof value.lastName === 'string' ? value.lastName : null,
      preferredName: typeof value.preferredName === 'string' ? value.preferredName : null,
      staffReference: value.staffReference,
      staffCategory: value.staffCategory,
      jobTitle: value.jobTitle,
      engagementType: value.engagementType,
      startsOn: value.startsOn,
      endsOn: value.endsOn as string | null,
      confirmDistinctPerson: value.confirmDistinctPerson,
    });
    return Response.json(result, { status: 201 });
  } catch (error) { return handleError(error); }
}
