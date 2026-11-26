import { auth } from '@/lib/auth/server';
import {
  acceptLearnerTransfer, cancelLearnerTransfer, completeLearnerTransfer, getTransferManagementSummary,
  LearnerTransferError, rejectLearnerTransfer, releaseLearnerTransfer, requestLearnerTransfer,
} from '@/application/learner/transfer-service';
import { LearnerAuthenticationError, LearnerRlsUnavailableError } from '@/domain/learner/errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isText = (value: unknown): value is string => typeof value === 'string';

function handleError(error: unknown) {
  if (error instanceof LearnerAuthenticationError) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (error instanceof LearnerRlsUnavailableError) return Response.json({ error: 'Learner transfer service is temporarily unavailable' }, { status: 503 });
  if (error instanceof LearnerTransferError) return Response.json({ error: error.message }, { status: error.status });
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === '42501') return Response.json({ error: 'Institution transfer-management authority is required.' }, { status: 403 });
  if (code === '23514') return Response.json({ error: error instanceof Error ? error.message : 'The receiving institution is not eligible for this transfer.' }, { status: 409 });
  if (code === '22023') return Response.json({ error: error instanceof Error ? error.message : 'Transfer details are invalid.' }, { status: 400 });
  if (code === 'P0002') return Response.json({ error: error instanceof Error ? error.message : 'Institution or transfer not found.' }, { status: 404 });
  return Response.json({ error: 'Unable to process learner transfer request' }, { status: 500 });
}

export async function GET(_request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  try { return Response.json(await getTransferManagementSummary(data.user.id, organisationId)); }
  catch (error) { return handleError(error); }
}

export async function POST(request: Request, context: { params: Promise<{ organisationId: string }> }) {
  const { data } = await auth.getSession();
  if (!data?.user) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { organisationId } = await context.params;
  if (!uuidPattern.test(organisationId)) return Response.json({ error: 'Invalid organisation ID' }, { status: 400 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'A JSON request body is required' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return Response.json({ error: 'Invalid learner transfer request' }, { status: 400 });
  const value = body as Record<string, unknown>;

  try {
    if (value.action === 'request') {
      if (!isText(value.sourceEnrolmentId) || !isText(value.receivingOrganisationId) || typeof value.destinationGrade !== 'number'
        || typeof value.destinationAcademicYear !== 'number' || !isText(value.effectiveAt) || !isText(value.reasonCode)) {
        return Response.json({ error: 'Source enrolment, receiving institution, destination grade/year, effective date and reason are required' }, { status: 400 });
      }
      return Response.json(await requestLearnerTransfer(data.user.id, organisationId, {
        sourceEnrolmentId: value.sourceEnrolmentId, receivingOrganisationId: value.receivingOrganisationId,
        destinationGrade: value.destinationGrade, destinationAcademicYear: value.destinationAcademicYear,
        effectiveAt: value.effectiveAt, reasonCode: value.reasonCode,
      }), { status: 201 });
    }
    if (!isText(value.transferId)) return Response.json({ error: 'A transfer identifier is required' }, { status: 400 });
    if (value.action === 'accept') return Response.json(await acceptLearnerTransfer(data.user.id, organisationId, value.transferId));
    if (value.action === 'cancel') return Response.json(await cancelLearnerTransfer(data.user.id, organisationId, value.transferId));
    if (value.action === 'release') return Response.json(await releaseLearnerTransfer(data.user.id, organisationId, value.transferId));
    if (value.action === 'reject') {
      if (!isText(value.rejectionCode)) return Response.json({ error: 'A rejection code is required' }, { status: 400 });
      return Response.json(await rejectLearnerTransfer(data.user.id, organisationId, value.transferId, value.rejectionCode));
    }
    if (value.action === 'complete') {
      if (!isText(value.learnerId) || !isText(value.enrolmentId)) return Response.json({ error: 'Destination learner and enrolment are required' }, { status: 400 });
      return Response.json(await completeLearnerTransfer(data.user.id, organisationId, value.transferId, value.learnerId, value.enrolmentId));
    }
    return Response.json({ error: 'Unknown learner transfer action' }, { status: 400 });
  } catch (error) { return handleError(error); }
}
