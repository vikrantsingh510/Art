import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  artworkPhysicalSizeMetres,
  normalizeDimensionUnit,
  parsePositiveDimension,
  toMetres,
} from '../src/utils/dimensions.js';

test('dimension units normalize and convert to metres', () => {
  assert.equal(normalizeDimensionUnit('CM'), 'cm');
  assert.equal(normalizeDimensionUnit('inches'), 'in');
  assert.equal(normalizeDimensionUnit('yard'), null);
  assert.equal(parsePositiveDimension(0), null);
  assert.equal(parsePositiveDimension(-3), null);
  assert.equal(toMetres(100, 'cm'), 1);
  assert.equal(Number(toMetres(12, 'in').toFixed(4)), 0.3048);
});

test('artwork physical size requires positive width and height', () => {
  assert.equal(artworkPhysicalSizeMetres({ width: 80, height: 60, dimensionUnit: 'cm' }).widthM, 0.8);
  assert.equal(artworkPhysicalSizeMetres({ width: 80, height: null, dimensionUnit: 'cm' }), null);
  assert.equal(artworkPhysicalSizeMetres({ width: 80, height: 60 }).heightM, 0.6);
});
