import { describe, expect, it } from 'vitest';
import { assertInstrumentVersionEditable, createAssessmentAttemptDefinition, createAssessmentEventDefinition, createAssessmentTaskDefinition, transitionAssessmentAttempt, transitionAssessmentEvent, validateAwardedScore, validatePerformanceLevels } from './assessment';
const event = createAssessmentEventDefinition({ tenantOrganisationId: 'tenant-a', organisationId: 'school-a', grade: 6, academicYear: 2026, learningAreaId: 'cre', title: ' Term 1 CRE Assessment ', startsAt: '2026-02-01', endsAt: '2026-02-10' });
describe('assessment event contracts', () => {
  it('validates grade, year, title and period', () => { expect(event.title).toBe('Term 1 CRE Assessment'); expect(() => createAssessmentEventDefinition({ ...event, grade: 10 })).toThrow('Grade must be an integer'); expect(() => createAssessmentEventDefinition({ ...event, endsAt: '2026-01-31' })).toThrow('end must be after'); });
  it('requires approved instrument and eligibility before scheduling', () => { expect(() => transitionAssessmentEvent('draft', 'scheduled', { moderationRequired: false })).toThrow('approved instrument'); expect(transitionAssessmentEvent('draft', 'scheduled', { moderationRequired: false, instrumentApproved: true, eligibleLearnersConfirmed: true })).toBe('scheduled'); });
  it('prevents skipping lifecycle stages', () => { expect(() => transitionAssessmentEvent('draft', 'published', { moderationRequired: false, allResultsMarked: true, allResultsApproved: true })).toThrow('cannot transition'); });
  it('requires moderation before approval when configured', () => { expect(() => transitionAssessmentEvent('marking', 'approved', { moderationRequired: true, allResultsMarked: true })).toThrow('complete moderation'); expect(transitionAssessmentEvent('moderated', 'approved', { moderationRequired: true, allResultsMarked: true, allResultsModerated: true })).toBe('approved'); });
  it('requires reasons for corrections and approvals for republication', () => { expect(() => transitionAssessmentEvent('published', 'corrected', { moderationRequired: false })).toThrow('reason is required'); expect(transitionAssessmentEvent('published', 'corrected', { moderationRequired: false, reason: 'Transcription correction' })).toBe('corrected'); expect(() => transitionAssessmentEvent('corrected', 'published', { moderationRequired: false })).toThrow('approved'); });
});
describe('assessment attempt contracts', () => {
  const enrolment = { id: 'enrolment-1', tenantOrganisationId: 'tenant-a', organisationId: 'school-a', grade: 6, academicYear: 2026 };
  it('binds attempts to matching tenant, school, grade and year enrolments', () => {
    expect(createAssessmentAttemptDefinition({ event, enrolment, instrumentVersionId: 'instrument-v1', attemptNumber: 1 })).toEqual({ enrolmentId: 'enrolment-1', instrumentVersionId: 'instrument-v1', attemptNumber: 1 });
    expect(() => createAssessmentAttemptDefinition({ event, enrolment: { ...enrolment, organisationId: 'school-b' }, instrumentVersionId: 'instrument-v1', attemptNumber: 1 })).toThrow('same tenant and organisation');
    expect(() => createAssessmentAttemptDefinition({ event, enrolment: { ...enrolment, grade: 5 }, instrumentVersionId: 'instrument-v1', attemptNumber: 1 })).toThrow('grade and academic year');
  });
  it('requires positive attempt numbers', () => { expect(() => createAssessmentAttemptDefinition({ event, enrolment, instrumentVersionId: 'instrument-v1', attemptNumber: 0 })).toThrow('positive integer'); });
  it('requires marks and moderation before approval and preserves approved attempts', () => {
    expect(() => transitionAssessmentAttempt('submitted', 'marked', { moderationRequired: false })).toThrow('every required task');
    expect(transitionAssessmentAttempt('submitted', 'marked', { moderationRequired: false, allTasksMarked: true })).toBe('marked');
    expect(() => transitionAssessmentAttempt('marked', 'approved', { moderationRequired: true })).toThrow('complete moderation');
    expect(transitionAssessmentAttempt('marked', 'moderated', { moderationRequired: true, moderationComplete: true })).toBe('moderated');
    expect(transitionAssessmentAttempt('moderated', 'approved', { moderationRequired: true, moderationComplete: true })).toBe('approved');
    expect(() => transitionAssessmentAttempt('approved', 'voided', { moderationRequired: false, reason: 'wrong' })).toThrow('cannot transition');
  });
  it('requires a reason to void an attempt', () => { expect(() => transitionAssessmentAttempt('in_progress', 'voided', { moderationRequired: false })).toThrow('requires a reason'); });
});
describe('assessment instrument and scoring contracts', () => {
  it('validates task identifiers and maxima', () => { expect(createAssessmentTaskDefinition({ code: 'q1', title: 'Question 1', maximumScore: 10, required: true }).code).toBe('Q1'); expect(() => createAssessmentTaskDefinition({ code: 'q1', title: 'Question 1', maximumScore: 0, required: true })).toThrow('maximum score'); });
  it('keeps awarded scores within task maximum', () => { expect(validateAwardedScore(7.5, 10)).toBe(7.5); expect(() => validateAwardedScore(11, 10)).toThrow('between zero and the task maximum'); });
  it('rejects overlapping performance bands without inventing mastery', () => { expect(validatePerformanceLevels([{ code: 'BE', label: 'Below', minimumPercent: 0, maximumPercent: 39 }, { code: 'ME', label: 'Meets', minimumPercent: 40, maximumPercent: 69 }, { code: 'AE', label: 'Above', minimumPercent: 70, maximumPercent: 100 }])).toHaveLength(3); expect(() => validatePerformanceLevels([{ code: 'A', label: 'A', minimumPercent: 0, maximumPercent: 50 }, { code: 'B', label: 'B', minimumPercent: 50, maximumPercent: 100 }])).toThrow('must not overlap'); });
  it('locks an instrument version once attempts exist', () => { expect(() => assertInstrumentVersionEditable(true)).toThrow('create a new version'); expect(() => assertInstrumentVersionEditable(false)).not.toThrow(); });
});

