import { sql } from 'drizzle-orm';
import { boolean, check, date, foreignKey, index, integer, pgTable, timestamp, unique, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { organisations } from './organisation';
import { authUsers } from './security';

export const people = pgTable('people', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantOrganisationId: uuid('tenant_organisation_id').notNull().references(() => organisations.id, { onDelete: 'restrict' }),
  legalFirstName: varchar('legal_first_name', { length: 120 }).notNull(),
  legalMiddleName: varchar('legal_middle_name', { length: 120 }),
  legalLastName: varchar('legal_last_name', { length: 120 }).notNull(),
  preferredName: varchar('preferred_name', { length: 120 }),
  dateOfBirth: date('date_of_birth'),
  createdBy: uuid('created_by').notNull().references(() => authUsers.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('people_tenant_name_idx').on(table.tenantOrganisationId, table.legalLastName, table.legalFirstName),
  unique('people_tenant_person_unique').on(table.tenantOrganisationId, table.id),
]);

export const learnerProfiles = pgTable('learner_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantOrganisationId: uuid('tenant_organisation_id').notNull().references(() => organisations.id, { onDelete: 'restrict' }),
  personId: uuid('person_id').notNull().unique(),
  learnerReference: varchar('learner_reference', { length: 48 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  createdBy: uuid('created_by').notNull().references(() => authUsers.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('learner_profiles_tenant_reference_unique').on(table.tenantOrganisationId, table.learnerReference),
  unique('learner_profiles_tenant_id_unique').on(table.tenantOrganisationId, table.id),
  foreignKey({ columns: [table.tenantOrganisationId, table.personId], foreignColumns: [people.tenantOrganisationId, people.id], name: 'learner_profiles_tenant_person_fkey' }).onDelete('restrict'),
  check('learner_profiles_status_check', sql`${table.status} IN ('active', 'archived')`),
  index('learner_profiles_tenant_status_idx').on(table.tenantOrganisationId, table.status),
]);

export const classes = pgTable('classes', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantOrganisationId: uuid('tenant_organisation_id').notNull().references(() => organisations.id, { onDelete: 'restrict' }),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'restrict' }),
  academicYear: integer('academic_year').notNull(),
  grade: integer('grade').notNull(),
  classCode: varchar('class_code', { length: 40 }).notNull(),
  displayName: varchar('display_name', { length: 120 }).notNull(),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  createdBy: uuid('created_by').notNull().references(() => authUsers.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('classes_org_year_grade_code_unique').on(table.organisationId, table.academicYear, table.grade, table.classCode),
  unique('classes_tenant_org_id_grade_year_unique').on(table.tenantOrganisationId, table.organisationId, table.id, table.grade, table.academicYear),
  check('classes_grade_check', sql`${table.grade} BETWEEN 1 AND 9`),
  check('classes_academic_year_check', sql`${table.academicYear} BETWEEN 2000 AND 2100`),
  check('classes_status_check', sql`${table.status} IN ('active', 'archived')`),
  index('classes_org_grade_year_idx').on(table.organisationId, table.grade, table.academicYear),
]);

export const learnerEnrolments = pgTable('learner_enrolments', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantOrganisationId: uuid('tenant_organisation_id').notNull().references(() => organisations.id, { onDelete: 'restrict' }),
  learnerId: uuid('learner_id').notNull(),
  organisationId: uuid('organisation_id').notNull().references(() => organisations.id, { onDelete: 'restrict' }),
  grade: integer('grade').notNull(),
  academicYear: integer('academic_year').notNull(),
  classId: uuid('class_id'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  startsAt: date('starts_at').notNull().defaultNow(),
  endsAt: date('ends_at'),
  createdBy: uuid('created_by').notNull().references(() => authUsers.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.tenantOrganisationId, table.learnerId], foreignColumns: [learnerProfiles.tenantOrganisationId, learnerProfiles.id], name: 'learner_enrolments_tenant_learner_fkey' }).onDelete('restrict'),
  foreignKey({ columns: [table.tenantOrganisationId, table.organisationId, table.classId, table.grade, table.academicYear], foreignColumns: [classes.tenantOrganisationId, classes.organisationId, classes.id, classes.grade, classes.academicYear], name: 'learner_enrolments_tenant_class_fkey' }).onDelete('restrict'),
  check('learner_enrolments_grade_check', sql`${table.grade} BETWEEN 1 AND 9`),
  check('learner_enrolments_academic_year_check', sql`${table.academicYear} BETWEEN 2000 AND 2100`),
  check('learner_enrolments_status_check', sql`${table.status} IN ('pending', 'active', 'ended', 'transferred', 'withdrawn')`),
  check('learner_enrolments_effective_dates_check', sql`${table.endsAt} IS NULL OR ${table.endsAt} > ${table.startsAt}`),
  uniqueIndex('learner_enrolments_one_active_per_learner_idx').on(table.tenantOrganisationId, table.learnerId).where(sql`${table.status} = 'active'`),
  index('learner_enrolments_org_grade_year_idx').on(table.organisationId, table.grade, table.academicYear, table.status),
]);

