# Sentinel — Project Handoff & Current Status

Last checkpoint: 25 November 2026. Update this file and the linked Notion checkpoint after material progress.

## Start here in future chats

Read the Notion handoff page and the Sentinel Product & Engineering Blueprint before continuing:
https://app.notion.com/p/423d7d0ea58d8133a62bea7223f4c98e

Then inspect the latest GitHub branch state through the GitHub integration before editing. Do not repeat bootstrap work or assume approvals are complete.

## Working agreement

- Product: Sentinel, a comprehensive, enterprise-grade education management and intelligence platform supporting Grades 1–9.
- Grade 6 and Grade 9 datasets are reference evidence for discovery and validation only; they do not constrain platform coverage.
- Repository: https://github.com/gvffbhdvgf/cbe
- Working branch: sentinel/bootstrap
- Isolate all project work under sentinel/.
- Cloud-first workflow: use GitHub, Notion, Vercel, Neon, Cloudflare and other connected plugins directly.
- Do not use local-machine connectors, local shells/terminals, desktop/computer automation or ChatGPT Work unless the user explicitly changes this instruction.
- Keep GitHub implementation and Notion documentation aligned.
- Do not trigger Vercel production deployment on every commit. User cites a 24-hour deployment usage limit; use controlled/manual release deployment.
- Evaluate Resend vs SenderKit before choosing a communications provider.
- Use Cloudflare for relevant DNS, edge, security and R2 needs; Neon is the proposed PostgreSQL provider.
- Never commit real secrets or expose connected-plugin OAuth credentials.

## Expanded product scope

The product is to be discovered and designed as one coherent platform, including:
- Institution, organisation and school management
- Learner identity, admission, enrolment, progression and transfer history
- Teacher/workforce records, assignments, workload and relevant professional workflows
- Versioned Grade 1–9 curriculum intelligence
- Teaching and learning operations where validated
- Internal, school-based, inter-school/zonal and external assessment management
- Learner progress, learning-gap analysis and educator-led interventions
- Inter-school, cluster, zone and system-level analytics
- Governance, security, privacy, approvals, audit and data lifecycle
- Integrations, reporting, imports/exports, notifications and platform administration

This is the target discovery scope, not an assertion that every feature is approved for the first release. User requires design thinking, ideation, problem discovery, value evaluation and a transparent algorithmic approach to comparing solution options. The new discovery framework defines the method, weighted decision model, data-redundancy principles, enterprise quality attributes and implementation readiness gates.

## Product discovery baseline

