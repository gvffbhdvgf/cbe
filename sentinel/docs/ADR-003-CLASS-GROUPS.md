# ADR-003 — Organisation Class Groups

**Status:** Accepted for the initial development foundation.  
**Date:** 25 November 2026

## Decision

A class group is an organisation-owned teaching group scoped to one KICD grade (1–9) and one academic year. Each class has a normalised class code and a human-readable display name. Class codes are unique within an organisation, grade and academic year.

The existing enrolment composite foreign key ensures that a learner enrolment's tenant, organisation, class, grade and academic year agree. Class creation and listing are implemented through the restricted learner runtime role and RLS; class creation is audited and permitted only to an active platform administrator or active organisation/school administrator.

## Explicitly out of scope

- Learner placement or reassignment to a class.
- Teacher allocation and timetable ownership.
- Class capacity, waiting lists or automatic balancing.
- Class updates, archiving and deletion.
- Cross-organisation class sharing.

These require validated school workflows, authority rules, effective dates, audit requirements and migration policies. They must not be inferred from the current schema.

## Consequences

- A class cannot be created for a grade outside 1–9 or an invalid academic year.
- A class code is trimmed and uppercased before persistence.
- Duplicate class codes in the same organisation/grade/year return a conflict.
- Learner placement is a separate milestone and must validate the learner's active enrolment grade/year against the selected class.
- UPDATE and DELETE remain ungranted to the restricted runtime role.

Implementation: [class service](https://github.com/gvffbhdvgf/cbe/blob/sentinel/bootstrap/sentinel/src/application/learner/class-service.ts), [migration 0009](https://github.com/gvffbhdvgf/cbe/blob/sentinel/bootstrap/sentinel/src/infrastructure/database/migrations/0009_class_creation_rls.sql).
