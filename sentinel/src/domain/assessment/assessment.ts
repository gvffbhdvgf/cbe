export type AssessmentEventStatus = 'draft' | 'scheduled' | 'open' | 'closed' | 'marking' | 'moderated' | 'approved' | 'published' | 'corrected' | 'archived';
export type AssessmentEventContext = { moderationRequired: boolean; instrumentApproved?: boolean; eligibleLearnersConfirmed?: boolean; allAttemptsClosed?: boolean; allResultsMarked?: boolean; allResultsModerated?: boolean; allResultsApproved?: boolean; correctedResultsApproved?: boolean; reason?: string };
const eventTransitions: Record<AssessmentEventStatus, readonly AssessmentEventStatus[]> = {
  draft: ['scheduled', 'archived'], scheduled: ['draft', 'open', 'archived'], open: ['closed'], closed: ['marking', 'archived'],
  marking: ['moderated', 'approved'], moderated: ['approved'], approved: ['published'], published: ['corrected'], corrected: ['published'], archived: [],
};
export function transitionAssessmentEvent(current: AssessmentEventStatus, next: AssessmentEventStatus, context: AssessmentEventContext): AssessmentEventStatus {
  if (!eventTransitions[current].includes(next)) throw new Error(`Assessment event cannot transition from ${current} to ${next}`);
  if (next === 'scheduled' && (!context.instrumentApproved || !context.eligibleLearnersConfirmed)) throw new Error('Scheduling requires an approved instrument and confirmed eligible learners');
  if (next === 'open' && !context.instrumentApproved) throw new Error('Opening an event requires an approved instrument');
  if (next === 'marking' && !context.allAttemptsClosed) throw new Error('Marking can begin only after all attempts are closed');
  if (next === 'moderated' && (!context.moderationRequired || !context.allResultsMarked || !context.allResultsModerated)) throw new Error('Moderation requires a moderation policy and all results to be marked and moderated');
  if (next === 'approved' && (!context.allResultsMarked || (context.moderationRequired && !context.allResultsModerated))) throw new Error('Approval requires all results to be marked and complete moderation where required');
  if (next === 'published' && !(context.allResultsApproved || context.correctedResultsApproved)) throw new Error('Publication requires all results to be approved');
  if (next === 'corrected' && !context.reason?.trim()) throw new Error('A reason is required to correct a published assessment event');
  return next;
}
export type AssessmentAttemptStatus = 'draft' | 'in_progress' | 'submitted' | 'marked' | 'moderated' | 'approved' | 'voided';
export type AssessmentAttemptContext = { moderationRequired: boolean; allTasksMarked?: boolean; moderationComplete?: boolean; reason?: string };
const attemptTransitions: Record<AssessmentAttemptStatus, readonly AssessmentAttemptStatus[]> = {
  draft: ['in_progress', 'voided'], in_progress: ['submitted', 'voided'], submitted: ['marked', 'voided'],
  marked: ['moderated', 'approved', 'voided'], moderated: ['approved', 'voided'], approved: [], voided: [],
};
export function transitionAssessmentAttempt(current: AssessmentAttemptStatus, next: AssessmentAttemptStatus, context: AssessmentAttemptContext): AssessmentAttemptStatus {
  if (!attemptTransitions[current].includes(next)) throw new Error(`Assessment attempt cannot transition from ${current} to ${next}`);
  if (next === 'marked' && !context.allTasksMarked) throw new Error('An attempt can be marked only when every required task has a mark');
  if (next === 'moderated' && (!context.moderationRequired || !context.moderationComplete)) throw new Error('Attempt moderation is not complete or is not required');
  if (next === 'approved' && context.moderationRequired && !context.moderationComplete) throw new Error('A moderated assessment attempt must complete moderation before approval');
  if (next === 'voided' && !context.reason?.trim()) throw new Error('Voiding an assessment attempt requires a reason');
  return next;
}
export type AssessmentEventDefinition = { tenantOrganisationId: string; organisationId: string; grade: number; academicYear: number; learningAreaId: string; title: string; startsAt: string; endsAt: string };
function parseDate(value: string, label: string): Date {
  const parsed = new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value) || Number.isNaN(parsed.getTime())) throw new Error(`${label} must be a valid ISO date or timestamp`);
  return parsed;
}
export function createAssessmentEventDefinition(input: AssessmentEventDefinition) {
  for (const [label, value] of [['Tenant organisation', input.tenantOrganisationId], ['Organisation', input.organisationId], ['Learning area', input.learningAreaId]] as const) if (!value.trim()) throw new Error(`${label} is required`);
  if (!Number.isInteger(input.grade) || input.grade < 1 || input.grade > 9) throw new Error('Grade must be an integer from 1 to 9');
  if (!Number.isInteger(input.academicYear) || input.academicYear < 2000 || input.academicYear > 2100) throw new Error('Academic year must be between 2000 and 2100');
  const title = input.title.trim();
  if (!title || title.length > 160) throw new Error('Assessment title is required and must be 160 characters or fewer');
  if (parseDate(input.endsAt, 'Assessment end') <= parseDate(input.startsAt, 'Assessment start')) throw new Error('Assessment end must be after its start');
  return { ...input, title };
}
export type AssessmentEnrolmentSnapshot = { id: string; tenantOrganisationId: string; organisationId: string; grade: number; academicYear: number };
export function createAssessmentAttemptDefinition(input: { event: AssessmentEventDefinition; enrolment: AssessmentEnrolmentSnapshot; instrumentVersionId: string; attemptNumber: number }) {
  const { event, enrolment } = input;
  if (!enrolment.id.trim() || !input.instrumentVersionId.trim()) throw new Error('An enrolment and instrument version are required');
  if (event.tenantOrganisationId !== enrolment.tenantOrganisationId || event.organisationId !== enrolment.organisationId) throw new Error('Assessment event and learner enrolment must belong to the same tenant and organisation');
  if (event.grade !== enrolment.grade || event.academicYear !== enrolment.academicYear) throw new Error('Learner enrolment grade and academic year must match the assessment event');
  if (!Number.isInteger(input.attemptNumber) || input.attemptNumber < 1) throw new Error('Attempt number must be a positive integer');
  return { enrolmentId: enrolment.id, instrumentVersionId: input.instrumentVersionId, attemptNumber: input.attemptNumber };
}
export function createAssessmentTaskDefinition(input: { code: string; title: string; maximumScore: number; required: boolean }) {
  const code = input.code.trim().toUpperCase(); const title = input.title.trim();
  if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(code)) throw new Error('Task code must use 1–40 letters, numbers, hyphens or underscores');
  if (!title || title.length > 200) throw new Error('Task title is required and must be 200 characters or fewer');
  if (!Number.isFinite(input.maximumScore) || input.maximumScore <= 0 || input.maximumScore > 100000) throw new Error('Task maximum score must be greater than zero and no more than 100000');
  return { ...input, code, title };
}
export function validateAwardedScore(awardedScore: number, maximumScore: number) {
  if (!Number.isFinite(maximumScore) || maximumScore <= 0) throw new Error('A positive task maximum score is required');
  if (!Number.isFinite(awardedScore) || awardedScore < 0 || awardedScore > maximumScore) throw new Error('Awarded score must be between zero and the task maximum');
  return awardedScore;
}
export type PerformanceLevel = { code: string; label: string; minimumPercent: number; maximumPercent: number };
export function validatePerformanceLevels(levels: PerformanceLevel[]) {
  if (!levels.length) throw new Error('At least one performance level is required');
  const sorted = [...levels].sort((a, b) => a.minimumPercent - b.minimumPercent);
  for (const level of sorted) {
    if (!level.code.trim() || !level.label.trim()) throw new Error('Performance level code and label are required');
    if (!Number.isFinite(level.minimumPercent) || !Number.isFinite(level.maximumPercent) || level.minimumPercent < 0 || level.maximumPercent > 100 || level.minimumPercent > level.maximumPercent) throw new Error('Performance level bounds must be valid percentages from 0 to 100');
  }
  for (let i = 1; i < sorted.length; i++) if (sorted[i].minimumPercent <= sorted[i - 1].maximumPercent) throw new Error('Performance level ranges must not overlap');
  return sorted;
}
export function assertInstrumentVersionEditable(hasAttempts: boolean) {
  if (hasAttempts) throw new Error('An instrument version with assessment attempts is immutable; create a new version');
}

