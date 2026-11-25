# ADR-001 — Tenant Boundary and Data Isolation

**Status:** Proposed for validation; not approved for production.  
**Decision owner:** Sentinel institutional/product governance authority.

## Context

Sentinel may serve multiple schools and administrative authorities. Schools, private institutions, counties and education authorities may have different operational and legal responsibilities. Shared analytics must not expose identifiable learner, teacher or guardian records across unauthorised boundaries. Legal controller/processor roles and contractual boundaries remain unknown; therefore a school, county or account must not automatically be assumed to be the legal tenant.

## Options

A. One database with organisation scope only. Lowest complexity, but a missed application filter can disclose another institution's records.

B. Shared PostgreSQL schema with an explicit tenant key and database-enforced Row-Level Security (RLS). Supports shared reporting and lower operational overhead, but requires rigorous RLS/context design, negative testing and a governed cross-tenant aggregation path.

C. Separate schema per tenant. More logical separation, but migrations, connection management and reporting become more complex. Schema separation alone is not a complete security boundary.

D. Separate database per tenant/controller. Stronger isolation and independent lifecycle/residency controls, but higher cost and more complex cross-tenant analytics and operations.

## Provisional recommendation

Use B as the default candidate only if the legal/contractual model permits a shared controller or shared processing arrangement and security review approves it. Define tenant from the actual authority that determines purposes and means of processing—not from the UI hierarchy.

Within a tenant, model county/sub-county/zone/cluster/school (or institution-defined alternatives) as effective-dated organisation units. A school-level role must not imply access to peer schools' identifiable records.

If independent controllers require separate retention, residency or operational ownership, choose D for those tenants. A hybrid topology may be required. Do not force all institutions into one pattern without evidence.

## Mandatory controls if B is selected

- Tenant key on every tenant-owned record; composite foreign keys where appropriate.
- RLS enabled and forced on protected tables; runtime role cannot bypass policies.
- Tenant context derived from authenticated server-side identity inside a transaction, never request-supplied tenant IDs.
- Separate privileged migration/admin role from runtime application role.
- Domain-level checks in addition to RLS.
- Jobs, exports, caches and search indexes enforce tenant scope; cache keys include tenant/scope.
- Automated cross-tenant read/write/update/delete and IDOR negative tests.
- Audited, time-limited break-glass access.
- Approved cross-tenant analytics over aggregates, not unrestricted row access.
- Tenant-specific restore, export and offboarding tests.

## Validation gates

Identify controllers/processors and contracts; confirm whether schools are independent controllers or subordinate units; approve sharing purposes, retention, residency and offboarding; complete DPIA/security review; prototype RLS and pass cross-tenant tests; validate aggregate disclosure rules; obtain institutional and data-protection owner approval.

Until these gates pass, this is an option analysis only. Do not provision production databases or load live learner data.
