import { asc, count, desc, eq } from 'drizzle-orm';
import { buildCurriculumOutline } from '@/domain/curriculum/outline';
import { db } from '@/infrastructure/database/client';
import { curriculumDesignDocuments, curriculumEditions, curriculumGradeOfferings, curriculumLearningAreas, curriculumPathways, curriculumPathwayGradeLevels, curriculumSourceNodes, curriculumSources } from '@/infrastructure/database/schema/curriculum';

export async function listCurriculumCatalogue() {
  const [pathways, offerings, documents, pathwayGradeLevels] = await Promise.all([
    db.select({ code: curriculumPathways.pathwayCode, name: curriculumPathways.name, modality: curriculumPathways.modality, categoryCode: curriculumPathways.categoryCode, catalogueStatus: curriculumPathways.catalogueStatus, description: curriculumPathways.description, sourceTitle: curriculumSources.title, sourceUrl: curriculumSources.url })
      .from(curriculumPathways)
      .leftJoin(curriculumSources, eq(curriculumPathways.sourceId, curriculumSources.id))
      .orderBy(asc(curriculumPathways.modality), asc(curriculumPathways.name)),
    db.select({
      id: curriculumGradeOfferings.id,
      grade: curriculumGradeOfferings.grade,
      displayOrder: curriculumGradeOfferings.displayOrder,
      availabilityStatus: curriculumGradeOfferings.availabilityStatus,
      evidenceNote: curriculumGradeOfferings.evidenceNote,
      areaCode: curriculumLearningAreas.areaCode,
      areaName: curriculumLearningAreas.name,
      pathwayCode: curriculumPathways.pathwayCode,
      pathwayName: curriculumPathways.name,
      editionCode: curriculumEditions.editionCode,
      editionTitle: curriculumEditions.title,
      editionStatus: curriculumEditions.status,
      sourceTitle: curriculumSources.title,
      sourceUrl: curriculumSources.url,
      sourceAuthority: curriculumSources.authorityStatus,
    }).from(curriculumGradeOfferings)
      .innerJoin(curriculumLearningAreas, eq(curriculumGradeOfferings.learningAreaId, curriculumLearningAreas.id))
      .innerJoin(curriculumPathways, eq(curriculumGradeOfferings.pathwayId, curriculumPathways.id))
      .innerJoin(curriculumEditions, eq(curriculumGradeOfferings.editionId, curriculumEditions.id))
      .innerJoin(curriculumSources, eq(curriculumGradeOfferings.sourceId, curriculumSources.id))
      .orderBy(asc(curriculumGradeOfferings.grade), asc(curriculumGradeOfferings.displayOrder)),
    db.select({
      documentCode: curriculumDesignDocuments.documentCode,
      grade: curriculumGradeOfferings.grade,
      areaCode: curriculumLearningAreas.areaCode,
      title: curriculumDesignDocuments.title,
      publicationLabel: curriculumDesignDocuments.publicationLabel,
      firstPublishedYear: curriculumDesignDocuments.firstPublishedYear,
      availabilityStatus: curriculumDesignDocuments.availabilityStatus,
      reviewStatus: curriculumDesignDocuments.reviewStatus,
      rightsStatus: curriculumDesignDocuments.rightsStatus,
      sourceTitle: curriculumSources.title,
      sourceUrl: curriculumSources.url,
      indexedNodes: count(curriculumSourceNodes.id),
      createdAt: curriculumDesignDocuments.createdAt,
    }).from(curriculumDesignDocuments)
      .innerJoin(curriculumGradeOfferings, eq(curriculumDesignDocuments.gradeOfferingId, curriculumGradeOfferings.id))
      .innerJoin(curriculumLearningAreas, eq(curriculumGradeOfferings.learningAreaId, curriculumLearningAreas.id))
      .innerJoin(curriculumSources, eq(curriculumDesignDocuments.sourceId, curriculumSources.id))
      .leftJoin(curriculumSourceNodes, eq(curriculumSourceNodes.documentId, curriculumDesignDocuments.id))
      .groupBy(curriculumDesignDocuments.id, curriculumDesignDocuments.createdAt, curriculumGradeOfferings.grade, curriculumLearningAreas.areaCode, curriculumSources.title, curriculumSources.url)
      .orderBy(asc(curriculumGradeOfferings.grade), asc(curriculumLearningAreas.name), desc(curriculumDesignDocuments.createdAt)),
    db.select({
      id: curriculumPathwayGradeLevels.id,
      grade: curriculumPathwayGradeLevels.grade,
      availabilityStatus: curriculumPathwayGradeLevels.availabilityStatus,
      evidenceNote: curriculumPathwayGradeLevels.evidenceNote,
      pathwayCode: curriculumPathways.pathwayCode,
      pathwayName: curriculumPathways.name,
      editionCode: curriculumEditions.editionCode,
      editionTitle: curriculumEditions.title,
      sourceTitle: curriculumSources.title,
      sourceUrl: curriculumSources.url,
      sourceAuthority: curriculumSources.authorityStatus,
    }).from(curriculumPathwayGradeLevels)
      .innerJoin(curriculumPathways, eq(curriculumPathwayGradeLevels.pathwayId, curriculumPathways.id))
      .innerJoin(curriculumEditions, eq(curriculumPathwayGradeLevels.editionId, curriculumEditions.id))
      .innerJoin(curriculumSources, eq(curriculumPathwayGradeLevels.sourceId, curriculumSources.id))
      .orderBy(asc(curriculumPathwayGradeLevels.grade), asc(curriculumPathways.name)),
  ]);
  return { pathways, offerings, documents, pathwayGradeLevels };
}

