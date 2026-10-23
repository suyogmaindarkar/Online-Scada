import test from 'node:test';
import assert from 'node:assert/strict';
import { getComponentById, LIBRARY_VERSION } from '../src/config/componentLibrary.js';
import {
  createLibraryElement,
  restoreScreenElements,
  serializeScreenElements,
  serializeDirectConnections,
} from '../src/utils/svgLibraryPersistence.js';

test('Phase 2 add-from-library preserves SVG identity and placement metadata', () => {
  const component = getComponentById('pump_inline_original');
  const element = createLibraryElement(component, { id: 'el_test_pump', x: 240, y: 180 });

  assert.equal(element.type, 'svgSymbol');
  assert.equal(element.id, 'el_test_pump');
  assert.equal(element.x, 240);
  assert.equal(element.y, 180);
  assert.equal(element.symbolId, 'pump_inline_original');
  assert.equal(element.libraryVersion, LIBRARY_VERSION);
  assert.equal(element.svgPath, '/symbols/industrial/inline-pump.svg');
  assert.equal(element.objectName, 'Inline Pump');
});

test('Phase 2 screen serialization retains SVG metadata and nested bindings', () => {
  const original = {
    type: 'svgSymbol',
    id: 'legacy-or-new',
    svgPath: '/symbols/industrial/inline-pump.svg',
    symbolId: 'pump_inline_original',
    libraryVersion: LIBRARY_VERSION,
    dynamicBindings: {
      symbolTint: { mode: 'direct', tag: 'Pump.Color' },
    },
  };

  const serialized = serializeScreenElements([original]);
  assert.notEqual(serialized[0], original);
  assert.deepEqual(serialized[0], original);
  assert.equal(serialized[0].dynamicBindings.symbolTint.tag, 'Pump.Color');

  const restored = restoreScreenElements(serialized);
  assert.notEqual(restored[0], serialized[0]);
  assert.deepEqual(restored[0], original);
});

test('Phase 2 legacy SVG elements reload without requiring new library metadata', () => {
  const legacy = {
    type: 'svgSymbol',
    id: 'legacy-svg',
    svgPath: '/symbols/motors/motor-b3.svg',
    width: 100,
    height: 100,
  };

  const restored = restoreScreenElements([legacy]);
  assert.deepEqual(restored[0], legacy);
  assert.equal(restored[0].symbolId, undefined);
  assert.equal(restored[0].libraryVersion, undefined);
  assert.equal(restored[0].svgPath, '/symbols/motors/motor-b3.svg');
});

test('Phase 2 persistence seams fail safely for empty or invalid collections', () => {
  assert.equal(createLibraryElement(null, { id: 'missing' }), null);
  assert.deepEqual(serializeScreenElements(null), []);
  assert.deepEqual(restoreScreenElements(null), []);
  assert.deepEqual(restoreScreenElements([null, undefined]), []);
});

test('screen serialization removes non-JSON runtime values and circular references', () => {
  const element = { id: 'safe', width: Number.NaN, onClick: () => {}, nested: { value: 4 } };
  element.circular = element;

  assert.deepEqual(serializeScreenElements([element]), [
    { id: 'safe', width: 0, nested: { value: 4 } },
  ]);
  assert.deepEqual(serializeDirectConnections([{ source: 'A', target: undefined }]), [
    { source: 'A' },
  ]);
});
