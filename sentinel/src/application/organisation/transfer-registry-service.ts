import { asc, eq, sql } from 'drizzle-orm';
import { isPlatformAdministrator } from '@/application/organisation/organisation-service';
import { organisations } from '@/infrastructure/database/schema/organisation';
import { organisationTransferEligibility } from '@/infrastructure/database/schema/security';
import { withAuthenticatedLearnerDb } from '@/infrastructure/database/learner-rls-client';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const methods = ['official_registry','official_certificate','authority_confirmation','other'] as const;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export class TransferRegistryError extends Error {
  readonly status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.name = 'TransferRegistryError';
    this.status = status;
  }
}

async function assertPlatformAdministrator(actorUserId: string) {
  if (!await isPlatformAdministrator(actorUserId)) {
    throw new TransferRegistryError('Active platform-administrator access is required', 403);
  }
}

function assertOrganisationId(organisationId: string) {
  if (!uuidPattern.test(organisationId)) throw new TransferRegistryError('A valid organisation identifier is required', 400);
}

export async function getTransferRegistryQueue(actorUserId: string) {
  await assertPlatformAdministrator(actorUserId);
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const rows = await tx.select({
      organisationId: organisationTransferEligibility.organisationId,
      organisationName: organisations.name,
      organisationStatus: organisations.status,
      organisationTimeZone: organisations.timeZone,
      registryIssuer: organisationTransferEligibility.registryIssuer,
      registryIdentifier: organisationTransferEligibility.registryIdentifier,
      status: organisationTransferEligibility.status,
      submittedEvidenceReference: organisationTransferEligibility.submittedEvidenceReference,
      requestedBy: organisationTransferEligibility.requestedBy,
      requestedAt: organisationTransferEligibility.requestedAt,
      verificationMethod: organisationTransferEligibility.verificationMethod,
      reviewEvidenceReference: organisationTransferEligibility.reviewEvidenceReference,
      reviewedBy: organisationTransferEligibility.reviewedBy,
      reviewedAt: organisationTransferEligibility.reviewedAt,
      validUntil: organisationTransferEligibility.validUntil,
      rejectionReason: organisationTransferEligibility.rejectionReason,
      suspendedBy: organisationTransferEligibility.suspendedBy,
      suspendedAt: organisationTransferEligibility.suspendedAt,
      suspensionReason: organisationTransferEligibility.suspensionReason,
    }).from(organisationTransferEligibility)
      .innerJoin(organisations, eq(organisations.id, organisationTransferEligibility.organisationId))
      .orderBy(sql`CASE ${organisationTransferEligibility.status} WHEN 'pending' THEN 0 WHEN 'verified' THEN 1 WHEN 'suspended' THEN 2 ELSE 3 END`, asc(organisationTransferEligibility.requestedAt));
    return rows.map(row => {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: row.organisationTimeZone }).format(new Date());
      const isEligible = row.status === 'verified' && row.organisationStatus === 'active' && (!row.validUntil || row.validUntil >= today);
      return {
        ...row,
        isEligible,
        requestedAt: row.requestedAt.toISOString(),
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        suspendedAt: row.suspendedAt?.toISOString() ?? null,
        validUntil: row.validUntil ?? null,
      };
    });
  });
}

export async function reviewTransferEligibility(actorUserId: string, organisationId: string, input: {
  decision: string; verificationMethod?: string | null; reviewEvidenceReference?: string | null;
  validUntil?: string | null; rejectionReason?: string | null;
}) {
  await assertPlatformAdministrator(actorUserId);
  assertOrganisationId(organisationId);
  if (!['verified','rejected'].includes(input.decision)) throw new TransferRegistryError('Choose a valid review decision', 400);
  const method = input.verificationMethod?.trim() || null;
  const evidence = input.reviewEvidenceReference?.trim() || null;
  const reason = input.rejectionReason?.trim() || null;
  const validUntil = input.validUntil?.trim() || null;
  if (input.decision === 'verified') {
    if (!method || !methods.includes(method as typeof methods[number]) || !evidence || evidence.length < 3 || evidence.length > 180) {
      throw new TransferRegistryError('A verification method and review evidence reference are required', 400);
    }
    const parsedValidUntil = validUntil ? new Date(validUntil + 'T00:00:00.000Z') : null;
    if (validUntil && (!datePattern.test(validUntil) || !parsedValidUntil || Number.isNaN(parsedValidUntil.getTime()) || parsedValidUntil.toISOString().slice(0,10) !== validUntil || validUntil < new Date().toISOString().slice(0,10))) {
      throw new TransferRegistryError('Enter a valid eligibility expiry date', 400);
    }
  } else if (!reason || reason.length < 3 || reason.length > 300) {
    throw new TransferRegistryError('A rejection reason of 3 to 300 characters is required', 400);
  }

  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.review_organisation_transfer_eligibility(
      ${organisationId}::uuid, ${input.decision}::text, ${method}::text, ${evidence}::text,
      ${validUntil}::date, ${reason}::text
    ) AS status`);
    const status = result.rows[0]?.status;
    if (!status) throw new TransferRegistryError('The database did not confirm the institution review');
    return { organisationId, status: String(status) };
  });
}

export async function suspendTransferEligibility(actorUserId: string, organisationId: string, reason: string) {
  await assertPlatformAdministrator(actorUserId);
  assertOrganisationId(organisationId);
  const suspensionReason = reason.trim();
  if (suspensionReason.length < 3 || suspensionReason.length > 300) {
    throw new TransferRegistryError('A suspension reason of 3 to 300 characters is required', 400);
  }
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.suspend_organisation_transfer_eligibility(
      ${organisationId}::uuid, ${suspensionReason}::text
    ) AS status`);
    const status = result.rows[0]?.status;
    if (!status) throw new TransferRegistryError('The database did not confirm the eligibility suspension');
    return { organisationId, status: String(status) };
  });
}
