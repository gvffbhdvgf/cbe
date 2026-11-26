import { sql } from 'drizzle-orm';
import { check, date, index, integer, jsonb, pgTable, text, timestamp, unique, uuid, varchar, type AnyPgColumn } from 'drizzle-orm/pg-core';

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


export const curriculumPathwayGradeLevels = pgTable('curriculum_pathway_grade_levels', {
  id: uuid('id').defaultRandom().primaryKey(),
  editionId: uuid('edition_id').notNull().references(() => curriculumEditions.id, { onDelete: 'restrict' }),
  pathwayId: uuid('pathway_id').notNull().references(() => curriculumPathways.id, { onDelete: 'restrict' }),
  grade: integer('grade').notNull(),
  sourceId: uuid('source_id').notNull().references(() => curriculumSources.id, { onDelete: 'restrict' }),
  availabilityStatus: varchar('availability_status', { length: 32 }).notNull().default('document_listed'),
  evidenceNote: text('evidence_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique('curriculum_pathway_grade_levels_edition_pathway_grade_unique').on(table.editionId, table.pathwayId, table.grade),
  check('curriculum_pathway_grade_levels_grade_check', sql`${table.grade} BETWEEN 1 AND 9`),
  check('curriculum_pathway_grade_levels_availability_check', sql`${table.availabilityStatus} IN ('document_listed', 'document_available', 'awaiting_publication', 'catalogue_discrepancy', 'not_confirmed')`),
  index('curriculum_pathway_grade_levels_pathway_grade_idx').on(table.pathwayId, table.grade),
]);

export const curriculumDesignDocuments = pgTable('curriculum_design_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentCode: varchar('document_code', { length: 120 }).notNull().unique(),
  gradeOfferingId: uuid('grade_offering_id').notNull().references(() => curriculumGradeOfferings.id, { onDelete: 'restrict' }),
  sourceId: uuid('source_id').notNull().references(() => curriculumSources.id, { onDelete: 'restrict' }),
  title: varchar('title', { length: 300 }).notNull(),
  publicationLabel: varchar('publication_label', { length: 180 }),
  firstPublishedYear: integer('first_published_year'),
  sourceFileLabel: varchar('source_file_label', { length: 240 }),
  pageCount: integer('page_count'),
  checksumSha256: varchar('checksum_sha256', { length: 64 }),
  availabilityStatus: varchar('availability_status', { length: 24 }).notNull().default('identified'),
  reviewStatus: varchar('review_status', { length: 24 }).notNull().default('pending'),
  rightsStatus: varchar('rights_status', { length: 24 }).notNull().default('not_assessed'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('curriculum_design_documents_availability_check', sql`${table.availabilityStatus} IN ('identified', 'downloaded', 'extracted', 'reviewed', 'approved', 'superseded')`),
  check('curriculum_design_documents_review_check', sql`${table.reviewStatus} IN ('pending', 'in_review', 'approved', 'rejected')`),
  check('curriculum_design_documents_rights_check', sql`${table.rightsStatus} IN ('not_assessed', 'confirmed', 'restricted')`),
  index('curriculum_design_documents_offering_idx').on(table.gradeOfferingId),
]);

export const curriculumSourceNodes = pgTable('curriculum_source_nodes', {
  id: uuid('id').defaultRandom().primaryKey(),
  documentId: uuid('document_id').notNull().references(() => curriculumDesignDocuments.id, { onDelete: 'restrict' }),
  parentId: uuid('parent_id').references((): AnyPgColumn => curriculumSourceNodes.id, { onDelete: 'restrict' }),
  nodeType: varchar('node_type', { length: 32 }).notNull(),
  nodeCode: varchar('node_code', { length: 80 }).notNull(),
  title: varchar('title', { length: 300 }).notNull(),
  sourcePage: integer('source_page'),
  displayOrder: integer('display_order').notNull().default(0),
  extractionStatus: varchar('extraction_status', { length: 24 }).notNull().default('catalogued'),
  metadata: jsonb('metadata').notNull().default({}),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  check('curriculum_source_nodes_type_check', sql`${table.nodeType} IN ('strand', 'sub_strand', 'general_outcome', 'specific_outcome', 'learning_experience', 'inquiry_question', 'core_competency', 'value', 'pci', 'csl_activity', 'assessment_rubric', 'rubric_criterion')`),
  check('curriculum_source_nodes_status_check', sql`${table.extractionStatus} IN ('catalogued', 'extracted', 'reviewed', 'approved', 'rejected')`),
  unique('curriculum_source_nodes_document_type_code_unique').on(table.documentId, table.nodeType, table.nodeCode),
  index('curriculum_source_nodes_parent_idx').on(table.parentId, table.displayOrder),
]);
