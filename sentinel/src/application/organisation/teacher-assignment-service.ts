import { and, asc, eq, gt, isNull, or } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db } from '@/infrastructure/database/client';
import { organisations } from '@/infrastructure/database/schema/organisation';
import { authUsers, organisationMemberships } from '@/infrastructure/database/schema/security';
import { curriculumLearningAreas } from '@/infrastructure/database/schema/curriculum';
import { classes, teacherClassAssignments } from '@/infrastructure/database/schema/learner';
import { staffProfiles, staffEngagements } from '@/infrastructure/database/schema/staff';
import { teacherWeeklyWorkloadAllocations, teacherWorkloadPolicies } from '@/infrastructure/database/schema/teacher-workload';
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
  const [organisation] = await db.select({ id: organisations.id, name: organisations.name, timeZone: organisations.timeZone })
    .from(organisations).where(and(eq(organisations.id, organisationId), eq(organisations.status, 'active'))).limit(1);
  if (!organisation) throw new TeacherAssignmentError('Organisation not found or inactive', 404);

  const [teachers, learningAreas, classList, assignmentResult] = await Promise.all([
    db.select({ userId: authUsers.id, name: authUsers.name, email: authUsers.email, staffReference: staffProfiles.staffReference })
      .from(organisationMemberships)
      .innerJoin(authUsers, eq(organisationMemberships.userId, authUsers.id))
      .innerJoin(staffProfiles, and(eq(staffProfiles.userId, authUsers.id), eq(staffProfiles.organisationId, organisationId),
        eq(staffProfiles.staffCategory, 'teacher'), eq(staffProfiles.status, 'active')))
      .innerJoin(staffEngagements, and(eq(staffEngagements.staffProfileId, staffProfiles.id),
        or(eq(staffEngagements.status, 'active'), eq(staffEngagements.status, 'planned'))))
      .where(and(eq(organisationMemberships.organisationId, organisationId), eq(organisationMemberships.role, 'teacher'),
        eq(organisationMemberships.status, 'active'), eq(authUsers.emailVerified, true), or(eq(authUsers.banned, false), isNull(authUsers.banned)),
        or(isNull(organisationMemberships.endsAt), gt(organisationMemberships.endsAt, new Date())))),
    db.select({ id: curriculumLearningAreas.id, name: curriculumLearningAreas.name })
      .from(curriculumLearningAreas).orderBy(curriculumLearningAreas.name),
    listClasses(actorUserId, organisationId),
    db.select({
      id: teacherClassAssignments.id,
      teacher_user_id: teacherClassAssignments.teacherUserId,
      teacher_name: authUsers.name,
      teacher_email: authUsers.email,
      teacher_staff_reference: staffProfiles.staffReference,
      class_id: teacherClassAssignments.classId,
      class_code: classes.classCode,
      class_name: classes.displayName,
      learning_area_id: teacherClassAssignments.learningAreaId,
      learning_area: curriculumLearningAreas.name,
      grade: teacherClassAssignments.grade,
      academic_year: teacherClassAssignments.academicYear,
      starts_on: teacherClassAssignments.startsOn,
      ends_on: teacherClassAssignments.endsOn,
      status: teacherClassAssignments.status,
      created_at: teacherClassAssignments.createdAt,
    }).from(teacherClassAssignments)
      .innerJoin(authUsers, eq(teacherClassAssignments.teacherUserId, authUsers.id))
      .leftJoin(staffProfiles, and(eq(staffProfiles.userId, teacherClassAssignments.teacherUserId), eq(staffProfiles.organisationId, organisationId)))
      .innerJoin(classes, and(eq(teacherClassAssignments.classId, classes.id), eq(teacherClassAssignments.organisationId, classes.organisationId)))
      .innerJoin(curriculumLearningAreas, eq(teacherClassAssignments.learningAreaId, curriculumLearningAreas.id))
      .where(eq(teacherClassAssignments.organisationId, organisationId))
      .orderBy(asc(teacherClassAssignments.status), asc(teacherClassAssignments.grade), asc(classes.classCode), asc(curriculumLearningAreas.name), asc(authUsers.name)),
  ]);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: organisation.timeZone }).format(new Date());
  const [workloadAllocations, workloadPolicies] = await withAuthenticatedLearnerDb(actorUserId, async (tx) => Promise.all([
    tx.select({ id: teacherWeeklyWorkloadAllocations.id, teacherAssignmentId: teacherWeeklyWorkloadAllocations.teacherAssignmentId, weeklyPeriods: teacherWeeklyWorkloadAllocations.weeklyPeriods, startsOn: teacherWeeklyWorkloadAllocations.startsOn, endsOn: teacherWeeklyWorkloadAllocations.endsOn, status: teacherWeeklyWorkloadAllocations.status }).from(teacherWeeklyWorkloadAllocations).where(eq(teacherWeeklyWorkloadAllocations.organisationId, organisationId)),
    tx.select({ id: teacherWorkloadPolicies.id, academicYear: teacherWorkloadPolicies.academicYear, referenceWeeklyPeriods: teacherWorkloadPolicies.referenceWeeklyPeriods, maximumWeeklyPeriods: teacherWorkloadPolicies.maximumWeeklyPeriods, periodDurationMinutes: teacherWorkloadPolicies.periodDurationMinutes, effectiveFrom: teacherWorkloadPolicies.effectiveFrom }).from(teacherWorkloadPolicies).where(eq(teacherWorkloadPolicies.organisationId, organisationId)),
  ]));
  const assignments = assignmentResult.map(assignment => {
    const active = workloadAllocations.filter(allocation => allocation.teacherAssignmentId === assignment.id && allocation.status === 'active' && allocation.startsOn <= today && (allocation.endsOn === null || allocation.endsOn > today)).sort((a,b) => b.startsOn.localeCompare(a.startsOn))[0];
    return { ...assignment, weekly_periods: active?.weeklyPeriods ?? null, workload_allocation_id: active?.id ?? null };
  });
  return { organisation, teachers, learningAreas, classes: classList, assignments, workloadPolicies, asOfDate: today };
}

