# Sentinel — Engineering Continuation Checkpoint

## 26 November 2026 — Assessment governance and correction milestones

Latest source commit: [a61476b](https://github.com/gvffbhdvgf/cbe/commit/a61476b4c96e86f4e00c89313b2ae53e40efc016). GitHub Actions [45716241617](https://github.com/gvffbhdvgf/cbe/actions/runs/45716241617) passed migration-journal validation, lint, TypeScript, 114 tests across 20 files and the production build.

Migrations 0017 and 0018 are registered and applied to the isolated Neon development branch:
- Moderation, approval, correction-request and publication decisions are append-only. Result records are never updated; a read-only security-invoker view derives the current lifecycle state.
- Moderation is distinct from approval. Markers cannot moderate their own results; result approval is restricted to organisation/school administrators and requires independence from marker and moderator; publication requires prior approval and an independent publisher.
- A moderation rejection can be followed by a reasoned correction request. Corrected task marks append new versions; corrected-result finalization creates a new immutable result version linked to the prior result and records a supersession decision.
- Authenticated API routes expose result decisions, corrected mark capture and corrected-result finalization.

Neon development verification confirmed the decision and correction functions are SECURITY DEFINER with PUBLIC execution revoked and narrow runtime EXECUTE grants. The lifecycle view is security-invoker and read-only. The mark table remains forced-RLS and runtime SELECT-only. Unauthenticated calls to new decision/correction functions were rejected with SQLSTATE 42501. Migrations 0017 and 0018 were also executed successfully on a disposable child branch, which was deleted afterward. No learner, attempt, mark, result or decision records were created. Production database and deployment remain unchanged.

The initial result denominator includes required tasks only; optional tasks remain excluded pending a richer scoring-scheme model. Post-publication correction and full UI workflows remain future work.

Implementation references:
- [Migration 0017 — governance](https://github.com/gvffbhdvgf/cbe/blob/sentinel/bootstrap/sentinel/src/infrastructure/database/migrations/0017_assessment_result_governance.sql)
- [Migration 0018 — result correction](https://github.com/gvffbhdvgf/cbe/blob/sentinel/bootstrap/sentinel/src/infrastructure/database/migrations/0018_assessment_result_correction.sql)
- [Assessment lifecycle design](https://github.com/gvffbhdvgf/cbe/blob/sentinel/bootstrap/sentinel/docs/ASSESSMENT_LIFECYCLE_DESIGN.md)
- [Engineering continuation checkpoint](https://github.com/gvffbhdvgf/cbe/blob/sentinel/bootstrap/sentinel/docs/ENGINEERING_CONTINUATION_CHECKPOINT.md)

## 26 November 2026 — Assessment marking and result-generation milestone

Latest source commit: [a61476b](https://github.com/gvffbhdvgf/cbe/commit/a61476b4c96e86f4e00c89313b2ae53e40efc016). GitHub Actions [45716241617](https://github.com/gvffbhdvgf/cbe/actions/runs/45716241617) passed migration-journal validation, lint, TypeScript, 114 tests across 20 files, and the production build.

Migrations 0016–0018 are registered and applied to the isolated Neon development branch only. They add:
- Append-only, versioned task marks separate from immutable learner response evidence.
- Task maximum-score enforcement and reasoned supersession of the latest mark before result finalization.
- Reason-required voiding of incomplete in-progress attempts after the event end; event closure is blocked until all attempts are submitted or voided.
- Atomic result generation after every required task has a captured response and latest mark. Result version 1 is immutable; the attempt advances to `marked`.
- Authenticated routes for event closure, attempt voiding, task marking and marking finalization.

Database verification on the development branch confirmed forced RLS on `assessment_response_marks`, runtime SELECT-only table access (no INSERT/UPDATE/DELETE), and SECURITY DEFINER-only function access with PUBLIC execution revoked. Unauthenticated calls to all four new privileged functions were rejected with SQLSTATE 42501. A temporary child branch was used to validate the complete migration transaction and was deleted afterward. No assessment records were created. Production database and deployment remain unchanged.

The initial result denominator currently includes required tasks only; optional tasks are excluded pending a richer scoring-scheme model. Post-publication correction and full UI workflows remain future work.

**Date:** 26 November 2026
**Repository:** [gvffbhdvgf/cbe](https://github.com/gvffbhdvgf/cbe)
**Branch:** `sentinel/bootstrap`
**Latest implementation commit:** Follow the current `sentinel/bootstrap` branch head; do not rely on a pinned historical SHA.
**Latest documentation checkpoint:** 26 November 2026; this file is maintained with the branch status.

## 1. Application and dependencies

Sentinel is a Next.js App Router modular monolith using TypeScript, React 19, Neon Managed Auth, Neon PostgreSQL 17, Drizzle ORM, the Neon serverless Pool driver and Vitest.

| Package | Declared version |
|---|---:|
| Next.js | 16.4.6 |
| React / React DOM | 19.3.0 |
| `@neon/auth` | ^0.8.2 |
| `@neondatabase/serverless` | ^1.2.1 |
| Drizzle ORM | ^0.45.4 |
| `jose` | 6.2.5 |
| Vitest | ^4.1.12 |
| TypeScript | ^5 |
| ESLint | ^9 |

## 2. Implemented capabilities

- Managed Neon Auth sign-in; public self-service registration remains disabled.
- Organisation onboarding and organisation-scoped membership administration.
- Tenant-scoped learner identity, profiles, classes, enrolments, guardian relationship and progression-event schema.
- Learner admission/list service and administrator-facing register; learner reads and admission writes now use the restricted RLS transaction path.
- Organisation-specific class-group creation/listing for Grades 1–9 by academic year, with unique class codes and audit events.
- Controlled, effective-dated learner placement into a matching active class, with progression and audit records.
- Controlled assessment event closure, reasoned voiding of incomplete attempts after the event end, append-only versioned task marks, and atomic immutable result generation (migration 0016).
- Source-linked KICD Grades 1–9 curriculum catalogue, pathway provenance, curriculum document staging and authenticated source-structure browsing for versioned strand/sub-strand headings.
- Grade 6 CRE June 2024 and Revised 2024 source records remain separate. A source-comparison note records six changed heading/page rows; neither source is approved for outcome ingestion.
- PostgreSQL RLS for learner/person/enrolment/class/progression/guardian/audit records, restricted runtime role and transaction-scoped verified identity context (migrations 0008–0010).

## 3. Learner RLS and identity boundary

- `sentinel_learner_runtime` is NOLOGIN, NOBYPASSRLS and non-privileged.
- `sentinel_learner_login` is the development login role inheriting that group.
- The login has SELECT/INSERT only on approved learner, class and audit tables; no general UPDATE or DELETE.
- Learner list/admission and class create/list operations use `DATABASE_AUTHENTICATED_URL` through a dedicated Neon Pool/Drizzle transaction.
- The server obtains a Neon Auth JWT, verifies signature, issuer and expiry with JWKS, and requires its subject to match the authenticated session user ID.
- Verified claims are installed with transaction-local `set_config('request.jwt.claims', ..., true)`; the database checks `sentinel_private.current_user_id()` before learner work.
- Initial class placement is the only controlled update: `sentinel_private.assign_learner_to_class` is SECURITY DEFINER, checks active manager authority, active enrolment, tenant, organisation, grade, year, class status and effective date, then updates only `class_id` and writes progression/audit events. The runtime role receives EXECUTE, not table UPDATE.
- Repeating the same class placement is idempotent; changing an existing class assignment is rejected pending a separate reassignment workflow.
- Important limitation: the extension's fallback `request.jwt.claims` mode does not independently validate JWT signatures. Application-side JWKS verification is mandatory; do not expose the role to untrusted SQL.

## 4. Development database state

Neon project: `sentinel-platform`; development branch: `sentinel-development`; database: `sentinel`.

The source-controlled migration journal has entries 0000–0018 (nineteen migrations). The Neon development ledger contains twenty-one rows: the nineteen source migrations and two historical hashes not represented in current source files or Git history (preserved pending provenance investigation). Migration 0012 assessment schema SHA-256: e96a971f24d9feb4906b3b395403c52dbb5a3d34cf239a65132db5a12dcbb5f9. Migration 0013 eligible-roster SHA-256: 593992ecfc18ab4e350acca996ae57968629cc1593623341e7a47b8b1ff4447e. Migration 0014 controlled-capture SHA-256: febc678c45b1968502101f25d8c752bce2bea9acbf5d503ef3af5f3f9d411c14 and is applied to development. Migration 0015 audit-history immutability SHA-256: ca2ebd31b6580e9e04aebb827f3e123319ce93edd4a5c33f0a1db58fae2a6c6b and is applied to development. Migration 0016 assessment marking/results SHA-256: 0f139f08b7e3636b66d91efcb2fdaf1e10d0a39f6416523d125a67ac22279dc1; migration 0017 result governance SHA-256: c088374f6244832166115727ffb15c7e77e998694f40d1af711729df11762b42; migration 0018 result correction SHA-256: 35e12b6e1a81e0238101c6e09ea82f46b9dc1cd8c1f5c5660e2c0e4b845d2a15. All three are applied to development.
- 0008 RLS foundation: SHA-256 `27664c83dd0b7ad1b00a3c4c26ac8243a2acb07abdc7c7f828aad58f77db2b68`.
- 0009 class creation RLS: SHA-256 `d284585be9a8f0a5071a06202435429cb34e484db79d6c37376a436089b4cf82`.
- 0010 controlled class placement: SHA-256 `8bacb4f67b6602385d70ac53f423118a0a6d3cea57bb63d88dbad6527f30e6f2`.

Verified through Neon SQL transactions:
- Restricted role can execute the placement function but has no UPDATE/DELETE privilege on learner enrolments.
- Function is SECURITY DEFINER and the progression constraint includes `class_assigned`.
- Synthetic identity without active authority receives a non-disclosing `P0002` enrolment-not-found response.
- No live learner or guardian data has been imported. The development branch currently has zero active organisations. A positive placement workflow and cross-tenant tests with a governed synthetic institutional account remain outstanding until an authorised test organisation/user fixture is provisioned.

## 5. Validation baseline

A fresh cloud checkout of the latest GitHub branch completed:

| Check | Result |
|---|---|
| Clean `npm ci` | Passed; zero vulnerabilities reported |
| `npm run db:check` | Passed; nineteen migrations valid |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | Passed; 114 tests across twenty files (including marking, result generation, governance and correction contracts) |
| `npm run build` | Passed; Next.js production build and route generation completed with ephemeral local-only environment placeholders |
| `npm audit --audit-level=low` | Passed; zero vulnerabilities reported |

The suite covers JWT verification, RLS migration contracts, class validation, placement date validation, error mapping, organisation and membership policies, and assessment event/attempt lifecycle, tenant-enrolment scope, scoring and instrument-version invariants. The assessment-domain increment also passed `npm run lint` and `npm run typecheck`; its fresh production build passed using ephemeral local-only auth/database placeholders; no deployment secrets were changed. The Neon Auth dependency tree still emits a non-blocking peer-version warning; ESLint 9.39.5 also emits a deprecation notice. Do not apply dependency overrides or major upgrades without compatibility review.

GitHub Actions run [45716241617](https://github.com/gvffbhdvgf/cbe/actions/runs/45716241617) on commit `a61476b4c96e86f4e00c89313b2ae53e40efc016` passed all stages: clean install, migration validation, lint, typecheck, 114 tests across twenty files, and production build. Build used ephemeral CI-only placeholders; no deployment secrets were changed. Earlier runs [45715279233](https://github.com/gvffbhdvgf/cbe/actions/runs/45715279233) and [45713501617](https://github.com/gvffbhdvgf/cbe/actions/runs/45713501617) are retained as prior baselines.

## 6. Vercel Preview and environment boundary

The Vercel project `sentinel-platform` exists; its root directory is now `sentinel`. A protected Preview deployment for `sentinel/bootstrap` is READY at https://sentinel-platform-56590wifk-pep-popsiis-projects.vercel.app (commit `a4e6f6c4faf321f6b9f282bd6a3ea1a08ec4a937`). Public unauthenticated requests to `/` and `/api/health` redirect to Vercel SSO; no health payload is exposed publicly. The project is not linked for automatic branch-scoped environment management, and `DATABASE_AUTHENTICATED_URL` remains unconfigured. Do not broaden this restricted connection to every Preview or Production as a workaround. No Production variable or deployment was changed.

Until the Preview secret is configured, learner/class APIs that require the restricted database connection intentionally fail closed.

## 7. Curriculum evidence and outstanding work

- Regular curriculum offerings are source-linked for Grades 1–9.
- Indigenous Language lower-primary discrepancy remains flagged.
- SNE grade-level offerings are not inferred without source validation.
- Grade 6 CRE source edition/currentness and rights review remain pending.
- Five strand and 22 sub-strand headings are staged; detailed outcomes/learning experiences are not yet approved or ingested.
- Grade 6 assessment discrepancy remains unresolved: category total 1,406 versus cluster tables 1,408 and 1,405.

Assessment lifecycle domain contracts are implemented in `src/domain/assessment/assessment.ts` with thirteen focused tests. Migrations 0012–0016 are applied to the isolated development branch:

- Migration 0012 creates the relational assessment model, composite tenant/grade/year/instrument/enrolment constraints, forced RLS, approved-outcome mapping validation, append-only result/decision history and instrument-version locking.
- Migration 0013 adds the immutable, RLS-protected eligible-enrolment roster, a roster FK on attempts and the audited `sentinel_private.schedule_assessment_event(uuid)` operation.
- Migration 0014 adds controlled event opening with UTC start/end, active authority, approved-instrument, active-programme and frozen-roster checks; attempt creation restricted to exact frozen-roster enrolments; immutable per-task response capture; and submission only after every required task response exists. Four authenticated API operations call SECURITY DEFINER database functions; no direct assessment-table write privileges are granted to the runtime role.
- Migration 0015 makes the audit log itself append-only. Assessment responses, results, decisions and eligibility snapshots also reject updates/deletes.
- Migration 0016 adds `assessment_response_marks` as a separate append-only, versioned record linked to the immutable captured response and exact instrument task. Marks are bounded by each task maximum; corrections before result finalization must explicitly supersede the latest mark and include a reason. The mutable-looking legacy marking columns on `assessment_responses` are documented as deprecated and are not used.
- Migration 0016 adds controlled attempt voiding (in-progress attempts only, after event end, with a reason), event closure (only after all attempts are submitted or voided), and atomic marking finalization. A result is created only when every required task has a response and latest mark. The initial result denominator includes required tasks only; optional tasks are excluded pending a richer scoring-scheme model. Finalization creates immutable result version 1 and moves the attempt to `marked`.
- Migration 0017 adds append-only moderation, approval, correction-request and publication decisions, separation-of-duties checks, event/attempt governance transitions, and the read-only `assessment_result_lifecycle` view. Moderation is required only when configured; approval is restricted to organisation/school administrators and publication requires a prior approval decision.
- Migration 0018 adds reasoned correction after moderation rejection. Corrected task marks supersede prior mark versions, and finalization inserts a new immutable result version linked to the previous result plus a `result_superseded` decision. Original response evidence, marks and result rows are never overwritten.
- New authenticated API routes cover event close, incomplete-attempt void, task mark capture and marking finalization. Post-publication correction and full UI workflows remain unimplemented.
- Teacher-level capture remains disabled until class and teacher allocations and explicit assignment authority are modelled.

All assessment tables have forced RLS. Active platform administrators, organisation administrators, school administrators and assessors can read within their organisation. Teachers and viewers remain excluded from school-wide raw assessment access. The event date is interpreted in UTC until organisation timezone support exists. No assessment or learner records have been inserted. Post-publication correction, full UI workflows and authenticated end-to-end testing of the capture/marking/governance lifecycle remain outstanding.

Outcome mapping approval is constrained to reviewed `specific_outcome` nodes from approved, rights-confirmed curriculum documents with matching grade and learning area. Results and decision history are append-only; instrument versions lock after attempts exist; response scores cannot exceed task maxima. A read-only events API is implemented at GET /api/organisations/{organisationId}/assessments/events with matching application preflight and database RLS. No assessment or learner records have been inserted. Controlled event opening, attempt creation, response capture and submission are implemented and migration 0014 is applied. Marking, moderation, approval, publication and correction operations remain pending, as do authenticated integration tests of the complete capture workflow.

Next sequence:
1. Resolve Vercel Git integration and branch-scoped Preview secret configuration.
2. Complete signed-JWT Next.js request tests and cross-tenant end-to-end tests. Database-level positive/negative synthetic fixture tests have passed; actual Preview request-path testing remains blocked by the Vercel environment configuration.
3. Implement class reassignment, learner correction, transfer, withdrawal, progression approval and academic-year rollover with explicit state transitions and audit history.
4. Implement teacher allocation, class capacity and verified guardian relationships with safeguarding controls.
5. Continue detailed KICD outcomes only from verified source editions with provenance, rights and specialist review.
6. Complete post-publication correction, accessible UI workflows and authenticated end-to-end tests for capture, marking, moderation, approval and publication using governed synthetic fixtures.
7. Complete privacy/DPIA, security, accessibility and performance validation before any live learner pilot.

## 8. Non-negotiable guardrails

- Keep all work under `sentinel/` except repository-wide CI.
- Preserve old sandboxes; use fresh cloud checkouts.
- Keep local, development, Preview and Production credentials/data separate.
- Never run development migrations against Production.
- No automatic deployment on every commit or uncontrolled Production release.
- Do not import identifiable learner data before legal, privacy, safeguarding and DPIA approvals.
- Do not provision paid/persistent infrastructure or incur new service costs without approval.
- Keep GitHub and Notion checkpoints synchronized.


## 26 November 2026 — Assessment authoring and learner participation milestone

Latest source commit: [5e82af3](https://github.com/gvffbhdvgf/cbe/commit/5e82af336bd26834f4cb1cc9941dd1592f2d28dc). GitHub Actions [45761211788](https://github.com/gvffbhdvgf/cbe/actions/runs/45761211788) passed migration-journal validation, lint, TypeScript, 123 tests across 22 files, and the production build.

Migration 0020 is registered and applied to the isolated Neon development branch. It adds narrowly granted SECURITY DEFINER operations for:
- Assessment programme creation with type and code validation.
- Versioned instrument creation with 1–100 validated task definitions and concurrency-safe version numbering.
- Independent instrument approval; the author cannot approve their own version.
- Draft event creation restricted to an active programme and approved instrument.
- Read access to the immutable frozen roster with any existing attempt reference/status.

The workspace now includes programme authoring, instrument/task drafting, independent approval, event creation, event scheduling with roster freeze, and roster-based attempt launch. Attempt workspaces now expose one-time immutable response capture and submission controls. The existing marking/result workflow remains connected after submission.

Development database verification:
- Migration ledger entry 23 records migration 0020 with SHA-256 `0e6d3cd7a03872381e9e33bea98e7de6f31388102ab5719e3cff2b4bf3675b08`.
- All five authoring/roster functions are SECURITY DEFINER; runtime has EXECUTE only and PUBLIC execution is revoked.
- Runtime has no direct INSERT privilege on programmes, instruments, events or tasks.
- An unauthenticated programme-creation call was rejected with SQLSTATE 42501.
- No programmes, instruments, events, roster rows or attempts were created during verification.
- Migration 0020 was executed on a disposable child branch before development application; the child branch was deleted afterward.
- Production database and deployment remain unchanged.

Resolved by migration 0021: organisations now carry a validated IANA timezone, assessment events snapshot that timezone, local wall-clock inputs are converted in PostgreSQL, and roster eligibility uses the event-local calendar date. Curriculum outcome mapping and independent review are now implemented. Remaining items include teacher/class-scoped participation, teacher assignment lifecycle, richer choice response options and browser-driven end-to-end assessment journeys.

**Next milestone:** learner/class allocation and teacher-scoped participation, then richer choice response options and browser-driven end-to-end assessment journeys.


## 26 November 2026 — Synthetic end-to-end assessment journey verified

A complete synthetic assessment journey was executed against a disposable Neon child branch created from the development database. Synthetic-only organisation, memberships, learner, class and enrolment data were created on that child branch, then the branch was deleted after verification.

The journey completed:
1. Create assessment programme.
2. Create version 1 instrument with a required scored task.
3. Verify the instrument author cannot approve their own instrument; the attempt was rejected with SQLSTATE 42501.
4. Approve the instrument using a different authorised officer.
5. Create and schedule an event; one eligible enrolment was frozen into the roster.
6. Open the event and create an attempt from the frozen enrolment.
7. Capture one response and submit the attempt.
8. Close the event, record a mark of 8/10, and generate immutable result version 1.
9. Record independent moderation approval, independent result approval, and publication.

Final lifecycle projection reported `published`, latest decision `result_published`, result version 1 and 80.00%. Thirteen expected audit action groups were present, including programme/instrument creation, approval, event scheduling/opening/closing, attempt creation/submission, response capture, marking, result generation and three governance decisions. Response immutability triggers were enabled.

The disposable child branch was deleted. No synthetic records were inserted into the development branch or production. This validates the SQL/database journey end-to-end; browser-driven UI automation remains a future test layer.


## 26 November 2026 — Sentinel Preview deployment

A Vercel Preview deployment for `sentinel/bootstrap` is READY:

- Preview URL: https://sentinel-git-sentinel-bootstrap-pep-popsiis-projects.vercel.app
- Deployment: `dpl_J1ZRxdHPAuuoY3tgGxwB95A1VuDA`
- Source commit: [5a0fc2adf86eb9d07841d49496fd06d87b223a90](https://github.com/gvffbhdvgf/cbe/commit/5a0fc2adf86eb9d07841d49496fd06d87b223a90)
- Project: Vercel `sentinel`, linked to `gvffbhdvgf/cbe`, root directory `sentinel`.
- Build completed: Next.js compilation, TypeScript, static generation and deployment all passed.
- Preview environment variables are branch-scoped to `sentinel/bootstrap` and Preview only. `DATABASE_URL` uses the isolated Neon `sentinel-development` branch with the application owner role; `DATABASE_AUTHENTICATED_URL` uses the restricted `sentinel_learner_login` role. Neon Auth issuer/JWKS and a fresh cookie secret are configured for Preview.
- The Neon Auth trusted-origin allowlist includes the stable Preview branch URL.
- Vercel deployment SSO protection remains enabled. Browser-driven smoke testing is still outstanding; the browser automation service was unavailable due to insufficient credits. The build being READY does not by itself prove interactive sign-in or database-backed workflows.
- No production environment variables, production deployment, or production database were changed. An initial request classified as production was cancelled before a separate Preview deployment was created.

## Administrator access gate

The initial platform administrator has completed email verification and password setup. An active `public.platform_administrators` row is present on the isolated development branch. Public sign-up remains disabled. Future administrators must use the verified, owner-approved identity workflow in `ADMINISTRATOR_BOOTSTRAP.md`; never issue shared/default credentials.


### Preview environment-complete redeployment

After adding the branch-scoped `NEXT_PUBLIC_APP_URL`, the Preview was redeployed so the deployment snapshot includes all six environment variables. Latest deployment is READY: `dpl_7FvYMmHimJgUQyCS3SjVKHNhDUPT`. Stable branch URL remains https://sentinel-git-sentinel-bootstrap-pep-popsiis-projects.vercel.app. The deployment uses commit `5a0fc2adf86eb9d07841d49496fd06d87b223a90`. SSO protection remains enabled.


## 26 November 2026 — Administrator password setup flow implemented

- Added a password-setup entry point to the sign-in page and a guided setup flow at `/auth/forgot-password`.
- The flow uses Managed Neon Auth Email OTP: request email-verification OTP, verify the email, request a separate password-reset OTP, then set the password. It does not expose a password-setting backdoor, edit auth hashes, or enable public registration.
- Neon Auth's shared development email provider supports OTP rather than verification links. The branch remains configured for OTP verification; an attempted switch to link verification was rejected by Neon and made no configuration change.
- Enabled `revoke_sessions_on_password_reset` on the development branch.
- Preview build deployed and READY: `dpl_6FsANYdaupTEHPYhn12VVCoY9hMh`, source commit `cac975991ada3a63dea36485ccaf7cc5c8efd4a0`. The existing stable Preview branch URL is unchanged.
- Browser smoke test confirmed the setup page renders and the OTP request was accepted. The account owner completed email verification and password setup, then signed in. The active platform-administrator row was granted only after the verified identity check.
- This is Preview/development only. No production deployment or production database was changed.


## 26 November 2026 — Curriculum mapping and timezone milestone

Migration 0021 `0021_curriculum_mapping_and_timezone.sql` is applied to the isolated Neon development branch `sentinel-development` (branch id `br-nameless-block-bhpsx0vq`). SHA-256: `09221113f1fd9e2ac8ff4033abf9f5974e6a41b23dff2234c583327299e91e03`. Migration ledger row 24 was verified.

Implemented:
- Validated IANA timezone on each organisation; assessment events snapshot the timezone used at creation.
- Assessment event creation accepts organisation-local wall-clock values and converts them server-side to UTC; event roster eligibility uses the event's local calendar date.
- Assessment instrument versions are bound to an exact curriculum grade offering (edition, pathway, grade and learning area). Legacy broad instrument-creation function execution was revoked from the runtime role; new creation requires the offering.
- Task-to-outcome mapping proposals require an approved, rights-cleared specific outcome from that exact grade offering. Mapping approval/rejection requires a different reviewer and a reasoned review note; all actions are audited.
- Runtime can read only public curriculum metadata directly. Source-document and source-node content is not granted directly; approved outcome data is returned through narrowly scoped SECURITY DEFINER functions that re-check access and source rights.
- Added authoring controls, API routes and tests for outcome mapping and independent review. If no approved source outcomes exist, the UI reports that state rather than fabricating curriculum mappings.

Verification:
- GitHub Actions: [run 45776726284](https://github.com/gvffbhdvgf/cbe/actions/runs/45776726284) passed migration-journal validation, lint, type-check, 23 test files / 128 tests, and production build.
- Development database checks confirm the new columns, three validation triggers, migration ledger row, function grants, and restricted source-document/source-node permissions.
- Timezone conversion smoke test for 23:30 Africa/Nairobi stored 20:30 UTC and preserved the local eligibility date.
- No curriculum outcomes were fabricated; current catalogue source review/rights state still determines whether mappings can be proposed.
- Production database and production deployment remain unchanged.

Next: implement controlled teacher-to-class/learning-area assignments, class-targeted assessment events and teacher-scoped participation without broadening organisation-wide assessment RLS.


## 26 November 2026 — Teacher allocation and class-scoped assessment milestone

- Added effective-dated `teacher_class_assignments` with tenant/class/grade/year/learning-area integrity, overlap prevention, active verified Teacher membership checks, audited creation and audited revocation.
- Added institution workspace at `/workspace/organisations/[organisationId]/teaching` and management API routes. Class register links to the teaching assignment workspace. Assignments require an already provisioned, verified Teacher membership; no synthetic teacher account was created in the development branch.
- Added optional class targeting to assessment events. Scheduling freezes only active enrolments in the selected class. Existing institution-wide events remain supported for authorised assessment officers.
- Teacher event access is limited by active verified Teacher membership, active effective-dated assignment, target class, learning area and event date. Teacher RLS grants read access only to assigned event, roster, attempts, response tasks and captured responses; no marking, moderation, result approval or publication access.
- Teacher assessment UI now lists only assigned events, shows the frozen learner-reference roster, and supports attempt creation, response capture and submission. Marking controls remain hidden and server/database permissions remain authoritative.
- Migration `0022_teacher_class_assignments_and_scoped_assessment` applied to development branch `br-nameless-block-bhpsx0vq`; migration ledger hash `053d7836e1b6973156926db5d7cd6e5a4befaebf0fd99e58b562b9e5ebc00d49`.
- Isolated Neon E2E validation passed: synthetic teacher assignment, class-targeted event, frozen roster, attempt creation, response capture and submission. Teacher organisation-wide assessment access was false; assigned event/class access was true; marks and results remained invisible. Synthetic users/data were confined to the isolated validation branch.
- CI passed on commit `657bd3a538193a6a4f3ec99de57d6921ef78063f`: migration journal, lint, TypeScript, tests and production build.
- Preview deployment `dpl_9hSFNbrgfLfLLQHPJ1QrAj5tPdhP` is building from that commit. Stable preview alias: `https://sentinel-git-sentinel-bootstrap-pep-popsiis-projects.vercel.app`.
- Remaining operational step: provision/verify a real Teacher membership in the institution, then create its class/learning-area assignment and run the browser smoke test with that teacher. Current institution has no eligible Teacher membership.
- Preview/development only. No production deployment or production database was changed.


## 26 November 2026 — Learner lifecycle transitions and class capacity

- Added optional class capacity (1–500; null means unlimited), occupancy reporting, audited capacity changes and serialised capacity checks on placement writes.
- Added timestamped `learner_class_placements` history. Initial placement, reassignment, withdrawal and progression execution retain class history instead of overwriting the only record of a learner's class.
- Added audited immediate class reassignment with a required reason, and controlled learner withdrawal with an effective last-active date and required reason. Reasons are stored in access-controlled learner records, not copied into audit metadata.
- Added progression request, independent approve/reject and effective-date execution. A requester cannot approve their own request; execution is blocked until the approved effective date. The learner workspace includes a progression planning and approvals register.
- Updated assessment-event scheduling so a class-targeted event freezes only learners whose effective class placement covered the event start time. Historical class placements remain available for historical event eligibility.
- Added API and UI for class capacity creation/update, learner class reassignment, withdrawal and progression planning/approval/execution. Direct runtime INSERT/UPDATE/DELETE remains denied on class placement history and progression request tables; writes go through security-definer operations with role checks and audit.
- Migration `0023_learner_lifecycle_transitions` is applied on development branch `br-nameless-block-bhpsx0vq`; migration ledger hash `9be3c2886f13ef522a6d3a6b16a7fcc8c531902496b5f77536ea27fab3b547a7`. Existing class assignments were backfilled into timestamped placement history.
- Isolated Neon E2E validation passed for class reassignment/history, full-class capacity rejection, withdrawal, progression request, rejection of self-approval, independent approval, and prevention of execution before the effective date.
- CI passed on commit `f902d7dca247b6977f2ec6c95ceb7bf7b87e5dbc` (migration journal, lint, TypeScript, tests and production build).
- Preview deployment `dpl_47KWQXdFYniDZvKeHVk3EmEo3sCS` is queued/building from that commit. Stable preview alias remains `https://sentinel-git-sentinel-bootstrap-pep-popsiis-projects.vercel.app`.
- Remaining lifecycle work: transfer requests with receiving-institution acceptance, controlled learner-record corrections, guardian relationship verification, and end-to-end browser validation with real role-separated accounts. Progression execution still awaits an approved request's effective date.
- Preview/development only. No production deployment or production database was changed.


## 26 November 2026 — Adapted KICD pathway grade coverage

- Added the source-backed `curriculum_pathway_grade_levels` catalogue for adapted hearing, physical and visual impairment pathways.
- Recorded Grades 1–9 as `document_listed` for each of the three pathways (27 rows total). The evidence note explicitly states that grade-level learning areas and design content remain to be verified and that no regular-curriculum outcomes are inferred.
- Updated the curriculum browser to show grade-level coverage for adapted pathways, retaining the source catalogue and the distinction between document listing and verified learning outcomes.
- Development database verification: 9 rows per adapted pathway, Grades 1–9. Migration `0024_curriculum_pathway_grade_levels` is present in the development database; its ledger entry was reconciled after confirming the table and 27 source-backed rows. Hash: `752c600c43604e80cf41d4de51e782bde9c84c78b3bcec0b2c478eebbcb9bbbd`.
- Preview deployment `dpl_EfDCUSyvuGM96zSBN97masaGrqb4` is READY from commit `1ec27c319280ffb1a53bdc15dbaf4e1914196f67`. Browser smoke test confirmed the class register loads with capacity and occupancy controls, and the curriculum intelligence page loads with adapted pathway choices. No class, learner or curriculum records were changed during the browser test.
- CI passed on `1ec27c319280ffb1a53bdc15dbaf4e1914196f67`; an additional migration test now covers the adapted pathway grade-coverage source and evidence caveat.
- Preview/development only. No production deployment or production database was changed.


## 26 November 2026 — Staff register and verified teacher allocation

- Applied migration `0025_staff_profiles_and_engagements` to Neon development branch `br-nameless-block-bhpsx0vq`. SHA-256: `87352a969fdc5411ff03c28d99df5b31845949bc28314ab610042a4378de3819`; ledger timestamp `1795684200000`.
- Added tenant-scoped `staff_profiles` linked to canonical Person records and separate effective-dated `staff_engagements`. The staff register supports existing-person matching, explicit confirmation before creating a new Person, engagement creation and end-dating.
- Added the staff workspace at `/workspace/organisations/[organisationId]/staff` and APIs for profile creation, verified Teacher-account linking and engagement end-dating. No credentials, dates of birth or unrelated personal attributes are collected.
- Teacher-account linking requires an active, email-verified, non-banned Teacher membership in the same organisation. The profile must be active and categorised as Teacher; one account can link to only one staff profile per organisation.
- Updated `create_teacher_class_assignment`: a verified Teacher membership is no longer sufficient by itself. The account must be linked to an active Teacher staff profile with an active/planned engagement covering the assignment start date.
- Security: both staff tables have forced RLS; `sentinel_learner_runtime` has SELECT only and no direct INSERT/UPDATE/DELETE. Profile creation, account linking and engagement end-dating use narrow SECURITY DEFINER functions with PUBLIC execution revoked and explicit runtime EXECUTE grants. Effective dates use the organisation's IANA timezone.
- Development branch verification: staff tables contain zero profiles and zero engagements; runtime SELECT is allowed and direct writes are denied. No real staff data or accounts were added to development.
- Isolated Neon E2E validation ran on expiring child branch `br-plain-glade-bhd50sh5`: staff profile/engagement creation; rejection of an unverified account link; rejection of class allocation before account linking; successful link and class assignment after verification; engagement end-dating; and rejection of an assignment after the engagement end date. Synthetic identity and staff records exist only on that disposable child branch.
- Preview deployment READY: `dpl_BcDR84rqbTbRSKyMN7UjLw2gJsfb`, source commit `eb75f3e932131c411e16922f5ccc5e4fa02973e6`. Stable Preview: https://sentinel-git-sentinel-bootstrap-pep-popsiis-projects.vercel.app.
- Browser verification passed in the signed-in Preview: staff register loads with the expected empty state; person search returns the no-match state only after an explicit search; teaching assignments and class register load; teaching allocation explains the staff-profile and verified Teacher-account prerequisites. No records were created or changed during browser verification.
- The current development institution has no verified Teacher memberships and no guardian relationships. The existing `guardian_relationships` table is forced-RLS and has no runtime privileges/policies, so guardian access remains fail-closed. Workload totals are not yet modelled: teacher assignments do not yet capture weekly periods.
- Next sequence: implement guardian identity/relationship verification and permission controls; then privacy-preserving learner transfers with receiving-institution acceptance; then governed learner-record corrections, academic-year rollover and a defined weekly-period workload model. External exchange follows those governance foundations.
- Preview/development only. No Production database or deployment was changed.



## 26 November 2026 — Guardian verification and privacy-preserving learner transfers

- Applied migrations `0026_guardian_relationship_verification` and `0027_privacy_preserving_learner_transfers` to development branch `br-nameless-block-bhpsx0vq`. Ledger hashes: `2f3dfd2fb7481e534bba885ee2ba1af9bae88d9beba3e6b55018be2e675ce83d` and `7e4f33a46d1af98743060a8f2389fe177cf7bcae69722242aa7cceeda9aa1391`.
- Guardian identity and relationship verification use separate states, evidence references (not document contents), independent reviewer checks, explicit per-learner permissions, verified-email account linking, and revocation. Guardian profiles and relationships are forced-RLS; the runtime role has SELECT only and writes are routed through narrow SECURITY DEFINER functions with PUBLIC execution revoked.
- Added the institution guardian register, person matching, pending profile/relationship review, permission assignment, verified-account linking and revocation UI/API at `/workspace/organisations/[organisationId]/guardians`.
- Added the two-sided learner transfer workflow at `/workspace/organisations/[organisationId]/transfers`: sending institution request, receiving institution accept/reject, sender cancellation/release, and receiver completion against a locally created learner/enrolment. Incoming transfer summaries intentionally do not join or expose source learner identifiers; the sending-side identity link is held in a separate RLS-protected table.
- Isolated Neon E2E validation passed on expiring child branch `br-rapid-star-bhyo89pp`: guardian profile and relationship creation; self-review rejection; independent verification; verified-email account linking; transfer request; receiving institution acceptance; sending institution release; and destination-local enrolment completion. Synthetic guardian, reviewer, learner and receiving-institution records exist only on that child branch.
- Development verification confirms both migrations are recorded, guardian and transfer tables have forced RLS, runtime has SELECT only, and transfer/guardian write functions are executable by the restricted runtime role but not PUBLIC.
- Preview deployment READY: `dpl_GwHEDuwCAa3VZvdD5TJUiSwyE5Gt`, source commit `35239da49fe6392dc3b910f21cb11f0683bcc6f6`. Stable Preview alias: https://sentinel-git-sentinel-bootstrap-pep-popsiis-projects.vercel.app.
- Signed-in BrowserPair smoke tests passed for both guardian and transfer workspaces. The current development organisation has one active learner, no guardian profiles, no transfer requests and no second active institution, so the request action is correctly disabled until a receiving institution exists. No learner or guardian records were created or changed during browser verification.
- Known remaining guardian work: guardian onboarding/invitation and a guardian-facing, narrowly scoped read-only learner-progress portal are not yet implemented. Relationship permissions are stored and enforced, but the current guardian workspace is institution-admin facing; do not describe the guardian portal as complete.
- Next sequence: implement the guardian-facing safe read model and account invitation; add institution eligibility/registry controls for cross-institution transfers; then governed learner-record corrections, academic-year rollover, weekly-period workload modelling, and external data exchange.
- Preview/development only. No Production deployment or database was changed.


## 26 November 2026 — Guardian portal and onboarding

- Added migration `0028_guardian_portal_read_model` to the development branch. Ledger hash: `aaf053dc7ca7616993a18ce00f5e5db7b699be543cb0897bb47f026e08e9e82e`.
- Added `sentinel_private.get_guardian_portal_summary()`, a SECURITY DEFINER read model that requires the current authenticated user to own an active, verified guardian profile and a separately verified, active, in-date learner relationship. It returns only learner identity/current enrolment plus the latest published assessment summaries when `can_view_progress` is true. Raw assessment responses, marker notes, unpublished results and unrelated learner records are not returned.
- The guardian portal read model writes `guardian.portal_viewed` audit events without recording result values. The runtime role can execute the function; PUBLIC cannot. Child-branch tests confirmed: permitted relationship returns a learner; message-only permission returns no progress; revoked relationship returns zero rows; access is audited.
- Added the authenticated `/guardian` family-access page and `GET /api/guardian/portal` endpoint. The API route uses Next.js `connection()` to avoid prerender-time cookie access under Cache Components.
- Added guardian account onboarding: platform administrators on the Development Neon Auth branch have the Neon Auth `admin` role; the institution UI can create an account with a discarded random temporary password or send verification to an existing unverified account, then send an email-verification OTP. The public `/auth/verify-email` page verifies the code; the guardian then uses the password-reset OTP flow to choose their own password. Account linking remains blocked until the email is verified and the institution has independently verified the guardian profile.
- Invitation creation is recorded as `guardian.account_invitation_sent` in the institution audit trail. No invitation or OTP was sent during browser smoke testing; no real guardian account was created.
- Preview deployment READY: `dpl_33P73Kr46X1VFoF3osx3YectPX6Z`, source commit `a9155bbf5e8550ecd7cc3153a45b89fd3f7c2bc6`. Stable Preview alias: https://sentinel-git-sentinel-bootstrap-pep-popsiis-projects.vercel.app.
- Public guardian email-verification page loaded successfully in BrowserPair. The guardian portal route redirected to sign-in in the fresh BrowserPair tab, so the authenticated guardian portal view still needs a signed-in browser smoke test. No credentials or OTPs were entered or accessed by the agent.
- Development-only auth privilege: the verified platform administrator's Neon Auth role is `admin` on branch `br-nameless-block-bhpsx0vq` to enable the supported Admin API for account provisioning. This was not changed on Production.
- Next: institution transfer-eligibility registry and verified receiving-institution controls; then governed learner-record corrections, academic-year rollover, weekly-period workload modelling and external data exchange.
- Preview/development only. No Production deployment or database was changed.
