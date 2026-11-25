import { auth } from '@/lib/auth/server';
import { isPlatformAdministrator, listAccessibleOrganisations, registerOrganisation } from '@/application/organisation/organisation-service';

export async function GET() {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const organisations = await listAccessibleOrganisations(data.user.id);
  return Response.json({ organisations });
}

export async function POST(request: Request) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!await isPlatformAdministrator(data.user.id)) {
    return Response.json({ error: 'Platform administrator access is required' }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A valid JSON body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || !('name' in body) || typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 240) {
    return Response.json({ error: 'Organisation name must be between 2 and 240 characters' }, { status: 400 });
  }
  const externalIdentifier = 'externalIdentifier' in body ? body.externalIdentifier : undefined;
  if (externalIdentifier !== undefined && (!externalIdentifier || typeof externalIdentifier !== 'object' || !('issuer' in externalIdentifier) || !('value' in externalIdentifier) || typeof externalIdentifier.issuer !== 'string' || typeof externalIdentifier.value !== 'string')) {
    return Response.json({ error: 'External identifier must include a text issuer and value' }, { status: 400 });
  }
  try {
    const organisation = await registerOrganisation(data.user.id, {
      name: body.name,
      externalIdentifier: externalIdentifier as { issuer: string; value: string } | undefined,
    });
    return Response.json({ organisation }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to register organisation';
    if (message.includes('unique') || message.includes('duplicate')) return Response.json({ error: 'That external identifier is already registered' }, { status: 409 });
    return Response.json({ error: message }, { status: 400 });
  }
}
