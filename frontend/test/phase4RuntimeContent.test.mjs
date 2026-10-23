import test from 'node:test';
import assert from 'node:assert/strict';
import { getAuthoredOptions, getRuntimeElements } from '../src/utils/runtimeContentPolicy.js';

test('runtime renders only elements persisted on the selected screen', () => {
  const screen = {
    elements: [{ id: 'authored-1', type: 'rectangle' }],
    templateElements: [{ id: 'template-1', type: 'statusDisplay' }],
  };

  assert.deepEqual(getRuntimeElements(screen), screen.elements);
  assert.deepEqual(getRuntimeElements({ elements: [] }), []);
  assert.deepEqual(getRuntimeElements({}), []);
});

test('runtime list content contains only authored options', () => {
  assert.deepEqual(getAuthoredOptions([
    { label: 'Run', value: 1 },
    null,
    { value: 2 },
    { label: 'Stop', value: 0 },
  ]), [
    { label: 'Run', value: 1 },
    { label: 'Stop', value: 0 },
  ]);
  assert.deepEqual(getAuthoredOptions([]), []);
  assert.deepEqual(getAuthoredOptions(undefined), []);
});
