# Changelog

## V0.4 — 2026-09-04

- Replaced the primary editing surface with a zoomable/pannable `WorkspaceCanvas`.
- Added continuous brush painting, eraser, eyedropper and pan tools.
- Added grid toggle, hover coordinates and zoom controls.
- Added up to 60-step undo/redo history and keyboard shortcuts.
- Debounced project and inventory persistence to avoid excessive localStorage writes while painting.
- Added inventory settlement when a project reaches 100% construction progress.
- Added reversible inventory settlement: restore consumed beads and unlock the project.
- Locked settled projects against design/progress edits to prevent inventory drift.
- Fixed duplicated settled projects incorrectly inheriting the inventory-deducted flag.
- Added TypeScript-based core test compilation and inventory settlement regression tests.
- Removed old standalone/preview artifacts from the long-term repository layout.
- Fixed packaging CI by committing the core test harness and upgrading GitHub Actions runtime to Node 24 (`checkout/setup-node/upload-artifact` v7).

## V0.3 — 2026-09-04

- Added multi-project local library.
- Added per-project construction progress.
- Added color-focus construction workflow.
- Added purchase-plan calculation and CSV export.
- Added balanced inventory optimization with configurable maximum ΔE.
- Added missing-bead candidate detection.
- Added one-click sync from photo-inspection correct cells to construction progress.
- Added automatic RGB lighting gain calibration for photo inspection.
- Added PWA manifest and service worker.
- Added V0.2 localStorage migration.

## V0.2

- React/TypeScript project skeleton.
- MARD 221 palette.
- Zero-purchase inventory constrained recoloring.
- Manual four-corner photo rectification and color inspection.
- Experimental backlight ironing inspection.
