import { sql } from 'drizzle-orm';
import { check, date, index, integer, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';

export const curriculumSources = pgTable('curriculum_sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceCode: varchar('source_code', { length: 100 }).notNull().unique(),
  publisher: varchar('publisher', { length: 180 }).notNull().default('Kenya Institute of Curriculum Development'),
  title: varchar('title', { length: 300 }).notNull(),
  sourceType: varchar('source_type', { length: 48 }).notNull(),
  url: text('url').notNull(),
  publishedAt: date('published_at'),
  retrievedAt: timestamp('retrieved_at', { withTimezone: true }).notNull().defaultNow(),
  authorityStatus: varchar('authority_status', { length: 32 }).notNull().default('official_catalogue'),
  checksumSha256: varchar('checksum_sha256', { length: 64 }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('curriculum_sources_type_check', sql`${table.sourceType} IN ('curriculum_design_catalogue', 'curriculum_design_pdf', 'framework', 'policy', 'approved_materials_addendum', 'materials_submission')`),
  check('curriculum_sources_authority_check', sql`${table.authorityStatus} IN ('official', 'official_catalogue', 'needs_verification', 'superseded')`),
]);

export const curriculumEditions = pgTable('curriculum_editions', {
  id: uuid('id').defaultRandom().primaryKey(),
  editionCode: varchar('edition_code', { length: 100 }).notNull().unique(),
  title: varchar('title', { length: 300 }).notNull(),
  framework: varchar('framework', { length: 80 }).notNull().default('CBC'),
  editionLabel: varchar('edition_label', { length: 180 }).notNull(),
  status: varchar('status', { length: 24 }).notNull().default('catalogued'),
  approvedAt: date('approved_at'),
  effectiveFrom: date('effective_from'),
  effectiveTo: date('effective_to'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('curriculum_editions_status_check', sql`${table.status} IN ('catalogued', 'verified', 'superseded', 'withdrawn')`),
  check('curriculum_editions_effective_dates_check', sql`${table.effectiveTo} IS NULL OR ${table.effectiveFrom} IS NULL OR ${table.effectiveTo} > ${table.effectiveFrom}`),
]);

export const curriculumPathways = pgTable('curriculum_pathways', {
  id: uuid('id').defaultRandom().primaryKey(),
  pathwayCode: varchar('pathway_code', { length: 80 }).notNull().unique(),
  name: varchar('name', { length: 180 }).notNull(),
  modality: varchar('modality', { length: 40 }).notNull(),
  categoryCode: varchar('category_code', { length: 40 }),
  sourceId: uuid('source_id').references(() => curriculumSources.id, { onDelete: 'restrict' }),
  catalogueStatus: varchar('catalogue_status', { length: 32 }).notNull().default('catalogued'),
  description: text('description'),
}, (table) => [
  check('curriculum_pathways_modality_check', sql`${table.modality} IN ('regular', 'adapted', 'accelerated_enriched', 'specialized', 'intervention', 'prevocational', 'vocational')`),
  check('curriculum_pathways_catalogue_status_check', sql`${table.catalogueStatus} IN ('catalogued', 'awaiting_publication', 'not_confirmed')`),
]);

export const curriculumLearningAreas = pgTable('curriculum_learning_areas', {
  id: uuid('id').defaultRandom().primaryKey(),
  areaCode: varchar('area_code', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 180 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const curriculumGradeOfferings = pgTable('curriculum_grade_offerings', {
  id: uuid('id').defaultRandom().primaryKey(),
  editionId: uuid('edition_id').notNull().references(() => curriculumEditions.id, { onDelete: 'restrict' }),
  pathwayId: uuid('pathway_id').notNull().references(() => curriculumPathways.id, { onDelete: 'restrict' }),
  grade: integer('grade').notNull(),
  learningAreaId: uuid('learning_area_id').notNull().references(() => curriculumLearningAreas.id, { onDelete: 'restrict' }),
  sourceId: uuid('source_id').notNull().references(() => curriculumSources.id, { onDelete: 'restrict' }),
  availabilityStatus: varchar('availability_status', { length: 32 }).notNull().default('document_listed'),
  displayOrder: integer('display_order').notNull().default(0),
  evidenceNote: text('evidence_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('curriculum_grade_offerings_edition_pathway_grade_area_unique').on(table.editionId, table.pathwayId, table.grade, table.learningAreaId),
  check('curriculum_grade_offerings_grade_check', sql`${table.grade} BETWEEN 1 AND 9`),
  check('curriculum_grade_offerings_availability_check', sql`${table.availabilityStatus} IN ('document_listed', 'document_available', 'awaiting_publication', 'catalogue_discrepancy', 'not_confirmed')`),
  index('curriculum_grade_offerings_grade_pathway_idx').on(table.grade, table.pathwayId, table.displayOrder),
]);
