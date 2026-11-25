import { asc, eq } from 'drizzle-orm';
import { db } from '@/infrastructure/database/client';
import { curriculumEditions, curriculumGradeOfferings, curriculumLearningAreas, curriculumPathways, curriculumSources } from '@/infrastructure/database/schema/curriculum';

export async function listCurriculumCatalogue() {
  const [pathways, offerings] = await Promise.all([
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
  ]);
  return { pathways, offerings };
}
