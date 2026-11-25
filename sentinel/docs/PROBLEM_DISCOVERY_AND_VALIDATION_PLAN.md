# Sentinel — Problem Discovery Backlog & Validation Plan

**Status:** Hypothesis register; no hypothesis below is treated as a confirmed institutional finding until validated with users and records.  
**Scope:** Comprehensive Grades 1–9 education management and intelligence platform.

## 1. Discovery operating rules

- Investigate real work before accepting feature requests.
- Observe actual workflows and artefacts, including spreadsheets, registers, forms, approval trails and reports.
- Separate evidence, interpretation, assumption and proposed solution.
- Interview multiple roles and more than one institution; do not treat one stakeholder as representative of all schools.
- Include low-connectivity, accessibility, language and device constraints in research.
- Use synthetic or properly de-identified data in prototypes.
- Never collect identifiable child data in interviews or research notes unless a separately approved lawful process exists.
- Record disconfirming evidence and failed prototypes, not only supporting evidence.
- Measure user outcomes and institutional value; do not use number of features shipped as the primary success metric.

## 2. Initial problem hypotheses

All items below are hypotheses inferred from the project brief, sample assessment evidence and common cross-domain dependencies. They require validation.

| ID | Problem hypothesis | Affected users | Evidence needed | Intended outcome |
|---|---|---|---|---|
| P-01 | Learner records may be duplicated across schools, years or registers, making transfers and longitudinal histories difficult | Admissions staff, teachers, school leaders, administrators | Admission registers, transfer workflow observation, duplicate audit | One governed learner identity and continuous history |
| P-02 | Teacher records, assignments and teaching loads may be maintained in disconnected sources | Teachers, heads, workforce administrators | Staff registers, assignment records, workload process | Accurate, effective-dated teacher allocation |
| P-03 | School and administrative hierarchies may be represented inconsistently across reports | School leaders, zonal/subcounty/county administrators | Official organisation lists, reporting templates, hierarchy changes | Consistent scope and comparable reporting |
| P-04 | Curriculum references may be stored as flat subject labels rather than versioned outcome structures | Teachers, curriculum support officers, assessment designers | KICD source designs, lesson plans, assessment instruments | Versioned curriculum navigation and evidence mapping |
| P-05 | Assessment workflows may require repeated manual capture, imports and reconciliation | Teachers, assessment officers, school leaders | Actual spreadsheets, papers, marking and approval workflow | Validated, traceable assessment lifecycle |
| P-06 | External assessment results may be difficult to reconcile with internal learner records | Assessment administrators, school leaders | External data formats, identifiers, transfer rules, data agreements | Controlled exchange and provenance |
| P-07 | Inter-school comparisons may be misleading when participation, denominators or scoring differences are hidden | Administrators, school leaders | Existing reports, source totals, cohort definitions | Fair, denominator-aware comparisons |
| P-08 | Assessment results may not reliably lead to tracked learner-support actions | Teachers, learners, support staff, school leaders | Intervention records, follow-up observations, user interviews | Educator-led interventions with review evidence |
| P-09 | Duplicate entry and unclear ownership may create inconsistent master data | All operational roles | End-to-end process maps, field ownership, correction cases | Canonical records and explicit data ownership |
| P-10 | Access and data-sharing rules may not align with actual responsibilities across institutions | Data owners, administrators, teachers, guardians | Role matrix, policy, data-sharing agreements, access logs | Least-privilege access with accountable delegation |
| P-11 | Connectivity/device constraints may make online-only workflows unreliable | Teachers, learners, school administrators | School connectivity/device observation, failure logs | Resilient workflows with safe retry/offline strategy where justified |
| P-12 | Reporting and exports may expose more personal data than the recipient needs | Data protection officers, administrators, school leaders | Existing exports, access patterns, disclosure policies | Purpose-limited reports and controlled disclosure |

## 3. Discovery work packages

### WP-01 — Stakeholder and authority map
Identify who owns decisions, data and operations across:
- Education authority and institutional leadership
- County/sub-county/zonal/cluster administrators where applicable
- School heads and deputies
- Teachers and subject/learning-area leads
- Admissions/records staff
- Assessment coordinators, markers and moderators
- Curriculum support officers and curriculum specialists
- Learners and guardians, using age-appropriate safeguarded research
- Data protection, ICT/security and support personnel
- External assessment bodies and integration partners

Output: stakeholder map, RACI/decision-rights matrix, data-controller/processor questions and recruitment plan.

### WP-02 — Current-state workflow observation
For each workflow, record trigger, actor, input, system/register, decision, handoff, wait time, re-entry, error, exception, output and responsible owner:
1. School setup and academic-year rollover
2. Learner admission, class placement, progression and transfer
3. Teacher onboarding, school assignment and teaching allocation
4. Curriculum selection, planning and coverage recording
5. Assessment planning, paper/task creation and moderation
6. Assessment administration, marking, result approval and release
7. Internal/external result import and reconciliation
8. Inter-school reporting and performance review
9. Learner support/intervention and follow-up
10. Data correction, access request, export and audit

Output: as-is process maps, service blueprints, artefact inventory and measured baseline.

### WP-03 — Data inventory and source-of-truth mapping
For each data element record: definition, owner, source, identifier, format, update frequency, quality issue, sensitivity, retention, consumers and integration method.

