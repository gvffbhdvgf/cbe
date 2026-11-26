import { auth } from '@/lib/auth/server';
import {
  createGuardianRelationship, getGuardianManagementSummary, GuardianManagementError,
  linkGuardianAccount, reviewGuardianProfile, reviewGuardianRelationship, revokeGuardianRelationship,
} from '@/application/organisation/guardian-service';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isText = (value: unknown): value is string => typeof value === 'string';
const optionalText = (value: unknown) => isText(value) && value.trim() ? value.trim() : null;

function handleError(error: unknown) {
  if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Guardian register is temporarily unavailable' }, { status: 503 });
  if (error instanceof GuardianManagementError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: 'Unable to process guardian register request' }, { status: 500 });
}

export async function GET(request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  try {
    const search = new URL(request.url).searchParams.get('personSearch') ?? '';
    return Response.json(await getGuardianManagementSummary(data.user.id, organisationId, search));
  } catch (error) { return handleError(error); }
}

export async function POST(request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A JSON request body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid guardian request' }, { status: 400 });
  const value = body as Record<string, unknown>;

  try {
    if (value.action === 'create') {
      if (!isText(value.learnerId) || (value.personId !== null && !isText(value.personId))
        || !isText(value.relationshipType) || !isText(value.startsOn)
        || (value.endsOn !== null && !isText(value.endsOn)) || typeof value.confirmDistinctPerson !== 'boolean') {
        return Response.json({ error: 'Learner, relationship type and effective start date are required' }, { status: 400 });
      }
      return Response.json(await createGuardianRelationship(data.user.id, organisationId, {
        learnerId: value.learnerId, personId: value.personId as string | null,
        firstName: optionalText(value.firstName), middleName: optionalText(value.middleName),
        lastName: optionalText(value.lastName), preferredName: optionalText(value.preferredName),
        contactEmail: optionalText(value.contactEmail), relationshipType: value.relationshipType,
        startsOn: value.startsOn, endsOn: value.endsOn as string | null,
        confirmDistinctPerson: value.confirmDistinctPerson,
      }), { status: 201 });
    }
    if (value.action === 'review-profile') {
      if (!isText(value.profileId) || !isText(value.decision) || !isText(value.method) || !isText(value.evidenceReference)) {
        return Response.json({ error: 'Profile, decision, method and evidence reference are required' }, { status: 400 });
      }
      return Response.json(await reviewGuardianProfile(data.user.id, organisationId, value.profileId, {
        decision: value.decision, method: value.method, evidenceReference: value.evidenceReference,
        rejectionReason: optionalText(value.rejectionReason),
      }));
    }
    if (value.action === 'review-relationship') {
      if (!isText(value.relationshipId) || !isText(value.decision) || !isText(value.method) || !isText(value.evidenceReference)
        || typeof value.canViewProgress !== 'boolean' || typeof value.canReceiveMessages !== 'boolean') {
        return Response.json({ error: 'Relationship review details are incomplete' }, { status: 400 });
      }
      return Response.json(await reviewGuardianRelationship(data.user.id, organisationId, value.relationshipId, {
        decision: value.decision, method: value.method, evidenceReference: value.evidenceReference,
        rejectionReason: optionalText(value.rejectionReason), canViewProgress: value.canViewProgress,
        canReceiveMessages: value.canReceiveMessages,
      }));
    }
    if (value.action === 'link-account') {
      if (!isText(value.profileId) || !isText(value.email)) return Response.json({ error: 'Guardian profile and verified account email are required' }, { status: 400 });
      return Response.json(await linkGuardianAccount(data.user.id, organisationId, value.profileId, value.email));
    }
    if (value.action === 'revoke-relationship') {
      if (!isText(value.relationshipId) || !isText(value.reason)) return Response.json({ error: 'Relationship and revocation reason are required' }, { status: 400 });
      return Response.json(await revokeGuardianRelationship(data.user.id, organisationId, value.relationshipId, value.reason));
    }
    return Response.json({ error: 'Unknown guardian register action' }, { status: 400 });
  } catch (error) { return handleError(error); }
}
