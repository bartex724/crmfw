---
phase: 04-box-automation-and-qr-flow
plan: 03
subsystem: api
tags: [nestjs, prisma, qrcode, config, testing]
requires:
  - phase: 04-01
    provides: "Boxes module foundation with unique box codes and permission guards."
provides:
  - "Deterministic QR payload URL contract driven by APP_PUBLIC_BASE_URL."
  - "Guarded GET /boxes/:boxCode/qr endpoint returning payloadUrl and qrDataUrl."
  - "Automated QR tests for canonical payload path, uniqueness, and not-found handling."
affects: [04-04, boxes, qr-scan-flow]
tech-stack:
  added: [qrcode@1.5.4, "@types/qrcode"]
  patterns:
    [
      env-driven canonical URL composition,
      service-level QR generation with data URL output,
      controller delegation to guarded QR service method
    ]
key-files:
  created: [tests/boxes/box-qr.spec.ts]
  modified:
    [
      src/config/env.schema.ts,
      src/config/configuration.ts,
      .env.example,
      .env.docker.example,
      src/boxes/boxes.controller.ts,
      src/boxes/boxes.service.ts,
      package.json,
      package-lock.json
    ]
key-decisions:
  - "QR payload remains a plain canonical URL: {publicBaseUrl}/boxes/{boxCode}/scan."
  - "QR image output is returned as PNG data URL via QRCode.toDataURL."
  - "QR endpoint is protected with existing SessionAuthGuard + PermissionsGuard and boxes:read."
patterns-established:
  - "Public base URL normalization happens in config, then services compose deterministic routes."
  - "Box QR endpoint response contract is stable: { boxId, boxCode, payloadUrl, qrDataUrl }."
requirements-completed: [BOX-05]
duration: 24min
completed: 2026-03-19
---

# Phase 04 Plan 03: Deterministic Box QR Generation Summary

**Box QR generation now returns deterministic canonical scan URLs and PNG QR data for each box code through a guarded API endpoint.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-03-19T19:01:00Z
- **Completed:** 2026-03-19T19:24:29Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Added required `APP_PUBLIC_BASE_URL` env validation and normalized config exposure as `publicBaseUrl`.
- Implemented `GET /boxes/:boxCode/qr` and `BoxesService.getBoxQr` with canonical payload path `/boxes/{boxCode}/scan`.
- Added `tests/boxes/box-qr.spec.ts` to validate payload contract, unique QR output, endpoint behavior, and not-found handling.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add public base URL config contract for deterministic QR payloads**
- `cfddbef` (test): failing config RED tests
- `1e5793f` (feat): config + env contract implementation

2. **Task 2: Expose guarded box QR endpoint with unique payload/image output**
- `99fc407` (test): failing QR generation/endpoint RED tests
- `584f88a` (feat): QR endpoint + service implementation

Additional auto-fix commit:
- `4c6dd07` (fix): add missing `@types/qrcode` for TypeScript build

## Files Created/Modified
- `tests/boxes/box-qr.spec.ts` - config and QR contract tests (service + endpoint).
- `src/config/env.schema.ts` - required `APP_PUBLIC_BASE_URL` validation.
- `src/config/configuration.ts` - exposes normalized `publicBaseUrl` in `AppConfig`.
- `.env.example` - local QR base URL example.
- `.env.docker.example` - docker QR base URL example.
- `src/boxes/boxes.controller.ts` - guarded `@Get(':boxCode/qr')` endpoint.
- `src/boxes/boxes.service.ts` - `getBoxQr` payload construction and QR data generation.
- `package.json` - added `qrcode` + `@types/qrcode`.
- `package-lock.json` - dependency lock updates.

## Decisions Made
- Reused existing `boxCode` normalization and case-insensitive lookup for QR generation.
- Kept payload URL plain and canonical (`/boxes/{boxCode}/scan`) per locked phase decision.
- Returned QR image as data URL from backend to keep frontend integration simple and deterministic.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing qrcode type declarations**
- **Found during:** Task 2 final verification (`npm run build`)
- **Issue:** TypeScript build failed with `TS7016` because `qrcode` declarations were missing.
- **Fix:** Installed `@types/qrcode` as dev dependency.
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** `npm run build` and `npm run test -- tests/boxes/box-qr.spec.ts --runInBand` both pass.
- **Committed in:** `4c6dd07`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for successful build verification; no scope creep.

## Issues Encountered
- `npm install` inside sandbox failed with `EACCES` for registry/cache access; resolved by approved escalated install commands.
- `git` was not on shell PATH; execution used `C:\Program Files\Git\cmd\git.exe` directly for all commits.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- BOX-05 contract is complete and verified for deterministic payload + QR output.
- Phase 04-04 can build on this endpoint and payload format for scan-driven box workflow.

## Self-Check: PASSED
- FOUND: `.planning/phases/04-box-automation-and-qr-flow/04-03-SUMMARY.md`
- FOUND commit: `cfddbef`
- FOUND commit: `1e5793f`
- FOUND commit: `99fc407`
- FOUND commit: `584f88a`
- FOUND commit: `4c6dd07`

---
*Phase: 04-box-automation-and-qr-flow*
*Completed: 2026-03-19*