Special attention:
- Person/learner/staff identity and matching
- School and administrative hierarchy
- Academic years, terms, classes and enrolments
- Curriculum editions and local subject aliases
- Assessment events, scoring rules, raw marks and result status
- Teacher qualifications/assignments and authority
- External identifiers and data exchange contracts

Output: canonical data dictionary, source-of-truth matrix, duplicate profile, migration/reconciliation risks.

### WP-04 — Research and prototype
Prototype high-risk journeys first:
- Find-or-create learner and detect possible duplicates
- Transfer learner while retaining history
- Assign teacher across classes/learning areas and detect workload conflicts
- Browse curriculum edition/pathway and map an assessment item to an outcome
- Create an assessment, mark, moderate and approve results
- Import a spreadsheet, preview mapping, quarantine errors and reconcile totals
- Compare schools with visible denominator and coverage
- Create an intervention and record follow-up
- Request and approve a restricted export

Output: tested prototypes, task success, time/error observations, usability/accessibility issues and revised requirements.

## 4. Interview prompts by role

### Teachers
- Walk through the last assessment you prepared, administered and marked.
- Which records do you enter more than once, and why?
- How do you plan against curriculum outcomes and record evidence?
- What happens when a learner joins or leaves mid-term?
- How do you identify a learning gap and follow up support?
- Which steps are hardest on the devices/connectivity available at school?

### School leaders
- Which reports drive decisions and how are they assembled?
- Where do you reconcile conflicting learner, teacher or assessment figures?
- How are staff assignments, workload and approvals managed?
- What access should teachers, administrators, learners and guardians have?
- What would make you trust or distrust a cross-school comparison?

### Assessment coordinators / markers
- How are assessment programmes, instruments and scoring rules approved?
- How are absences, late entries, invalid marks and re-marking handled?
- Which file formats and identifiers arrive from schools or external bodies?
- How do you verify totals and investigate discrepancies?
- How are moderation and publication approvals recorded?

### Curriculum support personnel
- Which KICD edition/pathway is applicable and how is adoption determined?
- How do local learning-area labels map to official curriculum structures?
- What evidence is sufficient to map an item to a specific outcome?
- How are adapted designs and learner support pathways handled?
- Who approves curriculum crosswalks and changes?

### Administrators / data protection / ICT
- Which entity is controller for each purpose and who acts as processor?
- What lawful basis, notices, guardian mechanisms and data-sharing agreements apply?
- Who can see which records at which organisation scope?
- What retention, deletion, export and incident processes are required?
- What are peak volumes, uptime expectations, backup and recovery requirements?

## 5. Evidence and value measurement

For each validated problem, capture a baseline before proposing a target. Candidate metrics:
- Duplicate learner/person records per 1,000 records
- Time to admit, transfer or locate a complete learner history
- Percentage of learner records with verified school/grade enrolment
- Teacher assignments with valid effective dates and approval
- Teacher workload conflicts detected before timetable publication
- Assessment import acceptance/rejection rates and correction time
- Reconciliation variance between source rows and published aggregates
- Time from assessment close to approved result publication
- Percentage of results with complete scoring and curriculum provenance
- Percentage of school comparisons showing eligible, participating and valid-result denominators
- Intervention follow-up completion and evidence capture
- User task completion, time-on-task, error rate and support requests
- Unauthorised access attempts, scope violations and export exceptions

Do not set arbitrary improvement targets before baseline measurement and stakeholder agreement.

## 6. Transparent solution selection

Apply hard gates first: child safeguarding, privacy, security, lawful authority, feasibility of operation and acceptable institutional risk. A failed gate means reject or redesign.

For each surviving option, rate 1–5 with written evidence:
- Learner/educator outcome impact — 25%
- Problem severity/frequency — 15%
- Reach across institutions and workflows — 10%
- Feasibility and delivery complexity — 10%
- Data quality/interoperability/redundancy reduction — 10%
- Security/privacy/safeguarding design — 10%
- Usability/accessibility/connectivity — 10%
- Lifecycle cost/maintainability — 5%
- Evidence confidence/testability — 5%

Weighted score = sum(weight × rating / 5), on a 100-point scale. The weights are initial hypotheses, not fixed policy. Perform sensitivity analysis. If rankings change materially under plausible weights, gather more evidence or run a reversible pilot. Add effort, dependencies, operational cost and reversibility as secondary decision dimensions. Human owners make and document final decisions.

## 7. Ideation patterns to test

For every problem, compare at least three classes of response:
1. Process/policy simplification: remove unnecessary handoffs, approvals or repeated data capture.
2. Data and integration solution: canonical identifiers, controlled reference data, API/import standards and automated reconciliation.
3. Product workflow: guided forms, validation, approvals, dashboards, alerts and evidence capture.

Do not assume a new screen is the answer. A shared master-data service, a revised template, an integration contract or a policy clarification may create more value at lower cost.

## 8. Exit criteria for discovery

Discovery is sufficient to baseline architecture and release priorities only when:
- Critical stakeholder groups and decision owners are identified.
- High-value workflows have been observed and mapped.
- Problem hypotheses have supporting and disconfirming evidence.
- Source systems, data owners, identifiers and quality risks are inventoried.
- Grade 1–9 regular/adapted curriculum source/version strategy is agreed.
- Internal, inter-school and external assessment processes are documented.
- Role/scope and child-data governance requirements are approved.
- Connectivity, device, scale and support assumptions are measured.
- Prototype tests and baseline metrics inform a ranked solution backlog.
- Open decisions, risks, dependencies and approval owners are explicit.

