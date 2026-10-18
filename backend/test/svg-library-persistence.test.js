const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeElements } = require('../src/controllers/screenController');

test('screen sanitizer preserves current SVG library metadata and nested bindings', () => {
  const [element] = sanitizeElements([{
    type: 'svgSymbol',
    id: 'el_pump',
    symbolId: 'pump_inline_original',
    libraryVersion: 'industrial-original-v2',
    svgPath: '/symbols/industrial/inline-pump.svg',
    objectName: 'Inline Pump',
    symbolTint: '#2c5',
    dynamicBindings: {
      symbolTint: { mode: 'direct', tag: 'Pump.Color' },
      tooltip: { mode: 'direct', tag: 'Pump.Tooltip' },
    },
  }]);

  assert.equal(element.symbolId, 'pump_inline_original');
  assert.equal(element.libraryVersion, 'industrial-original-v2');
  assert.equal(element.svgPath, '/symbols/industrial/inline-pump.svg');
  assert.equal(element.objectName, 'Inline Pump');
  assert.equal(element.symbolTint, '#22cc55');
  assert.equal(element.dynamicBindings.symbolTint.tag, 'Pump.Color');
  assert.equal(element.dynamicBindings.tooltip.tag, 'Pump.Tooltip');
});

test('screen sanitizer preserves legacy SVG paths without adding new metadata', () => {
  const [element] = sanitizeElements([{
    type: 'svgSymbol',
    id: 'legacy_motor',
    svgPath: '/symbols/motors/motor-b3.svg',
    width: 100,
    height: 100,
  }]);

  assert.equal(element.svgPath, '/symbols/motors/motor-b3.svg');
  assert.equal(element.symbolId, undefined);
  assert.equal(element.libraryVersion, undefined);
});