export const guardianRelationships = pgTable('guardian_relationships', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantOrganisationId: uuid('tenant_organisation_id').notNull().references(() => organisations.id, { onDelete: 'restrict' }),
  learnerId: uuid('learner_id').notNull(),
  guardianPersonId: uuid('guardian_person_id').notNull(),
  relationshipType: varchar('relationship_type', { length: 40 }).notNull(),
  verificationStatus: varchar('verification_status', { length: 20 }).notNull().default('pending'),
  status: varchar('status', { length: 16 }).notNull().default('active'),
  canViewProgress: boolean('can_view_progress').notNull().default(false),
  canReceiveMessages: boolean('can_receive_messages').notNull().default(false),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  createdBy: uuid('created_by').notNull().references(() => authUsers.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.tenantOrganisationId, table.learnerId], foreignColumns: [learnerProfiles.tenantOrganisationId, learnerProfiles.id], name: 'guardian_relationships_tenant_learner_fkey' }).onDelete('restrict'),
  foreignKey({ columns: [table.tenantOrganisationId, table.guardianPersonId], foreignColumns: [people.tenantOrganisationId, people.id], name: 'guardian_relationships_tenant_guardian_fkey' }).onDelete('restrict'),
  check('guardian_relationships_verification_check', sql`${table.verificationStatus} IN ('pending', 'verified', 'rejected')`),
  check('guardian_relationships_status_check', sql`${table.status} IN ('active', 'revoked', 'expired')`),
  check('guardian_relationships_effective_dates_check', sql`${table.endsAt} IS NULL OR ${table.endsAt} > ${table.startsAt}`),
  unique('guardian_relationships_learner_guardian_unique').on(table.tenantOrganisationId, table.learnerId, table.guardianPersonId, table.relationshipType),
  index('guardian_relationships_learner_idx').on(table.tenantOrganisationId, table.learnerId, table.status),
]);

export const learnerProgressionEvents = pgTable('learner_progression_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantOrganisationId: uuid('tenant_organisation_id').notNull().references(() => organisations.id, { onDelete: 'restrict' }),
  learnerId: uuid('learner_id').notNull(),
  eventType: varchar('event_type', { length: 24 }).notNull(),
  fromGrade: integer('from_grade'),
  toGrade: integer('to_grade'),
  effectiveAt: date('effective_at').notNull(),
  actorUserId: uuid('actor_user_id').notNull().references(() => authUsers.id, { onDelete: 'restrict' }),
  reasonCode: varchar('reason_code', { length: 80 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.tenantOrganisationId, table.learnerId], foreignColumns: [learnerProfiles.tenantOrganisationId, learnerProfiles.id], name: 'learner_progression_tenant_learner_fkey' }).onDelete('restrict'),
  check('learner_progression_event_type_check', sql`${table.eventType} IN ('admitted', 'promoted', 'repeated', 'transferred_in', 'transferred_out', 'withdrawn', 'graduated', 'reinstated')`),
  check('learner_progression_from_grade_check', sql`${table.fromGrade} IS NULL OR ${table.fromGrade} BETWEEN 1 AND 9`),
  check('learner_progression_to_grade_check', sql`${table.toGrade} IS NULL OR ${table.toGrade} BETWEEN 1 AND 9`),
  index('learner_progression_tenant_learner_idx').on(table.tenantOrganisationId, table.learnerId, table.effectiveAt),
]);
