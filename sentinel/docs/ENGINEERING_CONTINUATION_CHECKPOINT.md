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
