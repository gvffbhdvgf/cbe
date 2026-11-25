# ADR-004 — Controlled Learner Class Placement

**Status:** Accepted for the development foundation; subject to integration and safeguarding review before a live learner pilot.  
**Date:** 25 November 2026

## Context

Class groups are organisation-owned and scoped by grade and academic year. Learner enrolments already have a nullable `class_id` and a composite foreign key requiring the class to match the enrolment's tenant, organisation, grade and academic year.

Granting general UPDATE on `learner_enrolments` would let the restricted runtime role change more than class placement. Placement therefore needs a narrow operation.

## Decision

- Initial placement is permitted only for an active enrolment with no current class assignment.
- The selected class must be active and match the enrolment's tenant, organisation, grade and academic year.
- The effective date must fall within the enrolment's active date range.
- Only an active platform administrator or active organisation/school administrator may place a learner.
- A database SECURITY DEFINER function `sentinel_private.assign_learner_to_class` performs the narrow update. The runtime role receives EXECUTE on this function, not general UPDATE on `learner_enrolments`.
- The operation updates only `class_id` and `updated_at`, and inserts a `class_assigned` progression event and audit event in the same transaction.
- Repeating the same placement is idempotent. Reassignment to a different class is rejected until a separate approved workflow exists.

## Security properties

- The function reads identity from the transaction-local verified claims established by the server-side JWKS verification boundary.
- The enrolment lookup is filtered by active administrator authority; unauthorised or unknown enrolment IDs produce the same non-disclosing not-found error.
- The function uses a fixed search path and is not executable by PUBLIC.
- The runtime login has no UPDATE or DELETE privilege on learner enrolments.

## Consequences and follow-up

- Class reassignment, transfer, withdrawal, progression approval and year rollover require separate state transitions and audit semantics.
- Positive placement and cross-tenant tests with governed synthetic accounts remain required.
- No teacher allocation or capacity logic is inferred.
- The restricted connection must be configured in the intended Preview environment before the UI workflow can run end to end.

Implementation: [placement service](https://github.com/gvffbhdvgf/cbe/blob/sentinel/bootstrap/sentinel/src/application/learner/class-placement-service.ts), [migration 0010](https://github.com/gvffbhdvgf/cbe/blob/sentinel/bootstrap/sentinel/src/infrastructure/database/migrations/0010_controlled_class_placement.sql).
