import { and, asc, eq, ne, sql } from 'drizzle-orm';
import { db } from '@/infrastructure/database/client';
import { organisations } from '@/infrastructure/database/schema/organisation';
import { learnerEnrolments, learnerProfiles, learnerTransferRequests, learnerTransferSourceLinks, people } from '@/infrastructure/database/schema/learner';
import { requireLearnerManager } from '@/application/learner/learner-service';
import { withAuthenticatedLearnerDb, type LearnerTransaction } from '@/infrastructure/database/learner-rls-client';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const reasonCodes = ['family_relocation','school_change','placement_change','other'] as const;
const rejectionCodes = ['not_eligible','missing_documentation','capacity_unavailable','other'] as const;
const dateOnly = (value: Date | string | null) => value === null ? null : value instanceof Date ? value.toISOString().slice(0,10) : value.slice(0,10);

export class LearnerTransferError extends Error {
  readonly status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.name = 'LearnerTransferError';
    this.status = status;
  }
}

async function assertTransferManager(actorUserId: string, organisationId: string) {
  try { await requireLearnerManager(actorUserId, organisationId); }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Learner transfer is not authorised';
    throw new LearnerTransferError(message, message.includes('not found') ? 404 : 403);
  }
}

export async function getTransferManagementSummary(actorUserId: string, organisationId: string) {
  await assertTransferManager(actorUserId, organisationId);
  if (!uuidPattern.test(organisationId)) throw new LearnerTransferError('A valid organisation identifier is required', 400);
  const [organisation] = await db.select({ id: organisations.id, name: organisations.name, timeZone: organisations.timeZone })
    .from(organisations).where(and(eq(organisations.id, organisationId), eq(organisations.status, 'active'))).limit(1);
  if (!organisation) throw new LearnerTransferError('Organisation not found or inactive', 404);

  const [activeEnrolments, otherOrganisations, outgoing, incoming] = await Promise.all([
    db.select({
      enrolmentId: learnerEnrolments.id, learnerId: learnerProfiles.id, learnerReference: learnerProfiles.learnerReference,
      firstName: people.legalFirstName, lastName: people.legalLastName, preferredName: people.preferredName,
      grade: learnerEnrolments.grade, academicYear: learnerEnrolments.academicYear,
      startsAt: learnerEnrolments.startsAt, endsAt: learnerEnrolments.endsAt,
    }).from(learnerEnrolments)
      .innerJoin(learnerProfiles, and(eq(learnerEnrolments.learnerId, learnerProfiles.id), eq(learnerEnrolments.tenantOrganisationId, learnerProfiles.tenantOrganisationId)))
      .innerJoin(people, and(eq(learnerProfiles.personId, people.id), eq(learnerProfiles.tenantOrganisationId, people.tenantOrganisationId)))
      .where(and(eq(learnerEnrolments.organisationId, organisationId), eq(learnerEnrolments.status, 'active'), eq(learnerProfiles.status, 'active')))
      .orderBy(asc(learnerProfiles.learnerReference)),
    db.select({ id: organisations.id, name: organisations.name }).from(organisations)
      .where(and(eq(organisations.status, 'active'), ne(organisations.id, organisationId)))
      .orderBy(asc(organisations.name)),
    db.select({
      id: learnerTransferRequests.id, transferReference: learnerTransferRequests.transferReference,
      receivingOrganisationId: learnerTransferRequests.receivingOrganisationId, receivingOrganisationName: organisations.name,
      sourceGrade: learnerTransferRequests.sourceGrade, destinationGrade: learnerTransferRequests.destinationGrade,
      destinationAcademicYear: learnerTransferRequests.destinationAcademicYear, effectiveAt: learnerTransferRequests.effectiveAt,
      reasonCode: learnerTransferRequests.reasonCode, status: learnerTransferRequests.status,
      requestedAt: learnerTransferRequests.requestedAt, learnerId: learnerTransferSourceLinks.sourceLearnerId,
      sourceEnrolmentId: learnerTransferSourceLinks.sourceEnrolmentId, learnerReference: learnerProfiles.learnerReference,
      firstName: people.legalFirstName, lastName: people.legalLastName, preferredName: people.preferredName,
    }).from(learnerTransferRequests)
      .innerJoin(learnerTransferSourceLinks, eq(learnerTransferSourceLinks.transferRequestId, learnerTransferRequests.id))
      .innerJoin(organisations, eq(learnerTransferRequests.receivingOrganisationId, organisations.id))
      .innerJoin(learnerProfiles, eq(learnerTransferSourceLinks.sourceLearnerId, learnerProfiles.id))
      .innerJoin(people, eq(learnerProfiles.personId, people.id))
      .where(eq(learnerTransferRequests.sendingOrganisationId, organisationId))
      .orderBy(asc(learnerTransferRequests.requestedAt)),
    db.select({
      id: learnerTransferRequests.id, transferReference: learnerTransferRequests.transferReference,
      sendingOrganisationName: organisations.name, sourceGrade: learnerTransferRequests.sourceGrade,
      destinationGrade: learnerTransferRequests.destinationGrade, destinationAcademicYear: learnerTransferRequests.destinationAcademicYear,
      effectiveAt: learnerTransferRequests.effectiveAt, reasonCode: learnerTransferRequests.reasonCode,
      status: learnerTransferRequests.status, rejectionCode: learnerTransferRequests.rejectionCode,
      requestedAt: learnerTransferRequests.requestedAt,
    }).from(learnerTransferRequests)
      .innerJoin(organisations, eq(learnerTransferRequests.sendingOrganisationId, organisations.id))
      .where(eq(learnerTransferRequests.receivingOrganisationId, organisationId))
      .orderBy(asc(learnerTransferRequests.requestedAt)),
  ]);

  return {
    organisation,
    activeEnrolments: activeEnrolments.map(row => ({ ...row, startsAt: dateOnly(row.startsAt)!, endsAt: dateOnly(row.endsAt) })),
    otherOrganisations,
    outgoing: outgoing.map(row => ({ ...row, effectiveAt: dateOnly(row.effectiveAt)!, requestedAt: row.requestedAt.toISOString() })),
    incoming: incoming.map(row => ({ ...row, effectiveAt: dateOnly(row.effectiveAt)!, requestedAt: row.requestedAt.toISOString() })),
  };
}

