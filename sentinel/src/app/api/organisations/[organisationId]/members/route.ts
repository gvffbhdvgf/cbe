import { auth } from '@/lib/auth/server';
import { grantOrganisationMembership, listOrganisationMembers } from '@/application/organisation/membership-service';
import type { OrganisationRole } from '@/application/organisation/membership-policy';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const roles = new Set<OrganisationRole>(['organisation_admin', 'school_admin', 'teacher', 'assessor', 'viewer']);

export async function GET(_request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  try {
    const members = await listOrganisationMembers(data.user.id, organisationId);
    return Response.json({ members });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load organisation members';
    return Response.json({ error: message }, { status: message.includes('permission') ? 403 : 400 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A valid JSON body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || !('email' in body) || typeof body.email !== 'string' || body.email.length > 254 || !/^\S+@\S+\.\S+$/.test(body.email.trim()) || !('role' in body) || typeof body.role !== 'string' || !roles.has(body.role as OrganisationRole)) {
    return Response.json({ error: 'Provide a valid account email and organisation role' }, { status: 400 });
  }
  try {
    const member = await grantOrganisationMembership(data.user.id, organisationId, body.email, body.role as OrganisationRole);
    return Response.json({ member }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to grant organisation membership';
    const status = message.includes('permission') || message.includes('role cannot') ? 403
      : message.includes('not found') || message.includes('verified') ? 404
      : message.includes('already has') ? 409 : 400;
    return Response.json({ error: message }, { status });
  }
}
