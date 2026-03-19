# Warehouse Event Packing System

## What This Is

An internal web system for warehouse and office teams to manage event packing from a central inventory database. It tracks event-specific item states, returns, and losses while preserving a single stock source of truth. The product is designed for operational speed with role-based access, box workflows, photo support, and Excel exports.

## Core Value

Teams can prepare and reconcile event packing quickly without losing stock accuracy.

## Requirements

### Validated

- [x] ACL-01 - Admin account lifecycle (create, role assignment, disable/enable, reset) implemented in backend
- [x] ACL-02 - Module-level permission guard and role matrix enforcement implemented
- [x] ACL-03 - Guest role is read-only and denied write/export actions
- [x] INV-01 - Inventory item CRUD with name/code/quantity/notes and hard-delete controls implemented
- [x] INV-02 - Category assignment and category-based inventory filtering implemented
- [x] INV-03 - Inventory list sorting/filtering/layout/hide-unavailable contracts implemented
- [x] INV-04 - Central warehouse quantity displayed from single item stock source implemented
- [x] INV-05 - Stock quantity changes constrained to explicit preview/apply correction flows
- [x] EVT-01 - Event creation endpoints implemented with Draft/Active/Closed lifecycle model
- [x] EVT-02 - Event item planning supports inventory item assignment with planned quantity
- [x] EVT-03 - Event items support To Pack, Packed, Returned, and Loss states
- [x] EVT-04 - Event status transitions remain event-scoped and do not mutate global inventory stock
- [x] EVT-05 - Event detail payload includes box metadata contract and fallback semantics
- [x] IMG-01 - Main photo plus optional gallery support implemented for each item
- [x] IMG-02 - Inventory list payload exposes main photo and preview metadata
- [x] IMG-03 - Gallery ordering/main-photo selection and auto-promotion behavior implemented
- [x] UI-01 - Warehouse-oriented list action/layout contract implemented in API
- [x] OPS-01 - PostgreSQL Prisma schema foundation and readiness probe implemented
- [x] OPS-02 - External storage driver contract (local/NAS) validated at startup
- [x] OPS-03 - Local image storage with NAS-switchable path support implemented
- [x] OPS-04 - Docker artifacts and static compose/Dockerfile contract tests implemented
- [x] OPS-05 - Security baseline implemented (audit events, throttling, redaction, 90-day retention)
- [x] BOX-01 - Dedicated box management module implemented
- [x] BOX-02 - Box-to-inventory assignment workflow implemented
- [x] BOX-03 - Event add-box auto-expansion implemented
- [x] BOX-04 - Single-item add path remains isolated (no full-box auto-pull)
- [x] BOX-05 - Unique box QR generation contract implemented
- [x] BOX-06 - Scan route resolves to canonical box workflow context implemented
- [x] LOS-01 - Loss quantity capture implemented per event item
- [x] LOS-02 - Loss-driven central stock correction implemented
- [x] LOS-03 - Returned quantity capture implemented for reconciliation
- [x] LOS-04 - Reconciliation audit trail implemented
- [x] XLS-01 - Packing List Excel export implemented
- [x] XLS-02 - Post-event Report Excel export implemented
- [x] XLS-03 - Live snapshot export behavior implemented

### Active

- [ ] Add authenticated E2E flow coverage for login cookie handoff (`/auth/login` -> guarded routes) to close OPS-05 integration gap from v1.0 audit
- [ ] Execute and document real-device QR scan + box workflow UAT to fully close BOX-06 milestone audit gap

### Out of Scope

- Public or customer-facing portal - system is internal-only
- E-commerce checkout and payment features - not related to warehouse packing flow
- Native mobile apps - web-first delivery for MVP speed

## Context

- Inventory is centralized in one warehouse database.
- Events behave as packing lists that reference inventory items.
- Event items use event-specific statuses: To Pack, Packed, Returned, Loss.
- Stock shown in inventory is the full warehouse quantity; loss entry is the stock correction trigger.
- Boxes are separate entities with assigned items and QR-based navigation.
- Photos include one main photo plus optional gallery per item.
- Exports are required per event in two formats: Packing List and Post-event Report.

## Current State

- v1.0 milestone shipped and archived on 2026-03-19.
- Backend contracts for inventory, events, boxes, reconciliation, and Excel export are implemented and verified.
- Milestone audit notes two follow-up hardening items (BOX-06 human UAT evidence, OPS-05 login-cookie E2E path).

## Next Milestone Goals

- Close accepted v1.0 audit gaps with explicit implementation/verification artifacts.
- Define next functional scope through fresh milestone requirements (instead of extending v1 in-place).
- Keep requirement-to-phase traceability and verification coverage from day one of the next milestone.

## Constraints

- **Database**: PostgreSQL - required for production data integrity and relational modeling
- **Image Storage**: Outside DB - keep binary files out of PostgreSQL and enable storage driver swapping
- **Configuration**: Environment-based - support local/test/prod differences cleanly
- **Storage Backend**: Local for testing, switchable to NAS/network path in production - operational flexibility
- **Deployment**: Docker-based - predictable deployment and environment parity
- **Access Control**: Role-based permissions - internal safety and responsibility boundaries
- **UX Direction**: Clean admin-style UI - optimize for fast warehouse workflows

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Model events as packing lists | Matches real-world warehouse workflow | Confirmed in phase plan decomposition and roadmap |
| Keep central stock as the source of truth | Prevents event-level drift in inventory totals | Confirmed in requirements and phase sequencing |
| Apply stock corrections from recorded losses | Keeps reconciliation explicit and auditable | Implemented in Phase 5 (LOS-01..LOS-04) |
| Treat boxes as first-class entities with QR codes | Improves operational speed and traceability | Implemented in Phase 4 (BOX-01..BOX-06) |
| Store images outside PostgreSQL | Better performance and easier storage scaling | Implemented via validated local/NAS storage abstraction |
| Enforce server-side RBAC with shared permission matrix | Consistent authorization across modules | Implemented in `src/access/*` with passing tests |
| Use DB-backed opaque sessions with revocation support | Supports strict admin password/reset policies | Implemented in `src/auth/session.service.ts` |
| Require explicit confirmation payload for sensitive admin mutations | Prevent accidental privileged actions | Implemented with `ADMIN_CONFIRMATION_REQUIRED` behavior |
| Persist auth/user audit events and run 90-day retention cleanup | Operational compliance and traceability | Implemented in `src/audit/*` and verified in tests |

## Post-v1 Hardening Backlog

- OPS-05 follow-up: add non-bypass integration tests that use real session cookie auth path end-to-end.
- BOX-06 follow-up: complete human UAT evidence for physical QR scan/browser journey and box page status workflow.

---
*Last updated: 2026-03-19 after Phase 5 completion (reconciliation and Excel exports)*
