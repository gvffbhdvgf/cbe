# ADR-005 — Institution Transfer Eligibility Registry

**Status:** Proposed implementation decision for the Sentinel transfer-registry milestone. The implementation follows this decision; authority/API questions remain open.

## Context

The transfer workflow previously listed every active organisation as a possible receiving institution. The database request function checked that the destination was active, but did not establish that it was a real, registered and currently eligible education institution. An organisation UUID or active Sentinel account is not proof of institutional authority.

## Source-backed identity model

The Kenya Ministry of Education's school-census instructions distinguish the Unique Institutional Code (UIC/NEMIS Code) from the Ministry of Education registration number. KNEC separately registers examination centres; a KNEC centre code is not, by itself, proof of legal school registration.

Sources:
- [Ministry of Education — 2024 School Census instructions](https://nemis.education.go.ke/Documents/SchoolCensus/School_Census_Instructions_for_Advance_Questionnaires.pdf)
- [Ministry of Education — Basic standard requirements for registration](https://www.education.go.ke/sites/default/files/2022-12/BASIC%20STANDARD%20REQUIREMENTS%20FOR%20REGISTRATION.pdf)
- [KNEC — Registration of examination centres](https://knec.ac.ke/services/registration-of-centres/index.html)
- [KEMIS — official system overview and onboarding FAQ](https://kemis.go.ke/)

## Decision

1. Maintain one current transfer-eligibility record per Sentinel organisation, with states `pending`, `verified`, `rejected` and `suspended`.
2. An institution submits one primary official identifier and an evidence reference. Supported identifier types initially include Ministry of Education registration number, NEMIS UIC, KEMIS institution ID, TVETA registration number and an explicitly reviewed other-authority identifier. A KNEC centre code is not accepted as the primary school identifier.
3. Do not scrape NEMIS/KEMIS or automate verification without documented API access and authority. Until an approved integration exists, an active Sentinel platform administrator manually checks the submitted identifier against an authoritative registry or official registration evidence.
4. Store the identifier, evidence reference, verification method, reviewer, timestamps and decision. Do not upload or copy registration certificates into the application as part of this workflow.
5. The reviewer must be an active platform administrator and must differ from the requester. Verification, rejection, suspension and resubmission are audited.
6. Only active organisations with status `verified` and a non-expired eligibility period appear in the receiving-institution directory.
7. Enforce eligibility in PostgreSQL: check at transfer request, receiving acceptance and source release. An already released transfer may be completed against its previously accepted destination if eligibility is later suspended, avoiding a stranded learner; the suspension remains subject to platform-admin incident review.
8. Keep learner/enrolment reads inside the authenticated RLS-scoped transaction. A narrow SECURITY DEFINER directory function exposes only verified institution IDs and names.
9. Preserve source-identity separation: the receiving institution must not gain the source learner's name, learner reference, source enrolment ID or source identity link.

## Data and security shape

- `organisation_transfer_eligibility`: one row per organisation; submitted identifier, status, evidence reference, request actor/time, review actor/time, verification method, validity date, rejection/suspension reasons.
- Forced RLS; SELECT only for the organisation's authorised managers and active platform administrators.
- Runtime receives no direct INSERT/UPDATE/DELETE. Narrow SECURITY DEFINER functions own request, review and suspension transitions.
- A unique issuer/identifier constraint prevents the same official institution identifier being claimed by multiple Sentinel organisations.
- Audit metadata contains institutional identifiers and workflow references only; no learner identity or uploaded documents.

## Consequences and open governance items

The development organisation named Softflix has no official institutional identifier and is not a school registry fixture; it remains ineligible. Positive tests use synthetic institutions on an expiring Neon child branch.

Still to confirm:
- The currently authoritative Ministry registry and whether KEMIS exposes an approved institutional lookup API for Sentinel.
- Institution categories eligible to receive transfers in the first release.
- Default verification validity period and re-verification triggers.
- Kenyan data-protection and education-sector governance review before live learner transfers.

