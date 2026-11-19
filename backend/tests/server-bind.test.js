import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('API process listens on the validated PORT and 0.0.0.0', () => {
  const source = fs.readFileSync(path.join(backendRoot, 'src/server.js'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(backendRoot, 'package.json'), 'utf8'));
  assert.match(source, /app\.listen\(env\.PORT, '0\.0\.0\.0'/);
  assert.match(source, /port: env\.PORT/);
  assert.match(source, /Graceful shutdown started/);
  assert.doesNotMatch(source, /app\.listen\(env\.PORT, \(\)/);
  assert.equal(pkg.engines?.node, '24.x');
});
