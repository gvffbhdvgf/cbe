import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { organisations } from './organisation';
import { authUsers } from './security';

export const learnerRecordCorrectionRequests = pgTable('learner_record_correction_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantOrganisationId: uuid('tenant_organisation_id').notNull().references(() => organisations.id, { onDelete: 'restrict' }),
  learnerId: uuid('learner_id').notNull(),
  personId: uuid('person_id').notNull(),
  fieldKey: varchar('field_key', { length: 32 }).notNull(),
  originalValue: text('original_value'),
  proposedValue: text('proposed_value'),
  reason: text('reason').notNull(),
  evidenceReference: varchar('evidence_reference', { length: 180 }),
  status: varchar('status', { length: 16 }).notNull().default('pending'),
  requestedBy: uuid('requested_by').notNull().references(() => authUsers.id, { onDelete: 'restrict' }),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  reviewedBy: uuid('reviewed_by').references(() => authUsers.id, { onDelete: 'restrict' }),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewReason: text('review_reason'),
}, (table) => [
  check('learner_record_correction_field_check', sql`${table.fieldKey} IN ('legal_first_name','legal_middle_name','legal_last_name','preferred_name','date_of_birth')`),
  check('learner_record_correction_status_check', sql`${table.status} IN ('pending','approved','rejected')`),
  index('learner_record_correction_queue_idx').on(table.tenantOrganisationId, table.status, table.requestedAt),
]);
