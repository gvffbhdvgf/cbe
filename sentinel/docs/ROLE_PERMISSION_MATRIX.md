# Sentinel — Role and Permission Matrix

**Status:** Proposed baseline for institutional validation; not an approved authority schedule.  
**Scope:** Grades 1–9 platform-wide. Roles are capabilities, not proof of authority.

## 1. Authorisation model

Every protected operation must pass authentication, active-account checks, capability checks, effective organisational scope, resource-state policy, purpose/context checks and any required approval. Deny by default. UI hiding is not authorisation; enforce policy in API/service and database layers.

Policy tuple: subject + capability + resource + action + scope + constraints. Example: teacher + assessment-result-read + result + read + assigned-class + active-teaching-assignment. Return allow/deny with reason code and policy version.

### Scope vocabulary

- Platform: platform operations and metadata, not routine learner content.
- Authority: legally/administratively authorised education authority boundary.
- County / sub-county / zone / cluster: candidate scopes, subject to hierarchy validation.
- Institution / school: one assigned institution.
- Class / stream / teaching group: active instructional relationship.
- Assigned records: explicitly allocated cases, assessments or tasks.
- Self / linked dependent: own learner record or verified guardian-linked learner, subject to safeguarding policy.
- Aggregate: approved de-identified/thresholded summaries only.

The tenant boundary follows controller and contractual authority, not display hierarchy. See ADR-001.

## 2. Candidate role catalogue

| Role | Purpose | Default scope candidate | Restrictions |
|---|---|---|---|
| Platform operator | Service health, configuration, jobs | Platform metadata | No routine learner-data access |
| Platform security administrator | Identity security and incidents | Security plane | Cannot self-approve privileged access |
| Authority administrator | Manage delegated authority operations | Assigned authority | No access outside delegation |
| County/sub-county/zone/cluster coordinator | Coordinate workflows and reporting | Explicitly assigned unit | Identifiable learner drill-down only if authorised |
| School head / institution administrator | Manage school, staff, learners and approvals | Assigned institution | No peer-school access |
| Deputy / delegated leader | Perform delegated school operations | Explicit delegation | Time-bounded and revocable |
| Records / admissions officer | Learner identity and enrolment | Assigned institution | Sensitive corrections require approval |
| Teacher | Teaching, assessment and learner support | Assigned classes/learners | No general access to other classes/schools |
| Assessment coordinator | Assessment setup, imports and reconciliation | Assigned event/institution | Separate marking, moderation and publication duties |
| Marker | Enter marks for allocated tasks | Assigned marking allocation | Cannot moderate own marking |
| Moderator | Review marking and anomalies | Assigned assessment | Cannot approve own moderation |
| Results approver/publisher | Approve and publish validated results | Explicit event scope | Cannot silently alter source marks |
| Curriculum specialist | Review curriculum editions and mappings | Assigned curriculum authority | Published editions immutable |
| Workforce officer | Maintain authorised workforce records | Assigned institution/authority | Minimum necessary attributes |
| Learner | View own permitted learning information | Self | No peer access |
| Guardian | View permitted linked learner information | Verified dependent | Verification, consent and safeguarding controls |
| Data protection officer | Privacy oversight and rights requests | Oversight/case scope | No blanket routine content access |
| Auditor / inspector | Review authorised evidence | Time-bound audit scope | Read-only by default |
| Support agent | Resolve technical cases | Case-scoped and minimised | Mask data; approved time-limited access |
| Integration service identity | Exchange data for defined connector | Named endpoints and tenant | Non-human, narrow scope, rotation |

## 3. Resource-action matrix (baseline)

Legend: A=administer, C=create, R=read, U=update, D=delete/archive, Ap=approve, Pub=publish, X=export, M=moderate. Scoped means only assigned scope. Policy means additional checks apply.

