# Roadmap: Warehouse Event Packing System

## Overview

Build a production-ready internal warehouse platform in five phases: establish secure foundations, implement inventory and media operations, layer event packing workflows, automate box handling through QR flows, and finish with reconciliation/export capabilities for MVP release.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation and Access Control** - production baseline, auth, and role permissions
- [x] **Phase 2: Inventory Catalog and Media** - item, category, photo, and list workflow core (completed 2026-03-19)
- [x] **Phase 3: Event Packing Workflow** - event-as-packing-list lifecycle and status handling (completed 2026-03-19)
- [ ] **Phase 4: Box Automation and QR Flow** - box entities, auto-add logic, and scan entrypoint
- [ ] **Phase 5: Reconciliation and Excel Exports** - loss/return reconciliation and operational reports

## Phase Details

### Phase 1: Foundation and Access Control
**Goal**: Deliver a secure production-ready base with PostgreSQL, Docker, and role-based access for all internal user types.
**Depends on**: Nothing (first phase)
**Requirements**: ACL-01, ACL-02, ACL-03, OPS-01, OPS-02, OPS-04, OPS-05
**Success Criteria** (what must be TRUE):
  1. Admin can create users and assign Admin, Warehouse staff, Office staff, and Guest roles.
  2. Permission checks block unauthorized writes by role across major modules.
  3. App runs with PostgreSQL and environment-based configuration in Docker deployment.
**Plans**: 8 plans

Plans:
- [x] 01-01-PLAN.md - Scaffold NestJS baseline, scripts, and bootstrap test harness
- [x] 01-02-PLAN.md - Implement Prisma foundation schema, seed contract, and DB readiness checks
- [x] 01-03-PLAN.md - Build permission matrix guard and guest restriction enforcement
- [x] 01-04-PLAN.md - Implement auth/session policy and admin-managed permanent password lifecycle
- [x] 01-05-PLAN.md - Enforce sensitive-action confirmations and audit event persistence
- [x] 01-06-PLAN.md - Add validated external storage configuration and driver abstraction
- [x] 01-07-PLAN.md - Apply security hardening (redaction, throttling, 90-day retention)
- [x] 01-08-PLAN.md - Finalize Docker deployment contract with fast prechecks and compose gate

### Phase 2: Inventory Catalog and Media
**Goal**: Ship daily inventory operations with categories, photos, and warehouse-friendly listing behavior.
**Depends on**: Phase 1
**Requirements**: INV-01, INV-02, INV-03, INV-04, INV-05, IMG-01, IMG-02, IMG-03, UI-01, OPS-03
**Success Criteria** (what must be TRUE):
  1. Users can manage items and categories, and view central stock quantities in one inventory screen.
  2. Inventory list supports sorting, filtering, hide-unavailable behavior, and alternate list layouts.
  3. Each item has main photo plus optional gallery, with list thumbnail and detail gallery preview.
  4. Image storage works locally in test mode and can be switched to network/NAS path via config.
**Plans**: 3 plans

Plans:
- [x] 02-01: Implement inventory and category CRUD with central stock model
- [x] 02-02: Build list UX (sort/filter/layout/hide-unavailable) and image preview behavior
- [x] 02-03: Integrate image upload pipeline and storage adapter switching

### Phase 3: Event Packing Workflow
**Goal**: Enable event-based packing execution using event-specific item statuses.
**Depends on**: Phase 2
**Requirements**: EVT-01, EVT-02, EVT-03, EVT-04, EVT-05
**Success Criteria** (what must be TRUE):
  1. Users can create events and add inventory items with planned quantities.
  2. Event items support To Pack, Packed, Returned, and Loss states per event.
  3. Status changes remain scoped to the event and preserve global inventory definitions.
  4. Event rows show linked box metadata when applicable.
**Plans**: 2 plans

Plans:
- [x] 03-01: Build event and event-item data model with status lifecycle
- [x] 03-02: Implement event planning/packing UI and event-specific state transitions

### Phase 4: Box Automation and QR Flow
**Goal**: Add box-driven acceleration with automatic event expansion and QR page entry.
**Depends on**: Phase 3
**Requirements**: BOX-01, BOX-02, BOX-03, BOX-04, BOX-05, BOX-06
**Success Criteria** (what must be TRUE):
  1. Boxes are managed in a dedicated section and can hold assigned inventory items.
  2. Adding a box to an event expands into all assigned items automatically.
  3. Adding a single item does not pull in unrelated box contents.
  4. Each box has a unique QR code, and scan navigation opens the box workflow page.
**Plans**: 4 plans

Plans:
- [x] 04-01-PLAN.md - Implement box domain foundation and dedicated CRUD API
- [x] 04-02-PLAN.md - Implement box item assignment and event auto-expansion semantics
- [x] 04-03-PLAN.md - Implement deterministic box QR generation and configuration contract
- [ ] 04-04-PLAN.md - Implement guarded scan/context workflow with explicit event selection

### Phase 5: Reconciliation and Excel Exports
**Goal**: Complete loss/return reconciliation and deliver required event Excel outputs for operations.
**Depends on**: Phase 4
**Requirements**: LOS-01, LOS-02, LOS-03, LOS-04, XLS-01, XLS-02, XLS-03
**Success Criteria** (what must be TRUE):
  1. Users can record losses with quantity and stock is corrected automatically.
  2. Users can mark returns and keep reconciliation history for post-event reporting.
  3. System stores auditable history for loss/return adjustments.
  4. Packing List and Post-event Report Excel exports are generated with required columns.
**Plans**: 3 plans

Plans:
- [ ] 05-01: Implement loss and return reconciliation logic with audit trail
- [ ] 05-02: Build Excel export generators for packing list and post-event report
- [ ] 05-03: End-to-end validation and MVP release hardening

## Progress

**Execution Order:**
Phases execute in numeric order: 2 -> 2.1 -> 2.2 -> 3 -> 3.1 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Access Control | 8/8 | Complete | 2026-03-19 |
| 2. Inventory Catalog and Media | 3/3 | Complete    | 2026-03-19 |
| 3. Event Packing Workflow | 2/2 | Complete    | 2026-03-19 |
| 4. Box Automation and QR Flow | 3/4 | In Progress|  |
| 5. Reconciliation and Excel Exports | 0/3 | Not started | - |
