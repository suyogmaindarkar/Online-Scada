# SVG Library Phase 2 — Integration Hardening

## Scope

Phase 2 makes the original industrial SVG library safe to insert, save, reload,
and render without losing library identity or dynamic bindings.

The active library version is `industrial-original-v2`. Legacy SVG paths remain
available on disk for existing saved screens, but legacy entries are not shown
in the Component Library.

## Persisted SVG element contract

An element inserted from the Component Library has the following core fields:

```js
{
  type: 'svgSymbol',
  id: 'generated-element-id',
  symbolId: 'pump_inline_original',
  libraryVersion: 'industrial-original-v2',
  objectName: 'Inline Pump',
  svgPath: '/symbols/industrial/inline-pump.svg',
  width: 130,
  height: 90,
  symbolTint: null,
  symbolTintStrength: 1,
  symbolBrightness: 1,
  preserveAspect: true,
  boundTag: null,
  tooltip: '',
  isVisible: true
}
```

Unknown fields and nested `dynamicBindings` are preserved by the screen
serialization seams. Older elements without `symbolId` or `libraryVersion`
remain valid and are treated as legacy objects by the Object Properties panel.

## Persistence seams

`frontend/src/utils/svgLibraryPersistence.js` owns the small transformations
used by the Designer:

- `createLibraryElement` creates an element from a library template.
- `serializeScreenElements` preserves element fields for create/update payloads.
- `restoreScreenElements` restores saved elements without reconstructing them
  from the current library.

This means saved screens continue to render from their persisted `svgPath`, even
if the active library later changes categories or hides a legacy entry.

## Verification

Run from `frontend/`:

```text
node --test test/phase1Library.test.mjs test/phase2SvgPersistence.test.mjs test/equipmentState.test.mjs
npm run build
```

Run from `backend/` to verify the server-side screen sanitizer:

```text
npm test
```

The Phase 2 tests cover:

- Add-from-library identity and placement.
- Save payload preservation of `symbolId`, `libraryVersion`, and `svgPath`.
- Preservation of nested dynamic bindings.
- Reload of current and legacy SVG elements.
- Legacy elements that do not contain new library metadata.
- Safe empty/invalid persistence inputs.
- Backend sanitizer retention of SVG metadata and nested bindings.
