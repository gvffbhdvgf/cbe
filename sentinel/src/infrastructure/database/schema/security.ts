import { pgTable, text, timestamp, uuid, varchar, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { organisations } from './organisation';

export const platformAdministrators = pgTable('platform_administrators', {
  userId: text('user_id').primaryKey(),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const organisationMemberships = pgTable('organisation_memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'restrict' }),
  userId: text('user_id').notNull(),
  role: varchar('role', { length: 32 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('organisation_memberships_org_user_role_unique').on(table.organisationId, table.userId, table.role),
  index('organisation_memberships_user_status_idx').on(table.userId, table.status, table.startsAt, table.endsAt),
  index('organisation_memberships_org_status_idx').on(table.organisationId, table.status),
]);

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorUserId: text('actor_user_id').notNull(),
  organisationId: uuid('organisation_id').references(() => organisations.id, { onDelete: 'restrict' }),
  action: varchar('action', { length: 120 }).notNull(),
  resourceType: varchar('resource_type', { length: 80 }).notNull(),
  resourceId: text('resource_id').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('audit_events_org_time_idx').on(table.organisationId, table.occurredAt),
  index('audit_events_actor_time_idx').on(table.actorUserId, table.occurredAt),
]);
