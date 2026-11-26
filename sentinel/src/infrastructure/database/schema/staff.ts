import { sql } from 'drizzle-orm';
import { check, date, foreignKey, index, pgTable, timestamp, unique, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { organisations } from './organisation';
import { authUsers } from './security';
import { people } from './learner';

export const staffProfiles = pgTable('staff_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantOrganisationId: uuid('tenant_organisation_id').notNull().references(() => organisations.id, { onDelete: 'restrict' }),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'restrict' }),
  personId: uuid('person_id').notNull(),
  staffReference: varchar('staff_reference', { length: 48 }).notNull(),
  staffCategory: varchar('staff_category', { length: 32 }).notNull(),
  userId: uuid('user_id').references(() => authUsers.id, { onDelete: 'set null' }),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  createdBy: uuid('created_by').notNull().references(() => authUsers.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ name: 'staff_profiles_tenant_person_fkey', columns: [table.tenantOrganisationId, table.personId], foreignColumns: [people.tenantOrganisationId, people.id] }).onDelete('restrict'),
  unique('staff_profiles_tenant_org_id_unique').on(table.tenantOrganisationId, table.organisationId, table.id),
  unique('staff_profiles_org_reference_unique').on(table.organisationId, table.staffReference),
  unique('staff_profiles_org_person_unique').on(table.organisationId, table.personId),
  uniqueIndex('staff_profiles_org_user_unique').on(table.organisationId, table.userId).where(sql`${table.userId} IS NOT NULL`),
  check('staff_profiles_scope_check', sql`${table.tenantOrganisationId} = ${table.organisationId}`),
  check('staff_profiles_category_check', sql`${table.staffCategory} IN ('teacher', 'school_leader', 'administrator', 'support_staff', 'specialist', 'other')`),
  check('staff_profiles_status_check', sql`${table.status} IN ('active', 'inactive', 'archived')`),
  index('staff_profiles_org_category_status_idx').on(table.organisationId, table.staffCategory, table.status),
]);

export const staffEngagements = pgTable('staff_engagements', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantOrganisationId: uuid('tenant_organisation_id').notNull().references(() => organisations.id, { onDelete: 'restrict' }),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'restrict' }),
  staffProfileId: uuid('staff_profile_id').notNull(),
  engagementType: varchar('engagement_type', { length: 24 }).notNull(),
  jobTitle: varchar('job_title', { length: 120 }).notNull(),
  startsOn: date('starts_on', { mode: 'string' }).notNull(),
  endsOn: date('ends_on', { mode: 'string' }),
  status: varchar('status', { length: 16 }).notNull().default('planned'),
  createdBy: uuid('created_by').notNull().references(() => authUsers.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ name: 'staff_engagements_profile_fkey', columns: [table.tenantOrganisationId, table.organisationId, table.staffProfileId], foreignColumns: [staffProfiles.tenantOrganisationId, staffProfiles.organisationId, staffProfiles.id] }).onDelete('restrict'),
  unique('staff_engagements_tenant_org_id_unique').on(table.tenantOrganisationId, table.organisationId, table.id),
  check('staff_engagements_scope_check', sql`${table.tenantOrganisationId} = ${table.organisationId}`),
  check('staff_engagements_period_check', sql`${table.endsOn} IS NULL OR ${table.endsOn} > ${table.startsOn}`),
  check('staff_engagements_type_check', sql`${table.engagementType} IN ('permanent', 'contract', 'casual', 'volunteer', 'internship', 'other')`),
  check('staff_engagements_status_check', sql`${table.status} IN ('planned', 'active', 'on_leave', 'ended', 'suspended')`),
  check('staff_engagements_ended_check', sql`${table.status} <> 'ended' OR ${table.endsOn} IS NOT NULL`),
  index('staff_engagements_profile_period_idx').on(table.tenantOrganisationId, table.organisationId, table.staffProfileId, table.startsOn, table.endsOn),
]);
