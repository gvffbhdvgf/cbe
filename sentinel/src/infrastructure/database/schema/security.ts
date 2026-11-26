import { sql } from 'drizzle-orm';
import { check, pgSchema, pgTable, text, timestamp, uuid, varchar, jsonb, index, unique, uniqueIndex, boolean, date } from 'drizzle-orm/pg-core';
import { organisations } from './organisation';

const neonAuth = pgSchema('neon_auth');
export const authUsers = neonAuth.table('user', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  emailVerified: boolean('emailVerified').notNull(),
  banned: boolean('banned'),
});

export const platformAdministrators = pgTable('platform_administrators', {
  userId: uuid('user_id').primaryKey().references(() => authUsers.id, { onDelete: 'restrict' }),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('platform_administrators_status_check', sql`${table.status} IN ('active', 'suspended', 'revoked')`),
]);

export const organisationMemberships = pgTable('organisation_memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'restrict' }),
  userId: uuid('user_id').notNull().references(() => authUsers.id, { onDelete: 'restrict' }),
  role: varchar('role', { length: 32 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  createdBy: uuid('created_by').notNull().references(() => authUsers.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('organisation_memberships_org_user_role_unique').on(table.organisationId, table.userId, table.role),
  uniqueIndex('organisation_memberships_one_active_per_user_idx').on(table.organisationId, table.userId).where(sql`${table.status} = 'active'`),
  check('organisation_memberships_role_check', sql`${table.role} IN ('organisation_admin', 'school_admin', 'teacher', 'assessor', 'viewer')`),
  check('organisation_memberships_status_check', sql`${table.status} IN ('invited', 'active', 'suspended', 'revoked')`),
  check('organisation_memberships_effective_dates_check', sql`${table.endsAt} IS NULL OR ${table.endsAt} > ${table.startsAt}`),
  index('organisation_memberships_user_status_idx').on(table.userId, table.status, table.startsAt, table.endsAt),
  index('organisation_memberships_org_status_idx').on(table.organisationId, table.status),
]);

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorUserId: uuid('actor_user_id').notNull().references(() => authUsers.id, { onDelete: 'restrict' }),
  organisationId: uuid('organisation_id').references(() => organisations.id, { onDelete: 'restrict' }),
  action: varchar('action', { length: 120 }).notNull(),
  resourceType: varchar('resource_type', { length: 80 }).notNull(),
  resourceId: text('resource_id').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('audit_events_org_time_idx').on(table.organisationId, table.occurredAt.desc()),
  index('audit_events_actor_time_idx').on(table.actorUserId, table.occurredAt.desc()),
]);


export const organisationTransferEligibility = pgTable('organisation_transfer_eligibility', {
  organisationId: uuid('organisation_id').primaryKey().references(() => organisations.id, { onDelete: 'restrict' }),
  registryIssuer: varchar('registry_issuer', { length: 48 }).notNull(),
  registryIdentifier: varchar('registry_identifier', { length: 180 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  submittedEvidenceReference: varchar('submitted_evidence_reference', { length: 180 }).notNull(),
  requestedBy: uuid('requested_by').notNull().references(() => authUsers.id, { onDelete: 'restrict' }),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  verificationMethod: varchar('verification_method', { length: 32 }),
  reviewEvidenceReference: varchar('review_evidence_reference', { length: 180 }),
  reviewedBy: uuid('reviewed_by').references(() => authUsers.id, { onDelete: 'restrict' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  validUntil: date('valid_until'),
  rejectionReason: varchar('rejection_reason', { length: 300 }),
  suspendedBy: uuid('suspended_by').references(() => authUsers.id, { onDelete: 'restrict' }),
  suspendedAt: timestamp('suspended_at', { withTimezone: true }),
  suspensionReason: varchar('suspension_reason', { length: 300 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('organisation_transfer_eligibility_issuer_check', sql`${table.registryIssuer} IN ('moe_registration_number', 'nemis_uic', 'kemis_institution_id', 'tveta_registration_number', 'other_authority')`),
  check('organisation_transfer_eligibility_status_check', sql`${table.status} IN ('pending', 'verified', 'rejected', 'suspended')`),
  check('organisation_transfer_eligibility_method_check', sql`${table.verificationMethod} IS NULL OR ${table.verificationMethod} IN ('official_registry', 'official_certificate', 'authority_confirmation', 'other')`),
  check('organisation_transfer_eligibility_identifier_check', sql`length(btrim(${table.registryIdentifier})) BETWEEN 3 AND 180`),
  check('organisation_transfer_eligibility_evidence_check', sql`length(btrim(${table.submittedEvidenceReference})) BETWEEN 3 AND 180`),
  check('organisation_transfer_eligibility_state_check', sql`(
    (${table.status} = 'pending' AND ${table.verificationMethod} IS NULL AND ${table.reviewEvidenceReference} IS NULL AND ${table.reviewedBy} IS NULL AND ${table.reviewedAt} IS NULL AND ${table.validUntil} IS NULL AND ${table.rejectionReason} IS NULL AND ${table.suspendedBy} IS NULL AND ${table.suspendedAt} IS NULL AND ${table.suspensionReason} IS NULL)
    OR (${table.status} = 'verified' AND ${table.verificationMethod} IS NOT NULL AND ${table.reviewEvidenceReference} IS NOT NULL AND length(btrim(${table.reviewEvidenceReference})) BETWEEN 3 AND 180 AND ${table.reviewedBy} IS NOT NULL AND ${table.reviewedAt} IS NOT NULL AND ${table.rejectionReason} IS NULL AND ${table.suspendedBy} IS NULL AND ${table.suspendedAt} IS NULL AND ${table.suspensionReason} IS NULL)
    OR (${table.status} = 'rejected' AND ${table.verificationMethod} IS NULL AND ${table.reviewEvidenceReference} IS NULL AND ${table.reviewedBy} IS NOT NULL AND ${table.reviewedAt} IS NOT NULL AND ${table.rejectionReason} IS NOT NULL AND length(btrim(${table.rejectionReason})) BETWEEN 3 AND 300 AND ${table.suspendedBy} IS NULL AND ${table.suspendedAt} IS NULL AND ${table.suspensionReason} IS NULL)
    OR (${table.status} = 'suspended' AND ${table.verificationMethod} IS NOT NULL AND ${table.reviewEvidenceReference} IS NOT NULL AND length(btrim(${table.reviewEvidenceReference})) BETWEEN 3 AND 180 AND ${table.reviewedBy} IS NOT NULL AND ${table.reviewedAt} IS NOT NULL AND ${table.suspendedBy} IS NOT NULL AND ${table.suspendedAt} IS NOT NULL AND ${table.suspensionReason} IS NOT NULL AND length(btrim(${table.suspensionReason})) BETWEEN 3 AND 300)
  )`),
  uniqueIndex('organisation_transfer_registry_identifier_unique').on(table.registryIssuer, sql`lower(btrim(${table.registryIdentifier}))`),
  index('organisation_transfer_eligibility_status_idx').on(table.status, table.requestedAt),
]);
