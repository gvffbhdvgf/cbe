import { asc, count, eq } from 'drizzle-orm';
import { db } from '@/infrastructure/database/client';
import { curriculumDesignDocuments, curriculumEditions, curriculumGradeOfferings, curriculumLearningAreas, curriculumPathways, curriculumSourceNodes, curriculumSources } from '@/infrastructure/database/schema/curriculum';

export async function listCurriculumCatalogue() {
  const [pathways, offerings, documents] = await Promise.all([
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
    }).from(curriculumDesignDocuments)
      .innerJoin(curriculumGradeOfferings, eq(curriculumDesignDocuments.gradeOfferingId, curriculumGradeOfferings.id))
      .innerJoin(curriculumLearningAreas, eq(curriculumGradeOfferings.learningAreaId, curriculumLearningAreas.id))
      .innerJoin(curriculumSources, eq(curriculumDesignDocuments.sourceId, curriculumSources.id))
      .leftJoin(curriculumSourceNodes, eq(curriculumSourceNodes.documentId, curriculumDesignDocuments.id))
      .groupBy(curriculumDesignDocuments.id, curriculumGradeOfferings.grade, curriculumLearningAreas.areaCode, curriculumSources.title, curriculumSources.url)
      .orderBy(asc(curriculumGradeOfferings.grade), asc(curriculumLearningAreas.name)),
  ]);
  return { pathways, offerings, documents };
}
