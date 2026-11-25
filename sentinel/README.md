# Sentinel

Sentinel is a comprehensive education management and intelligence platform for Grades 1–9. It is intended to connect institutional operations, learner and teacher lifecycle, KICD curriculum, teaching and learning, internal/external assessment, learner progress and intervention, inter-school analytics, governance and security.

Grade 6 and Grade 9 assessment records are reference datasets for validation only; they do not limit platform scope.

This directory is the isolated Sentinel project workspace within the cbe repository. Keep Sentinel application code, engineering documentation, infrastructure definitions and tests under this directory unless a repository-wide concern genuinely belongs at the root.

## Product and engineering principles

- Engineer before coding: understand users, institutional context, workflows, outcomes and constraints.
- Use design thinking: empathise, define, ideate, prototype, test and iterate.
- Validate problems with evidence; do not confuse feature requests with root causes.
- Compare solution alternatives using transparent value, feasibility, risk and evidence criteria.
- Preserve curriculum edition/pathway and assessment provenance.
- Keep learner identity independent from school enrolment and teacher identity independent from assignments.
- Avoid redundant master records; define authoritative ownership and derived read models.
- Distinguish raw marks, performance levels and curriculum-outcome mastery.
- Make analytics denominator-aware, comparable and auditable.
- Keep educators responsible for high-stakes learner decisions.
- Protect children's data with privacy-by-design, least privilege and accountable access.
- Deliver the full platform through controlled, dependency-aware vertical releases.

## Discovery and design documents

- [Product Discovery & Solution Selection](docs/PRODUCT_DISCOVERY_AND_SOLUTION_SELECTION.md)
- [Problem Discovery & Validation Plan](docs/PROBLEM_DISCOVERY_AND_VALIDATION_PLAN.md)
- [Domain Model & Core Workflows](docs/DOMAIN_MODEL_AND_WORKFLOWS.md)
- [Release Roadmap](docs/RELEASE_ROADMAP.md)
- [Security & Privacy Threat Model](docs/SECURITY_PRIVACY_THREAT_MODEL.md)
- [Product Requirements](docs/PRODUCT_REQUIREMENTS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security & Environments](docs/SECURITY_AND_ENVIRONMENTS.md)
- [Assessment Evidence Audit](docs/ASSESSMENT_EVIDENCE_AUDIT.md)
- [KICD Curriculum Alignment Register](docs/CURRICULUM_ALIGNMENT_REGISTER.md)

## Engineering workflow

1. Review the original product brief, source records, KICD curriculum editions and institutional workflows.
2. Map stakeholder authority, source-of-truth ownership, data lifecycle and service constraints.
3. Validate problem hypotheses and measurable outcomes.
4. Prototype and test high-risk journeys before committing to physical schema or application code.
5. Record architecture and product decisions with alternatives and rationale.
6. Build incremental vertical slices with automated tests, security controls and migration/reconciliation plans.
7. Use cloud-connected services and plugins for repository work, documentation, infrastructure and collaboration.
8. Keep GitHub and Notion aligned with durable checkpoints.
9. Inspect deployment settings before enabling automation; ordinary commits must not trigger production deployments.
10. Release through explicit review, approval, monitoring and rollback controls.

## Current status

Discovery, conceptual domain model, workflow, privacy/security threat model and dependency-aware release sequencing are documented on the sentinel/bootstrap branch. Application implementation and production schema have not started. The original external implementation brief, institutional workflow validation, data ownership, tenancy, detailed curriculum edition inventory and legal/DPIA approvals remain open.

See the project handoff in Notion for continuity and cloud infrastructure status.

## Cloud-first working mode

Use GitHub, Notion, Vercel, Neon, Cloudflare and other connected plugins directly. Do not use local-machine connectors, terminal/shell execution, desktop automation or ChatGPT Work unless the user explicitly changes this instruction. Prefer cloud-native repository edits and reviewable commits.

## Configuration and secrets

Never commit .env files, API tokens, private keys, database passwords, email credentials or other secrets. Commit only a sanitised .env.example containing variable names and safe placeholders.
