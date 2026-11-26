import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '@/infrastructure/database/client';
import { organisations } from '@/infrastructure/database/schema/organisation';
import { auditEvents } from '@/infrastructure/database/schema/security';
import { classes } from '@/infrastructure/database/schema/learner';
import { createClassDefinition, type ClassCreationInput } from '@/domain/learner/class';
import { withAuthenticatedLearnerDb } from '@/infrastructure/database/learner-rls-client';
import { requireLearnerManager } from './learner-service';

export async function listClasses(actorUserId: string, organisationId: string) {
  await requireLearnerManager(actorUserId, organisationId);
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => tx.select({
    id: classes.id,
    classCode: classes.classCode,
    displayName: classes.displayName,
    grade: classes.grade,
    academicYear: classes.academicYear,
    status: classes.status,
    capacity: classes.capacity,
    currentLearnerCount: sql<number>`(SELECT count(*)::int FROM public.learner_enrolments enrolment WHERE enrolment.class_id = ${classes.id} AND enrolment.organisation_id = ${classes.organisationId} AND enrolment.status = 'active')`,
    createdAt: classes.createdAt,
  }).from(classes)
    .where(eq(classes.tenantOrganisationId, organisationId))
    .orderBy(asc(classes.academicYear), asc(classes.grade), asc(classes.classCode)));
}

export async function createClass(actorUserId: string, organisationId: string, input: ClassCreationInput) {
  await requireLearnerManager(actorUserId, organisationId);
  const definition = createClassDefinition(input);
  const classId = crypto.randomUUID();

  await withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    await tx.insert(classes).values({
      id: classId,
      tenantOrganisationId: organisationId,
      organisationId,
      academicYear: definition.academicYear,
      grade: definition.grade,
      classCode: definition.classCode,
      displayName: definition.displayName,
      capacity: definition.capacity,
      status: 'active',
      createdBy: actorUserId,
    });
    await tx.insert(auditEvents).values({
      actorUserId,
      organisationId,
      action: 'class.created',
      resourceType: 'class',
      resourceId: classId,
      metadata: {
        classCode: definition.classCode,
        displayName: definition.displayName,
        grade: definition.grade,
        academicYear: definition.academicYear,
        capacity: definition.capacity,
      },
    });
  });

  return { id: classId, ...definition, status: 'active' as const };
}

export async function getClassManagementSummary(actorUserId: string, organisationId: string) {
  await requireLearnerManager(actorUserId, organisationId);
  const [organisation] = await db.select({ id: organisations.id, name: organisations.name }).from(organisations)
    .where(and(eq(organisations.id, organisationId), eq(organisations.status, 'active'))).limit(1);
  if (!organisation) throw new Error('Organisation not found or inactive');
  const classList = await listClasses(actorUserId, organisationId);
  return { organisation, classes: classList };
}


export async function updateClassCapacity(actorUserId: string, organisationId: string, classId: string, capacity: number | null) {
  await requireLearnerManager(actorUserId, organisationId);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(classId)) {
    throw new Error('A valid class ID is required');
  }
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 500)) {
    throw new Error('Class capacity must be between 1 and 500, or unlimited');
  }
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.set_class_capacity(
      ${organisationId}::uuid, ${classId}::uuid, ${capacity}::integer
    ) AS capacity`);
    if (result.rows.length === 0) throw new Error('The database did not confirm the class capacity change');
    return { classId, capacity: result.rows[0].capacity as number | null };
  });
}
