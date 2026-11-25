# Sentinel — Project Handoff & Current Status

Last checkpoint: 26 November 2026. Update this file and the linked Notion checkpoint after material progress.

## Start here in future chats
Read the Notion handoff page and the Sentinel Product & Engineering Blueprint before continuing:
https://app.notion.com/p/423d7d0ea58d8133a62bea7223f4c98e

Then inspect the latest GitHub branch state before editing. Do not repeat bootstrap work or assume approvals are complete.

## Working agreement
- Product: Sentinel, a curriculum-informed assessment and learning-improvement platform.
- Repository: https://github.com/gvffbhdvgf/cbe
- Working branch: sentinel/bootstrap
- Isolate all project work under sentinel/.
- Local-first development where practical; sync reviewed changes to GitHub and keep Notion aligned.
- Do not trigger Vercel production deployment on every commit. User cites a 24-hour deployment usage limit; use controlled/manual release deployment.
- Evaluate Resend vs SenderKit before choosing a communications provider.
- Use Cloudflare for relevant DNS, edge, security and R2 needs; Neon is the proposed PostgreSQL provider.
- Never commit real secrets or expose connected-plugin OAuth credentials.
- User asked to replace Local Commander with another local-computer plugin. Do not use Local Commander again unless asked.

## GitHub bootstrap
Created and verified on sentinel/bootstrap:
- sentinel/README.md
- sentinel/docs/PRODUCT_REQUIREMENTS.md
- sentinel/docs/ARCHITECTURE.md
- sentinel/docs/SECURITY_AND_ENVIRONMENTS.md
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

## Local tooling status
- Local Commander previously failed to complete a Windows directory listing and reported unresolved execution leases. Do not use it again unless the user asks.
- Remote Desktop Commander reports no devices paired/connected. No local files were changed through it.
- Cmdexa reports Windows device Machukhu online and healthy, paired to the account (agent/helper version 0.6.423).
- A Cmdexa read-only execution preflight was submitted to check Git, Node, npm, Python and PowerShell availability. It is waiting for local desktop approval; verdict is unverified. No command has executed and no local files have been changed through Cmdexa.
- Next: approve the visible Cmdexa local read-only preflight on the Windows desktop. After completion, inspect tool availability and project path, then create/verify the local Sentinel workspace and sync sentinel/bootstrap.
- Terminal Commands is another candidate, but do not start a billable Codespace without explicit consent.
- Do not claim local setup succeeded until the connector confirms it.

## Vercel
- Team access request for team_sXlkYQpoRcDz7TxGl5gWroZy was pending at last check.
- No project settings or environment variables changed; no deployment triggered.
- After access is granted, inspect project Git integration and environment targets. Configure a manual or controlled release path and verify no per-commit production deployments.

## Product/architecture principles
- Version KICD curriculum and preserve source provenance.
- Learner identity is independent of school enrolment.
- Raw marks, performance levels and curriculum-outcome mastery are distinct.
- Results retain assessment, scoring and curriculum-version context.
- Analytics show denominators and data coverage.
- Educators remain responsible for high-stakes learner decisions.
- Recommended initial architecture: modular monolith, Next.js/TypeScript, PostgreSQL/Neon, Prisma subject to compatibility, Cloudflare where appropriate.

## Evidence caveats
- The external Notion implementation brief belongs to another workspace and has not yet been retrieved through the connected integration.
- Preliminary Grade 6 totals suggested public/private enrolment 1,301 + 105 = 1,406 while combined cluster total was reported as 1,405. This one-learner discrepancy is unresolved and must be checked against exact source files.
- Full outcome-by-outcome KICD mapping for Grades 6 and 9 has not been completed.

## Immediate next actions
1. Approve and complete the Cmdexa read-only preflight; inspect local tooling and paths.
2. Create/verify the local sentinel workspace and sync sentinel/bootstrap.
3. Obtain Vercel team approval; inspect project and deployment configuration without triggering builds.
4. Retrieve the external Notion brief and reopen exact assessment files before finalising requirements.
5. Validate Neon and Cloudflare account/project context before provisioning.
6. Define communications workflows, then select Resend or SenderKit.
7. Continue discovery and architecture validation before implementing application features.
