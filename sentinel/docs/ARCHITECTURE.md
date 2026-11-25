# Sentinel — Architecture Decision Record (Initial)

**Status:** Proposed; validate against the repository, hosting constraints and pilot requirements.

## Decision 1: Start as a modular monolith
Keep one deployable application with explicit domain modules and service boundaries. Avoid microservices until independent scaling, team ownership or operational requirements justify their cost.

## Proposed stack
- Next.js + TypeScript web application
- Accessible component library and responsive UI
- PostgreSQL on Neon
- Prisma ORM, subject to runtime and migration compatibility
- Cloudflare DNS, CDN, WAF and R2 for controlled object storage
- Background job mechanism for imports, exports and report generation
- Resend or SenderKit for transactional communications after workflow evaluation
- Vercel only where project access, runtime support and deployment controls are verified

## Domain boundaries
- Identity & Access
- Organisation
- Curriculum
- Assessment Authoring
- Assessment Capture & Imports
- Results & Scoring
- Learner Records
- Progress & Evidence
- Intervention
- Analytics & Reporting
- Audit & Administration

## Data invariants
1. Learner identity is independent of school enrolment.
2. Enrolments are time-bounded and retain transfer history.
3. Every result references an assessment attempt and scoring context.
4. Every curriculum mapping references a curriculum version.
5. Raw score, performance level and outcome mastery are separate fields/concepts.
6. Imported source data and approved corrections remain traceable.
7. All queries involving identifiable learner records enforce organisation scope server-side.

## Initial deployment policy
- Do not deploy production from every commit.
- Keep feature branches and pull requests non-deploying by default until project settings are inspected.
- Use an explicit release branch or manual deployment approval.
- Production promotion requires passing tests, reviewed migration plan and release checklist.
- Verify Vercel Git integration, ignored build settings and deployment protection before enabling any automation.

## Environments
- Local development
- Shared preview/staging (only after controlled deployment setup)
- Production

Use separate databases and credentials for each environment. Never reuse production credentials locally.

## Observability and operations
- Structured application logs with sensitive values redacted
- Request correlation IDs
- Audit events for sensitive operations
- Background-job status and retry visibility
- Database backup and restore runbooks
- Error monitoring and health checks
- Release and rollback procedures

## Open technical decisions
- Authentication provider and account lifecycle
- Exact tenancy model: shared database with enforced scope vs separate schemas/databases
- Runtime/hosting constraints for database access and background work
- Offline data capture and conflict resolution
- File malware scanning and retention
- Notification provider and delivery policy
- Data residency, backup and recovery objectives
