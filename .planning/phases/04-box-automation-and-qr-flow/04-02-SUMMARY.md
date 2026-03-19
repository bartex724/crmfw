---
phase: 04-box-automation-and-qr-flow
plan: 02
subsystem: api
tags: [nestjs, prisma, boxes, events, transactions]
requires:
  - phase: 04-box-automation-and-qr-flow
    provides: Box domain foundation models and guarded box CRUD routes from 04-01
provides:
  - Membership-only box item assignment endpoint with idempotent replacement semantics
  - Transactional event box expansion (`add`, `add-missing`, `remove`) with quantity-preserving merge behavior
  - Deterministic multi-box projection contract (`first box code +N`) and regression coverage
affects: [04-03, 04-04, box-expansion, qr-flow]
tech-stack:
  added: []
  patterns:
    - TDD flow for API contracts (RED -> GREEN) per task
    - Serializable Prisma transactions for event box merge/race safety
key-files:
  created:
    - src/boxes/dto/assign-box-items.dto.ts
    - tests/boxes/box-item-assignment.spec.ts
    - tests/events/event-box-expansion.spec.ts
    - tests/events/fixtures/event-box-expansion-harness.ts
  modified:
    - src/boxes/boxes.controller.ts
    - src/boxes/boxes.service.ts
    - src/events/events.controller.ts
    - src/events/events.service.ts
key-decisions:
  - "Box assignment endpoint replaces membership atomically and validates duplicates/unknown IDs before writes."
  - "Event add-box/add-missing/remove flows run in serializable transactions and keep existing plannedQuantity unchanged."
  - "Multi-box display marker is persisted as computed event item boxCode using linked order (createdAt asc, boxCode asc) -> `first +N`."
patterns-established:
  - "Single-item `POST /events/:id/items` remains isolated from box expansion side effects."
  - "Box removal from event is history-safe: relation removal only, no event item line reversal."
requirements-completed: [BOX-02, BOX-03, BOX-04]
duration: 15min
completed: 2026-03-19
---

# Phase 4 Plan 2: Box Assignment and Event Expansion Summary

**Box membership assignment and event box expansion shipped with transactional merge rules, deterministic multi-box display projection, and non-regression safeguards for single-item add flow.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-19T19:01:22Z
- **Completed:** 2026-03-19T19:16:46Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Implemented `PUT /boxes/:boxId/items` with membership-only payload contract (`itemIds`) and idempotent replacement semantics.
- Added event box endpoints for add/add-missing/remove with transaction-scoped merge logic that preserves existing event quantities.
- Locked regression coverage for duplicate add conflict, deterministic `first box code +N` formatting, remove-without-reversal behavior, and single-item non-expansion.

## Task Commits

1. **Task 1: Implement membership-only item assignment for boxes with idempotent replacement semantics** - `849b272` (test), `958a239` (feat)
2. **Task 2: Add transactional event-box expansion, merge rules, and single-item non-expansion safeguards** - `e1d271d` (test), `8e568c2` (feat)

## Files Created/Modified

- `src/boxes/boxes.controller.ts` - Added guarded `PUT /boxes/:boxId/items` assignment route.
- `src/boxes/boxes.service.ts` - Implemented assignment validation, transactional replacement, and audit logging.
- `src/boxes/dto/assign-box-items.dto.ts` - Added validated membership payload contract (`itemIds`).
- `src/events/events.controller.ts` - Added add-box, add-missing, and remove-box endpoints.
- `src/events/events.service.ts` - Implemented serializable transactional expansion/merge/remove logic with deterministic `boxCode` projection.
- `tests/boxes/box-item-assignment.spec.ts` - Added BOX-02 regression suite.
- `tests/events/event-box-expansion.spec.ts` - Added BOX-03/BOX-04 regression suite.
- `tests/events/fixtures/event-box-expansion-harness.ts` - Added dedicated expansion harness for deterministic relation-order behavior in tests.

## Decisions Made

- Used service-level duplicate and unknown-item validation for box assignment in addition to DTO validation to keep behavior deterministic in test and runtime paths.
- Treated duplicate box-to-event add as a conflict boundary backed by unique `(eventId, boxId)` semantics and serializable transactions.
- Represented multi-box marker directly in `EventItem.boxCode` using computed relation order (`createdAt`, tie-break `boxCode`) to preserve existing response contract shape.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added dedicated event expansion harness for relation-aware transactional tests**
- **Found during:** Task 2 implementation
- **Issue:** Existing shared events harness did not model `box`, `boxItem`, `eventBox`, and `eventItemBox` operations required by add/add-missing/remove flows.
- **Fix:** Introduced `tests/events/fixtures/event-box-expansion-harness.ts` and wired expansion tests to it.
- **Files modified:** `tests/events/event-box-expansion.spec.ts`, `tests/events/fixtures/event-box-expansion-harness.ts`
- **Verification:** `npm run test -- tests/events/event-box-expansion.spec.ts --runInBand`
- **Committed in:** `8e568c2` (Task 2 feat commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** No scope creep; deviation was required to execute and verify planned transactional behavior.

## Issues Encountered

- None beyond planned TDD RED failures and expected harness gap resolved via Rule 3.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BOX-02/03/04 backend contracts and regressions are in place for QR-centric box flow continuation.
- Event endpoints now expose explicit box add/add-missing/remove actions required by downstream phase UI and scan workflows.

---
*Phase: 04-box-automation-and-qr-flow*
*Completed: 2026-03-19*

## Self-Check: PASSED

- FOUND: `.planning/phases/04-box-automation-and-qr-flow/04-02-SUMMARY.md`
- FOUND commit: `849b272`
- FOUND commit: `958a239`
- FOUND commit: `e1d271d`
- FOUND commit: `8e568c2`