See [PRODUCT_DISCOVERY_AND_SOLUTION_SELECTION.md](https://github.com/gvffbhdvgf/cbe/blob/sentinel/bootstrap/sentinel/docs/PRODUCT_DISCOVERY_AND_SOLUTION_SELECTION.md).

The method is: empathise with stakeholders and observe workflows; define evidence-backed problems; ideate multiple options including process changes; prototype critical journeys; test with representative users; measure value and revise. Hard safety/privacy/legal/operability gates precede weighted scoring. The initial weighted model prioritises learner/educator impact, problem severity, reach, feasibility, data quality/redundancy, security, usability/connectivity, lifecycle cost and evidence confidence. Weights are provisional and must be calibrated with stakeholders.

## GitHub bootstrap

Created and verified on sentinel/bootstrap:
- sentinel/README.md
- sentinel/docs/PRODUCT_REQUIREMENTS.md
- sentinel/docs/ARCHITECTURE.md
- sentinel/docs/SECURITY_AND_ENVIRONMENTS.md
- sentinel/docs/ASSESSMENT_EVIDENCE_AUDIT.md
- sentinel/docs/CURRICULUM_ALIGNMENT_REGISTER.md
- sentinel/docs/PRODUCT_DISCOVERY_AND_SOLUTION_SELECTION.md
- sentinel/.gitignore
- sentinel/.env.example
- sentinel/PROJECT_STATUS.md (this durable checkpoint)

No application code, pull request, default-branch merge, cloud resource or production deployment has been created.

## Notion documents

- Product & Engineering Blueprint: https://app.notion.com/p/423d7d0ea58d81638b15f921729421cc
- Product Requirements: https://app.notion.com/p/423d7d0ea58d815eb288ec45f5803d81
- Architecture: https://app.notion.com/p/423d7d0ea58d81688729de12925308d3
- Security & Environments: https://app.notion.com/p/423d7d0ea58d81d38e5ae87efbf3824b
- Current Handoff: https://app.notion.com/p/423d7d0ea58d8133a62bea7223f4c98e

## Cloud service inspection

- GitHub repository access is confirmed. The working branch is sentinel/bootstrap.
- Vercel team access is available. The team currently lists four projects: v0-build-project, v0-cms-and-ad-sense-blog, v0-supabase-setup and v0-agriculture-management-system. No project named sentinel was found; do not attach or alter an unrelated project. No deployment was triggered and no settings or environment variables were changed.
- Neon organisation access is available, but the organisation currently returns no projects. Do not provision a database until the project architecture and environment plan are validated.
- Cloudflare identity and account access are connected. Read-only inventory found one account and no zones or Worker scripts. No Cloudflare resources have been created or changed.
- No secrets have been retrieved, copied, or exposed. Do not copy private credentials from plugin connections.

## Product/architecture principles

- Version KICD curriculum and preserve source provenance.
- Learner and teacher identities are independent from time-bound school enrolments/assignments.
- Canonical records have clear ownership; avoid module-specific duplicate master data.
- Raw marks, performance levels and curriculum-outcome mastery are distinct.
- Results retain assessment, scoring and curriculum-version context.
- Analytics show denominators, data coverage and lineage.
- Imports should be idempotent, validated, reconcilable and auditable.
- Educators remain responsible for high-stakes learner decisions.
- Prefer clear domain boundaries and a maintainable architecture; do not choose microservices without evidence.

## Evidence caveats

- The external Notion implementation brief belongs to another workspace and has not yet been retrieved through the connected integration.
- Grade 6 category totals are 1,406 (public 1,301 + private 105), but the source report contains conflicting cluster roll presentations: page 40 sums to 1,408; page 41 prints 1,405; cluster rows also differ for Sisiluma and Muchesima. See ASSESSMENT_EVIDENCE_AUDIT.md.
- Grade 9 cluster total is 1,402. Its school-level table shows four private schools (roll 75), while the preface says five private schools participated; this requires clarification.
- KICD curriculum structures and official Grade 6/Grade 9 resources have been reviewed at a structural level. Outcome-by-outcome mapping is not yet complete.

## Immediate next actions

1. Retrieve the external Notion brief through an authorised share/export route.
2. Map stakeholders and validate actual workflows across learner, teacher, school, assessment, curriculum, analytics and governance domains.
3. Confirm institutional hierarchy, role/permission model, teacher-management boundaries and external assessment requirements.
4. Obtain written source-owner confirmation for Grade 6 conflicting cluster counts and Grade 9 private-school participation.
5. Validate learner-level source records against school, cluster, category and gender aggregates.
6. Obtain actual assessment papers, marking schemes and moderation records; then complete KICD outcome mapping.
7. Validate privacy/legal responsibilities, retention, hosting constraints, expected scale, connectivity and service levels with authorised owners.
8. Resolve the intended Vercel project/hosting arrangement. Do not use one of the unrelated existing projects by assumption, and do not enable per-commit production deployment.
9. Reassess Neon after the database/environment plan is approved; current organisation has no projects.
10. Define notification workflows, then select Resend or SenderKit.
11. Prototype and test high-risk workflows before scaffolding production application code.

## Handoff instruction for future chats

Use cloud-connected plugins only. Read this checkpoint and the linked Sentinel Blueprint, Product Requirements, Architecture and Security documents. Inspect the latest GitHub branch and relevant cloud service state before changing anything. Do not use local-machine tooling or ChatGPT Work. Do not repeat completed bootstrap work, do not assume pending approvals have been granted, and update this checkpoint after material progress.


## 25 November 2026 — Enterprise domain and KICD Grades 1–9 design

The product is a comprehensive Grades 1–9 platform. KICD catalogue research confirms Regular Curriculum designs are organised as Lower Primary (Grades 1–3), Upper Primary (Grades 4–6) and Junior School (Grades 7–9), with adapted Special Needs Education designs also published across grades. Curriculum architecture must support versioned regular/adapted pathways and source provenance; do not hard-code Grade 6/9 or assume one flat subject list.

Official KICD catalogue:
- https://kicd.ac.ke/cbc-materials/curriculum-designs/regular-curriculum-designs/
- https://kicd.ac.ke/cbc-materials/lower-primary/
- https://kicd.ac.ke/cbc-materials/curriculum-designs/upper-primary-designs/
- https://kicd.ac.ke/cbc-materials/curriculum-designs/junior-school-designs/
- https://kicd.ac.ke/cbc-materials/curriculum-designs/sne-curriculum-designs/

New domain design: [DOMAIN_MODEL_AND_WORKFLOWS.md](https://github.com/gvffbhdvgf/cbe/blob/sentinel/bootstrap/sentinel/docs/DOMAIN_MODEL_AND_WORKFLOWS.md). It defines bounded contexts, canonical conceptual entities, lifecycle invariants, end-to-end workflows, redundancy controls, solution-priority hypotheses and implementation-readiness gates.

No production schema or application code has been created. Domain ownership, tenancy, workforce data authority, guardian access, assessment taxonomy, curriculum adoption, integration contracts, connectivity and service levels remain to be validated.