| Resource | Authority admin | School admin | Records officer | Teacher | Assessment coord. | Marker | Moderator | Results approver | Curriculum specialist | DPO/Auditor |
|---|---|---|---|---|---|---|---|---|---|---|
| Organisation units | A/R scoped | R/U school | R | R assigned | R | — | — | R | R | R audit |
| User/role assignments | A scoped | A delegated | — | — | — | — | — | — | — | R audit |
| Learner identity | R scoped | R/U scoped | C/R/U | R assigned | R minimum | R minimum | R minimum | R minimum | — | Case-scoped |
| Enrolment/transfer | R scoped | Ap/U school | C/R/U | R assigned | R minimum | — | — | — | — | Case-scoped |
| Workforce profile | R scoped | R/U scoped | — | R self | R minimum | — | — | — | — | Case-scoped |
| Teacher allocation | R scoped | A/U school | — | R self | R assigned | — | — | — | — | R audit |
| Curriculum catalogue | R | R | — | R | R | R | R | R | C/U/Ap | R audit |
| Assessment definition | R scoped | R scoped | — | C/R assigned | C/U | R assigned | R assigned | R | R mapping | R audit |
| Assessment items | R | R | — | C/R assigned | C/U | R assigned | M assigned | R | R mapping | R audit |
| Raw marks/attempts | R policy | R scoped | — | C/R assigned | R scoped | C/U assigned | M assigned | R | — | Case-scoped |
| Result publication | R scoped | Ap if delegated | — | R released | Prepare | — | Recommend | Ap/Pub | — | R audit |
| Progress/intervention | R policy | R scoped | — | C/R/U assigned | R minimum | — | — | R released | R aggregate | Case-scoped |
| Reports/analytics | R aggregate | R school | — | R assigned | R scoped | — | R scoped | R scoped | R curriculum | R audit |
| Imports/exports | Policy | C/R scoped | C/R learner | Limited | C/R scoped | — | — | Ap X | Curriculum import | Oversight |
| Audit events | R oversight | R school events | Own actions | Own actions | Scoped | Own actions | Scoped | Scoped | Curriculum events | R authorised |

This is a starting point, not a permission grant. Translate each cell into explicit policy rules and tests.

## 4. Implemented foundation policy (development only)

The first organisation-access slice currently implements these narrower application roles; this does not replace the full candidate catalogue above and is not an institutional authority approval:

| Actor | May add / revoke | Restrictions |
|---|---|---|
| Platform administrator | All organisation roles | Platform administrator privilege is separate and cannot be granted through this membership API |
| Organisation administrator | School administrator, teacher, assessor, viewer | Cannot promote or revoke another organisation administrator |
| School administrator | Teacher, assessor, viewer | Cannot assign/revoke school or organisation administrator roles |
| Teacher / assessor / viewer | None | No membership administration |

The current API can grant access only to an existing verified, active Neon Auth account. It does not create accounts, send invitation email, or grant platform-administrator privileges. Membership role changes and revocations are audited. The database permits at most one active membership per user per organisation; the historical role constraint preserves prior role rows for reactivation. The last active organisation administrator cannot be revoked.

## 5. Separation of duties

- Assessment creator should not be sole publication approver.
- Marker cannot moderate own marking.
- Importer cannot silently approve unresolved reconciliation exceptions.
- Correction requester should not solely approve high-impact correction.
- Privileged role assignment should require a second approver where feasible.
- Platform support cannot grant itself learner-record access.
- Emergency access is time-limited, reason-coded, monitored and reviewed.

## 6. Lifecycle controls

- Role assignments carry start/end dates, issuer, approver, scope and reason.
- Delegations are narrow, explicit, time-bounded and revocable.
- Re-evaluate scope on every request; do not rely on stale session claims.
- Exports, bulk reads, corrections and publication require stronger controls.
- Guardian relationships are verified; never infer from shared surname/contact details.
- Service identities use endpoint-level scopes and independent rotation.
- Small-group suppression thresholds require policy approval.

## 7. Validation questions

1. Which authority owns each user and data domain?
2. Is county → sub-county → zone → cluster → school accurate everywhere?
3. Which authority roles may view identifiable learner records versus aggregates only?
4. Who may admit, transfer, correct identity, approve assessments and publish results?
5. What guardian and learner access rules apply by age/grade?
6. What inspection powers exist and how are they authorised?
7. Which workforce attributes are necessary and who owns them?
8. Who owns break-glass review and incident response?

## 8. Required pilot tests

- Cross-school and cross-tenant reads, writes and exports are denied.
- Teacher access ends when assignment ends.
- Guardian cannot access unverified or unauthorised learner relationship.
- Delegation expiry/revocation takes effect.
- Marker/moderator/approver separation is enforced.
- Jobs and exports enforce the same scope as interactive requests.
- Privileged and break-glass access is audited.
- No role accidentally grants global learner access.
