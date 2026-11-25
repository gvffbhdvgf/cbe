import { sql } from 'drizzle-orm';
import { check, pgSchema, pgTable, text, timestamp, uuid, varchar, jsonb, index, unique } from 'drizzle-orm/pg-core';
import { organisations } from './organisation';

const neonAuth = pgSchema('neon_auth');
const authUsers = neonAuth.table('user', {
  id: uuid('id').primaryKey(),
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
