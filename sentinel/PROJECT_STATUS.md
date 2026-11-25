# Sentinel — Project Handoff & Current Status

Last checkpoint: 25 November 2026. Update this file and the linked Notion checkpoint after material progress.

## Start here in future chats

Read the Notion handoff page and the Sentinel Product & Engineering Blueprint before continuing:
https://app.notion.com/p/423d7d0ea58d8133a62bea7223f4c98e

Then inspect the latest GitHub branch state through the GitHub integration before editing. Do not repeat bootstrap work or assume approvals are complete.

## Working agreement

- Product: Sentinel, a curriculum-informed assessment and learning-improvement platform.
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

## GitHub bootstrap

Created and verified on sentinel/bootstrap:
- sentinel/README.md
- sentinel/docs/PRODUCT_REQUIREMENTS.md
- sentinel/docs/ARCHITECTURE.md
- sentinel/docs/SECURITY_AND_ENVIRONMENTS.md
- sentinel/.gitignore
- sentinel/.env.example
- sentinel/PROJECT_STATUS.md (this durable checkpoint)
- sentinel/docs/ASSESSMENT_EVIDENCE_AUDIT.md

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
- Learner identity is independent from school enrolment.
- Raw marks, performance levels and curriculum-outcome mastery are distinct.
- Results retain assessment, scoring and curriculum-version context.
- Analytics show denominators and data coverage.
- Educators remain responsible for high-stakes learner decisions.
- Recommended initial architecture: modular monolith, Next.js/TypeScript, PostgreSQL/Neon, Prisma subject to compatibility, Cloudflare where appropriate.

## Evidence caveats

- The external Notion implementation brief belongs to another workspace and has not yet been retrieved through the connected integration.
- Grade 6 category totals are 1,406 (public 1,301 + private 105), but the source report contains conflicting cluster roll presentations: page 40 sums to 1,408; page 41 prints 1,405; cluster rows also differ for Sisiluma and Muchesima. See ASSESSMENT_EVIDENCE_AUDIT.md.
- Grade 9 cluster total is 1,402. Its school-level table shows four private schools (roll 75), while the preface says five private schools participated; this requires clarification.
- KICD curriculum structures and official Grade 6/Grade 9 resources have been reviewed at a structural level. Outcome-by-outcome mapping is not yet complete.

## Immediate next actions

1. Retrieve the external Notion implementation brief through an authorised share/export route.
2. Obtain written source-owner confirmation for Grade 6 conflicting cluster counts and Grade 9 private-school participation.
3. Validate learner-level source records against school, cluster, category and gender aggregates.
4. Obtain actual assessment papers, marking schemes and moderation records; then complete KICD outcome mapping.
5. Validate institutional users, roles, school/cluster/zone hierarchy, approval workflows, imports, reporting and intervention processes.
6. Inspect Cloudflare accounts and relevant existing resources read-only; do not provision without an approved architecture.
7. Resolve the intended Vercel project/hosting arrangement. Do not use one of the unrelated existing projects by assumption, and do not enable per-commit production deployment.
8. Reassess Neon after the database/environment plan is approved; current organisation has no projects.
9. Define notification workflows, then select Resend or SenderKit.
10. Finalise requirements and architecture before creating application features.

## Handoff instruction for future chats

Use cloud-connected plugins only. Read this checkpoint and the linked Sentinel Blueprint, Product Requirements, Architecture and Security documents. Inspect the latest GitHub branch and relevant cloud service state before changing anything. Do not use local-machine tooling or ChatGPT Work. Do not repeat completed bootstrap work, do not assume pending approvals have been granted, and update this checkpoint after material progress.
