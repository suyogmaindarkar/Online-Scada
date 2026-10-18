import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LIBRARY_VERSION,
  LIBRARY_CATEGORIES,
  LIBRARY_COMPONENTS,
  getCategoryStats,
  getComponentById,
  searchComponents,
} from '../src/config/componentLibrary.js';
import { getElementSpecificProperties } from '../src/config/elementProperties.js';
import { resolveElementBindings } from '../src/utils/bindingUtils.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.resolve(here, '../public');

test('original industrial library has screenshot-inspired categories and valid assets', () => {
  assert.equal(LIBRARY_VERSION, 'industrial-original-v2');
  for (const category of ['general', 'buildings', 'process', 'piping', 'valves', 'instrumentation', 'controls', 'signal_lamps', 'safety', 'electrical']) {
    assert.ok(LIBRARY_CATEGORIES.some((item) => item.id === category), `missing category ${category}`);
  }
  const stats = Object.fromEntries(getCategoryStats().map((item) => [item.id, item.count]));
  assert.equal(stats.general, 2);
  assert.equal(stats.process, 4);
  assert.equal(stats.instrumentation, 4);
  assert.equal(searchComponents('process boundary')[0].id, 'general_process_boundary');
  assert.equal(searchComponents('magnetic flow')[0].id, 'instrumentation_flow_meter');
  assert.equal(getComponentById('motor_b3'), null, 'legacy motor entries should not be visible in the new library');
  assert.equal(getComponentById('valve_gate'), null, 'legacy valve entries should not be visible in the new library');
  assert.equal(new Set(LIBRARY_COMPONENTS.map((component) => component.id)).size, LIBRARY_COMPONENTS.length, 'component IDs must be unique');
  for (const component of LIBRARY_COMPONENTS) {
    assert.ok(component.template?.svgPath, `${component.id} has no SVG template`);
    assert.equal(component.template.type, 'svgSymbol', `${component.id} is not an SVG symbol`);
    assert.equal(component.template.libraryVersion, LIBRARY_VERSION, `${component.id} has no library version`);
    assert.equal(component.template.symbolId, component.id, `${component.id} has no stable symbol identity`);
    assert.equal(component.template.objectName, component.name, `${component.id} has no common object name`);
    assert.equal(component.template.boundTag, null, `${component.id} has an unexpected default tag binding`);
    assert.equal(component.template.tooltip, '', `${component.id} has an unexpected default tooltip`);
    assert.equal(component.template.isVisible, true, `${component.id} should be visible by default`);
    const assetPath = path.join(publicRoot, component.template.svgPath.replace(/^\//, ''));
    assert.ok(fs.existsSync(assetPath), `${component.id} SVG is missing`);
    const svg = fs.readFileSync(assetPath, 'utf8');
    assert.match(svg, /^\s*<svg\b/i, `${component.id} asset is not an SVG document`);
    assert.match(svg, /viewBox\s*=\s*["'][^"']+["']/i, `${component.id} asset has no viewBox`);
  }
});

test('SVG object properties expose the persisted binding and presentation controls', () => {
  const keys = getElementSpecificProperties('svgSymbol', {}).map((property) => property.key);
  for (const key of ['symbolId', 'libraryVersion', 'svgPath', 'symbolTint', 'symbolTintStrength', 'symbolBrightness', 'preserveAspect', 'boundTag', 'tooltip', 'isVisible']) {
    assert.ok(keys.includes(key), `missing SVG property ${key}`);
  }
});

test('SVG runtime bindings resolve common presentation properties before rendering', () => {
  const resolved = resolveElementBindings({
    type: 'svgSymbol',
    svgPath: '/symbols/industrial/inline-pump.svg',
    dynamicBindings: {
      symbolTint: { mode: 'direct', tag: 'Pump.Color' },
      symbolTintStrength: { mode: 'direct', tag: 'Pump.TintStrength' },
      symbolBrightness: { mode: 'direct', tag: 'Pump.Brightness' },
      tooltip: { mode: 'direct', tag: 'Pump.Tooltip' },
      isVisible: { mode: 'boolMap', tag: 'Pump.Enabled', trueValue: 'Yes', falseValue: 'No' },
    },
  }, {
    'Pump.Color': '#22c55e',
    'Pump.TintStrength': 0.6,
    'Pump.Brightness': 1.2,
    'Pump.Tooltip': 'P-101 | Running',
    'Pump.Enabled': true,
  });

  assert.equal(resolved.symbolTint, '#22c55e');
  assert.equal(resolved.symbolTintStrength, 0.6);
  assert.equal(resolved.symbolBrightness, 1.2);
  assert.equal(resolved.tooltip, 'P-101 | Running');
  assert.equal(resolved.isVisible, 'Yes');
});
