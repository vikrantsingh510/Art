import assert from 'node:assert/strict';
import test from 'node:test';
import { pendingButtonProps } from '../lib/pending-action.js';

test('pending buttons disable and announce busy state', () => {
  assert.deepEqual(pendingButtonProps(true), { disabled: true, 'aria-busy': true });
  assert.deepEqual(pendingButtonProps(false), { disabled: false, 'aria-busy': false });
  assert.deepEqual(pendingButtonProps(''), { disabled: false, 'aria-busy': false });
  assert.deepEqual(pendingButtonProps('remove'), { disabled: true, 'aria-busy': true });
});
