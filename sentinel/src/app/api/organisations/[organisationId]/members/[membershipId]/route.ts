import { auth } from '@/lib/auth/server';
import { revokeOrganisationMembership } from '@/application/organisation/membership-service';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(_request: Request, context: { params: Promise<{ organisationId: string; membershipId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId, membershipId } = await context.params;
  if (!uuidPattern.test(organisationId) || !uuidPattern.test(membershipId)) return Response.json({ error: 'Invalid organisation or membership ID' }, { status: 400 });
  try {
    const membership = await revokeOrganisationMembership(data.user.id, organisationId, membershipId);
    return Response.json({ membership });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to revoke organisation membership';
    const status = message.includes('permission') || message.includes('role cannot') ? 403
      : message.includes('not found') ? 404
      : message.includes('last active') || message.includes('not active') ? 409 : 400;
    return Response.json({ error: message }, { status });
  }
}
