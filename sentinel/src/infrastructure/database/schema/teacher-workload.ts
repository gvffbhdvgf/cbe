import { sql } from 'drizzle-orm';
import { check, date, index, pgTable, timestamp, uuid, varchar, integer, text, unique } from 'drizzle-orm/pg-core';
import { organisations } from './organisation';
import { authUsers } from './security';

export const teacherWeeklyWorkloadAllocations = pgTable('teacher_weekly_workload_allocations', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantOrganisationId: uuid('tenant_organisation_id').notNull().references(() => organisations.id, { onDelete: 'restrict' }),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'restrict' }),
  teacherAssignmentId: uuid('teacher_assignment_id').notNull(),
  weeklyPeriods: integer('weekly_periods').notNull(),
  startsOn: date('starts_on', { mode: 'string' }).notNull(),
  endsOn: date('ends_on', { mode: 'string' }),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  reason: text('reason').notNull(),
  createdBy: uuid('created_by').notNull().references(() => authUsers.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('teacher_workload_periods_check', sql`${table.weeklyPeriods} BETWEEN 1 AND 60`),
  check('teacher_workload_status_check', sql`${table.status} IN ('active','ended','revoked')`),
  index('teacher_workload_allocation_effective_idx').on(table.tenantOrganisationId, table.organisationId, table.teacherAssignmentId, table.startsOn, table.endsOn),
]);

export const teacherWorkloadPolicies = pgTable('teacher_workload_policies', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantOrganisationId: uuid('tenant_organisation_id').notNull().references(() => organisations.id, { onDelete: 'restrict' }),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'restrict' }),
  academicYear: integer('academic_year').notNull(),
  referenceWeeklyPeriods: integer('reference_weekly_periods').notNull(),
  maximumWeeklyPeriods: integer('maximum_weekly_periods').notNull(),
  periodDurationMinutes: integer('period_duration_minutes'),
  effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
  reason: text('reason').notNull(),
  createdBy: uuid('created_by').notNull().references(() => authUsers.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('teacher_workload_policy_reference_check', sql`${table.referenceWeeklyPeriods} BETWEEN 1 AND 60`),
  check('teacher_workload_policy_maximum_check', sql`${table.maximumWeeklyPeriods} BETWEEN ${table.referenceWeeklyPeriods} AND 60`),
  unique('teacher_workload_policy_year_effective_unique').on(table.tenantOrganisationId, table.organisationId, table.academicYear, table.effectiveFrom),
]);