async function callTransferFunction<T extends Record<string, unknown>>(
  actorUserId: string, organisationId: string, query: (tx: LearnerTransaction) => Promise<T>,
) {
  await assertTransferManager(actorUserId, organisationId);
  if (!uuidPattern.test(organisationId)) throw new LearnerTransferError('A valid organisation identifier is required', 400);
  return withAuthenticatedLearnerDb(actorUserId, query);
}

export async function requestLearnerTransfer(actorUserId: string, sendingOrganisationId: string, input: {
  sourceEnrolmentId: string; receivingOrganisationId: string; destinationGrade: number;
  destinationAcademicYear: number; effectiveAt: string; reasonCode: string;
}) {
  if (!uuidPattern.test(input.sourceEnrolmentId) || !uuidPattern.test(input.receivingOrganisationId)
    || !Number.isInteger(input.destinationGrade) || input.destinationGrade < 1 || input.destinationGrade > 9
    || !Number.isInteger(input.destinationAcademicYear) || input.destinationAcademicYear < 2000 || input.destinationAcademicYear > 2100
    || !datePattern.test(input.effectiveAt) || !reasonCodes.includes(input.reasonCode as typeof reasonCodes[number])) {
    throw new LearnerTransferError('Valid source enrolment, receiving institution, destination grade/year, effective date and reason are required', 400);
  }
  return callTransferFunction(actorUserId, sendingOrganisationId, async tx => {
    const result = await tx.execute(sql`SELECT sentinel_private.request_learner_transfer(
      ${sendingOrganisationId}::uuid, ${input.sourceEnrolmentId}::uuid, ${input.receivingOrganisationId}::uuid,
      ${input.destinationGrade}::integer, ${input.destinationAcademicYear}::integer,
      ${input.effectiveAt}::date, ${input.reasonCode}::text
    ) AS transfer_request_id`);
    const id = result.rows[0]?.transfer_request_id;
    if (!id) throw new LearnerTransferError('The database did not confirm the transfer request');
    return { transferRequestId: id };
  });
}

export async function acceptLearnerTransfer(actorUserId: string, organisationId: string, transferId: string) {
  return transferAction(actorUserId, organisationId, transferId, 'accept_learner_transfer');
}
export async function cancelLearnerTransfer(actorUserId: string, organisationId: string, transferId: string) {
  return transferAction(actorUserId, organisationId, transferId, 'cancel_learner_transfer');
}
export async function releaseLearnerTransfer(actorUserId: string, organisationId: string, transferId: string) {
  return transferAction(actorUserId, organisationId, transferId, 'release_learner_transfer');
}
async function transferAction(actorUserId: string, organisationId: string, transferId: string, fn: string) {
  if (!uuidPattern.test(transferId)) throw new LearnerTransferError('A valid transfer identifier is required', 400);
  return callTransferFunction(actorUserId, organisationId, async tx => {
    await tx.execute(sql`SELECT sentinel_private.${sql.raw(fn)}(${organisationId}::uuid, ${transferId}::uuid)`);
    return { transferRequestId: transferId };
  });
}

export async function rejectLearnerTransfer(actorUserId: string, organisationId: string, transferId: string, rejectionCode: string) {
  if (!uuidPattern.test(transferId) || !rejectionCodes.includes(rejectionCode as typeof rejectionCodes[number])) {
    throw new LearnerTransferError('A valid transfer and rejection code are required', 400);
  }
  return callTransferFunction(actorUserId, organisationId, async tx => {
    await tx.execute(sql`SELECT sentinel_private.reject_learner_transfer(${organisationId}::uuid,${transferId}::uuid,${rejectionCode}::text)`);
    return { transferRequestId: transferId, rejected: true };
  });
}

export async function completeLearnerTransfer(actorUserId: string, organisationId: string, transferId: string, learnerId: string, enrolmentId: string) {
  if (![transferId, learnerId, enrolmentId].every(v => uuidPattern.test(v))) throw new LearnerTransferError('Valid transfer, learner and enrolment identifiers are required', 400);
  return callTransferFunction(actorUserId, organisationId, async tx => {
    await tx.execute(sql`SELECT sentinel_private.complete_learner_transfer(
      ${organisationId}::uuid,${transferId}::uuid,${learnerId}::uuid,${enrolmentId}::uuid
    )`);
    return { transferRequestId: transferId, learnerId, completed: true };
  });
}
