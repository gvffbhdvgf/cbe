import { auth } from '@/lib/auth/server';
import { listLearnerRecordCorrections, submitLearnerRecordCorrection, type LearnerCorrectionField } from '@/application/learner/learner-correction-service';
import { mapLearnerApiError } from '@/application/learner/learner-errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fields = ['legal_first_name','legal_middle_name','legal_last_name','preferred_name','date_of_birth'] as const;

export async function GET(_request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  try { return Response.json({ requests: await listLearnerRecordCorrections(data.user.id, organisationId) }); }
  catch (error) { const mapped = mapLearnerApiError(error, 'Unable to load learner correction requests', 500); return Response.json({ error: mapped.message }, { status: mapped.status }); }
}

export async function POST(request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A valid JSON body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || !('learnerId' in body) || typeof body.learnerId !== 'string' || !uuidPattern.test(body.learnerId)
    || !('fieldKey' in body) || typeof body.fieldKey !== 'string' || !fields.includes(body.fieldKey as (typeof fields)[number])
    || !('proposedValue' in body) || !(typeof body.proposedValue === 'string' || body.proposedValue === null)
    || !('reason' in body) || typeof body.reason !== 'string') {
    return Response.json({ error: 'A learner, supported field, proposed value and reason are required' }, { status: 400 });
  }
  const evidenceReference = 'evidenceReference' in body && typeof body.evidenceReference === 'string' ? body.evidenceReference : null;
  try {
    const result = await submitLearnerRecordCorrection(data.user.id, organisationId, body.learnerId, body.fieldKey as LearnerCorrectionField, body.proposedValue, body.reason, evidenceReference);
    return Response.json({ requestId: result.id, status: 'pending' }, { status: 201 });
  } catch (error) { const mapped = mapLearnerApiError(error, 'Unable to submit learner correction request', 400); return Response.json({ error: mapped.message }, { status: mapped.status }); }
}
