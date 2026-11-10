import assert from 'node:assert/strict';
import test from 'node:test';
import { formatInrFromPaise, paiseToRupees, rupeesToPaise } from '../lib/money.js';

test('converts paise to rupees without floating leftovers for salon prices', () => {
  assert.equal(paiseToRupees(42000000), 420000);
  assert.equal(rupeesToPaise(420000), 42000000);
  assert.equal(rupeesToPaise('185000.5'), 18500050);
});

test('formats INR from paise using the Indian grouping', () => {
  const formatted = formatInrFromPaise(42000000);
  assert.match(formatted, /4,20,000/);
});