export async function getCurriculumDocument(documentCode: string) {
  const [document] = await db.select({
    id: curriculumDesignDocuments.id,
    documentCode: curriculumDesignDocuments.documentCode,
    title: curriculumDesignDocuments.title,
    publicationLabel: curriculumDesignDocuments.publicationLabel,
    firstPublishedYear: curriculumDesignDocuments.firstPublishedYear,
    availabilityStatus: curriculumDesignDocuments.availabilityStatus,
    reviewStatus: curriculumDesignDocuments.reviewStatus,
    rightsStatus: curriculumDesignDocuments.rightsStatus,
    notes: curriculumDesignDocuments.notes,
    grade: curriculumGradeOfferings.grade,
    areaCode: curriculumLearningAreas.areaCode,
    areaName: curriculumLearningAreas.name,
    editionCode: curriculumEditions.editionCode,
    editionTitle: curriculumEditions.title,
    editionStatus: curriculumEditions.status,
    pathwayCode: curriculumPathways.pathwayCode,
    pathwayName: curriculumPathways.name,
    sourceTitle: curriculumSources.title,
    sourceUrl: curriculumSources.url,
    sourceAuthority: curriculumSources.authorityStatus,
  }).from(curriculumDesignDocuments)
    .innerJoin(curriculumGradeOfferings, eq(curriculumDesignDocuments.gradeOfferingId, curriculumGradeOfferings.id))
    .innerJoin(curriculumLearningAreas, eq(curriculumGradeOfferings.learningAreaId, curriculumLearningAreas.id))
    .innerJoin(curriculumEditions, eq(curriculumGradeOfferings.editionId, curriculumEditions.id))
    .innerJoin(curriculumPathways, eq(curriculumGradeOfferings.pathwayId, curriculumPathways.id))
    .innerJoin(curriculumSources, eq(curriculumDesignDocuments.sourceId, curriculumSources.id))
    .where(eq(curriculumDesignDocuments.documentCode, documentCode))
    .limit(1);
  if (!document) return null;
  const records = await db.select({
    id: curriculumSourceNodes.id,
    parentId: curriculumSourceNodes.parentId,
    nodeType: curriculumSourceNodes.nodeType,
    nodeCode: curriculumSourceNodes.nodeCode,
    title: curriculumSourceNodes.title,
    sourcePage: curriculumSourceNodes.sourcePage,
    displayOrder: curriculumSourceNodes.displayOrder,
    extractionStatus: curriculumSourceNodes.extractionStatus,
    notes: curriculumSourceNodes.notes,
  }).from(curriculumSourceNodes)
    .where(eq(curriculumSourceNodes.documentId, document.id))
    .orderBy(asc(curriculumSourceNodes.displayOrder), asc(curriculumSourceNodes.nodeCode));
  return { document, outline: buildCurriculumOutline(records) };
}