export async function createTeacherClassAssignment(
  actorUserId: string, organisationId: string, teacherUserId: string, classId: string,
  learningAreaId: string, startsOn: string, endsOn: string | null, weeklyPeriods: number, workloadReason: string,
) {
  await assertTeacherAssignmentManager(actorUserId, organisationId);
  if (![organisationId, teacherUserId, classId, learningAreaId].every(value => uuidPattern.test(value))) {
    throw new TeacherAssignmentError('Valid organisation, teacher, class and learning-area identifiers are required', 400);
  }
  if (!datePattern.test(startsOn) || (endsOn !== null && !datePattern.test(endsOn)) || (endsOn !== null && endsOn <= startsOn)) {
    throw new TeacherAssignmentError('A valid effective date range is required', 400);
  }
  if (!Number.isInteger(weeklyPeriods) || weeklyPeriods < 1 || weeklyPeriods > 60) throw new TeacherAssignmentError('Weekly periods must be between 1 and 60', 400);
  if (workloadReason.trim().length < 10 || workloadReason.trim().length > 500) throw new TeacherAssignmentError('A workload reason of 10 to 500 characters is required', 400);
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.create_teacher_class_assignment(
      ${organisationId}::uuid, ${teacherUserId}::uuid, ${classId}::uuid,
      ${learningAreaId}::uuid, ${startsOn}::date, ${endsOn}::date
    ) AS assignment_id`);
    const assignmentId = result.rows[0]?.assignment_id;
    if (!assignmentId) throw new TeacherAssignmentError('The database did not confirm the teacher assignment');
    await tx.execute(sql`SELECT sentinel_private.set_teacher_weekly_workload_allocation(${organisationId}::uuid, ${assignmentId}::uuid, ${weeklyPeriods}::integer, ${startsOn}::date, ${endsOn}::date, ${workloadReason})`);
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

export async function setTeacherWorkloadPolicy(actorUserId: string, organisationId: string, academicYear: number, referenceWeeklyPeriods: number, maximumWeeklyPeriods: number, periodDurationMinutes: number | null, effectiveFrom: string, reason: string) {
  await assertTeacherAssignmentManager(actorUserId, organisationId);
  if (!Number.isInteger(academicYear) || !Number.isInteger(referenceWeeklyPeriods) || !Number.isInteger(maximumWeeklyPeriods) || (periodDurationMinutes !== null && !Number.isInteger(periodDurationMinutes)) || !datePattern.test(effectiveFrom) || reason.trim().length < 10 || reason.trim().length > 500) {
    throw new TeacherAssignmentError('Valid workload policy values, effective date and reason are required', 400);
  }
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.set_teacher_workload_policy(${organisationId}::uuid, ${academicYear}::integer, ${referenceWeeklyPeriods}::integer, ${maximumWeeklyPeriods}::integer, ${periodDurationMinutes}::integer, ${effectiveFrom}::date, ${reason}) AS policy_id`);
    const policyId = result.rows[0]?.policy_id;
    if (!policyId) throw new TeacherAssignmentError('The database did not confirm the workload policy');
    return { policyId };
  });
}

export async function reviseTeacherWeeklyWorkloadAllocation(actorUserId: string, organisationId: string, assignmentId: string, weeklyPeriods: number, effectiveFrom: string, reason: string) {
  await assertTeacherAssignmentManager(actorUserId, organisationId);
  if (!uuidPattern.test(assignmentId) || !Number.isInteger(weeklyPeriods) || weeklyPeriods < 1 || weeklyPeriods > 60 || !datePattern.test(effectiveFrom) || reason.trim().length < 10 || reason.trim().length > 500) {
    throw new TeacherAssignmentError('A valid assignment, weekly period count, effective date and reason are required', 400);
  }
  return withAuthenticatedLearnerDb(actorUserId, async (tx) => {
    const result = await tx.execute(sql`SELECT sentinel_private.set_teacher_weekly_workload_allocation(${organisationId}::uuid, ${assignmentId}::uuid, ${weeklyPeriods}::integer, ${effectiveFrom}::date, NULL::date, ${reason}) AS allocation_id`);
    const allocationId = result.rows[0]?.allocation_id;
    if (!allocationId) throw new TeacherAssignmentError('The database did not confirm the workload revision');
    return { allocationId };
  });
}
