# Requirements: Warehouse Event Packing System

**Defined:** 2026-03-19
**Core Value:** Teams can prepare and reconcile event packing quickly without losing stock accuracy.

## v1 Requirements

### Access and Roles

- [x] **ACL-01**: Admin can create user accounts and assign roles (Admin, Warehouse staff, Office staff, Guest)
- [x] **ACL-02**: Role permissions enforce read/write access by module (inventory, events, boxes, exports, user management)
- [x] **ACL-03**: Guest role is read-only and cannot change stock, statuses, or configuration

### Inventory and Categories

- [x] **INV-01**: User can create, edit, and archive inventory items with name/code, quantity, and notes
- [x] **INV-02**: User can assign each item to a category and filter inventory by category
- [x] **INV-03**: Inventory list supports sorting, filtering, and hide-unavailable-items behavior
- [x] **INV-04**: Inventory always displays the central warehouse quantity for each item
- [x] **INV-05**: Stock quantity updates only through explicit correction flows in the system

### Events and Packing Workflow

- [x] **EVT-01**: User can create events that act as packing lists
- [x] **EVT-02**: User can add inventory items to an event with planned quantity
- [x] **EVT-03**: Event items support statuses To Pack, Packed, Returned, and Loss
- [x] **EVT-04**: Event status updates are scoped to the event and do not alter global item definitions
- [x] **EVT-05**: Event item rows display linked box information when available

### Boxes and QR

- [x] **BOX-01**: User can manage boxes in a dedicated Boxes section separate from the main items list
- [ ] **BOX-02**: User can assign inventory items to a box definition
- [ ] **BOX-03**: Adding a box to an event automatically adds all items assigned to that box
- [ ] **BOX-04**: Adding a single item to an event does not automatically add the full box
- [ ] **BOX-05**: Each box has a unique QR code
- [ ] **BOX-06**: Scanning a box QR code opens the box page to manage related event item statuses

### Losses and Returns

- [ ] **LOS-01**: User can record lost quantity for an event item
- [ ] **LOS-02**: Recording loss automatically decreases central inventory quantity by the same amount
- [ ] **LOS-03**: User can mark event items as returned and capture returned quantity for reconciliation
- [ ] **LOS-04**: System stores an audit trail for loss and return adjustments

### Photos and UI

- [x] **IMG-01**: Each item supports one main photo and optional gallery photos
- [x] **IMG-02**: Inventory list shows main photo and supports image preview on hover
- [x] **IMG-03**: Item details provide gallery preview behavior
- [x] **UI-01**: Interface supports multiple list layouts optimized for warehouse operations

### Exports

- [ ] **XLS-01**: User can export event Packing List Excel with columns Name, Quantity, Box, Notes
- [ ] **XLS-02**: User can export event Post-event Report Excel with columns Name, Quantity, Loss, Box, Notes
- [ ] **XLS-03**: Exported files reflect current event values at export time

### Platform and Deployment

- [x] **OPS-01**: System uses PostgreSQL as the primary database
- [x] **OPS-02**: Images are stored outside the database via environment-configured storage
- [x] **OPS-03**: Local image storage is supported for testing and can be switched to NAS/network storage
- [x] **OPS-04**: System is deployable with Docker
- [x] **OPS-05**: Architecture is production-ready for internal operations

## v2 Requirements

### Workflow Extensions

- **WF-01**: Mobile-first scanning experience for handheld warehouse devices
- **WF-02**: Bulk import and bulk stock adjustment workflows
- **WF-03**: Advanced analytics dashboard for event accuracy and loss trends
- **WF-04**: Integrations with ERP/accounting systems

## Out of Scope

| Feature | Reason |
|---------|--------|
| Public/customer portal | Product is internal operations software |
| Payment or invoicing workflows | Not part of packing/inventory core value |
| Native mobile applications in MVP | Web-first delivery reduces scope and complexity |
| E-commerce storefront behavior | Outside warehouse event management domain |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ACL-01 | Phase 1 | Complete |
| ACL-02 | Phase 1 | Complete |
| ACL-03 | Phase 1 | Complete |
| OPS-01 | Phase 1 | Complete |
| OPS-02 | Phase 1 | Complete |
| OPS-04 | Phase 1 | Complete |
| OPS-05 | Phase 1 | Complete |
| INV-01 | Phase 2 | Complete |
| INV-02 | Phase 2 | Complete |
| INV-03 | Phase 2 | Complete |
| INV-04 | Phase 2 | Complete |
| INV-05 | Phase 2 | Complete |
| IMG-01 | Phase 2 | Complete |
| IMG-02 | Phase 2 | Complete |
| IMG-03 | Phase 2 | Complete |
| UI-01 | Phase 2 | Complete |
| OPS-03 | Phase 2 | Complete |
| EVT-01 | Phase 3 | Complete |
| EVT-02 | Phase 3 | Complete |
| EVT-03 | Phase 3 | Complete |
| EVT-04 | Phase 3 | Complete |
| EVT-05 | Phase 3 | Complete |
| BOX-01 | Phase 4 | Complete |
| BOX-02 | Phase 4 | Pending |
| BOX-03 | Phase 4 | Pending |
| BOX-04 | Phase 4 | Pending |
| BOX-05 | Phase 4 | Pending |
| BOX-06 | Phase 4 | Pending |
| LOS-01 | Phase 5 | Pending |
| LOS-02 | Phase 5 | Pending |
| LOS-03 | Phase 5 | Pending |
| LOS-04 | Phase 5 | Pending |
| XLS-01 | Phase 5 | Pending |
| XLS-02 | Phase 5 | Pending |
| XLS-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 35 total
- Mapped to phases: 35
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after Phase 3 completion*
