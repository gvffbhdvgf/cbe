import { and, eq, isNull, or } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db } from '@/infrastructure/database/client';
import { organisations } from '@/infrastructure/database/schema/organisation';
import { authUsers, organisationMemberships } from '@/infrastructure/database/schema/security';
import { curriculumLearningAreas } from '@/infrastructure/database/schema/curriculum';
import { listClasses } from '@/application/learner/class-service';
import { requireLearnerManager } from '@/application/learner/learner-service';
import { withAuthenticatedLearnerDb } from '@/infrastructure/database/learner-rls-client';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export class TeacherAssignmentError extends Error {
  readonly status: number;
  constructor(message: string, status = 409) { super(message); this.name = 'TeacherAssignmentError'; this.status = status; }
}

async function assertTeacherAssignmentManager(actorUserId: string, organisationId: string) {
  try { await requireLearnerManager(actorUserId, organisationId); }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Teacher assignment management is not authorised';
    throw new TeacherAssignmentError(message, message.includes('not found') ? 404 : 403);
  }
}

export async function getTeacherAssignmentManagementSummary(actorUserId: string, organisationId: string) {
  await assertTeacherAssignmentManager(actorUserId, organisationId);
  const [organisation] = await db.select({ id: organisations.id, name: organisations.name })
    .from(organisations).where(and(eq(organisations.id, organisationId), eq(organisations.status, 'active'))).limit(1);
  if (!organisation) throw new TeacherAssignmentError('Organisation not found or inactive', 404);

  const [teachers, learningAreas, classList, assignmentResult] = await Promise.all([
    db.select({ userId: authUsers.id, name: authUsers.name, email: authUsers.email })
      .from(organisationMemberships)
      .innerJoin(authUsers, eq(organisationMemberships.userId, authUsers.id))
      .where(and(eq(organisationMemberships.organisationId, organisationId), eq(organisationMemberships.role, 'teacher'),
        eq(organisationMemberships.status, 'active'), eq(authUsers.emailVerified, true), or(eq(authUsers.banned, false), isNull(authUsers.banned)))),
    db.select({ id: curriculumLearningAreas.id, name: curriculumLearningAreas.name })
      .from(curriculumLearningAreas).orderBy(curriculumLearningAreas.name),
    listClasses(actorUserId, organisationId),
    withAuthenticatedLearnerDb(actorUserId, async (tx) => tx.execute(sql`
      SELECT assignment.id, assignment.teacher_user_id, auth_user.name AS teacher_name,
        auth_user.email AS teacher_email, assignment.class_id, class_record.class_code,
        class_record.display_name AS class_name, assignment.learning_area_id, area.name AS learning_area,
        assignment.grade, assignment.academic_year, assignment.starts_on, assignment.ends_on,
        assignment.status, assignment.created_at
      FROM public.teacher_class_assignments assignment
      INNER JOIN neon_auth."user" auth_user ON auth_user.id = assignment.teacher_user_id
      INNER JOIN public.classes class_record ON class_record.id = assignment.class_id
        AND class_record.organisation_id = assignment.organisation_id
      INNER JOIN public.curriculum_learning_areas area ON area.id = assignment.learning_area_id
      WHERE assignment.organisation_id = ${organisationId}::uuid
      ORDER BY assignment.status, class_record.grade, class_record.class_code, area.name, auth_user.name
    `)),
  ]);
  return { organisation, teachers, learningAreas, classes: classList, assignments: assignmentResult.rows };
}

export async function createTeacherClassAssignment(
  actorUserId: string, organisationId: string, teacherUserId: string, classId: string,
  learningAreaId: string, startsOn: string, endsOn: string | null,
) {
  await assertTeacherAssignmentManager(actorUserId, organisationId);
  if (![organisationId, teacherUserId, classId, learningAreaId].every(value => uuidPattern.test(value))) {
    throw new TeacherAssignmentError('Valid organisation, teacher, class and learning-area identifiers are required', 400);
  }
  if (!datePattern.test(startsOn) || (endsOn !== null && !datePattern.test(endsOn)) || (endsOn !== null && endsOn <= startsOn)) {
    throw new TeacherAssignmentError('A valid effective date range is required', 400);
  }
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.create_teacher_class_assignment(
      ${organisationId}::uuid, ${teacherUserId}::uuid, ${classId}::uuid,
      ${learningAreaId}::uuid, ${startsOn}::date, ${endsOn}::date
    ) AS assignment_id`);
    const assignmentId = result.rows[0]?.assignment_id;
    if (!assignmentId) throw new TeacherAssignmentError('The database did not confirm the teacher assignment');
    return { assignmentId };
  });
}

export async function revokeTeacherClassAssignment(actorUserId: string, organisationId: string, assignmentId: string) {
  await requireLearnerManager(actorUserId, organisationId);
  if (!uuidPattern.test(assignmentId)) throw new TeacherAssignmentError('A valid assignment identifier is required', 400);
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.revoke_teacher_class_assignment(
      ${organisationId}::uuid, ${assignmentId}::uuid
    ) AS revoked_at`);
    if (!result.rows[0]?.revoked_at) throw new TeacherAssignmentError('The database did not confirm the assignment revocation');
    return { assignmentId, status: 'revoked' as const, revokedAt: result.rows[0].revoked_at };
  });
}
