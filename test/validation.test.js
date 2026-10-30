const test = require('node:test');
const assert = require('node:assert/strict');
const { isValidEmail, isValidPassword, normalizeEmail } = require('../src/validation');

test('normalizes email before storing or searching', () => {
  assert.equal(normalizeEmail('  User@Example.com  '), 'user@example.com');
  assert.equal(normalizeEmail(undefined), '');
});

test('accepts a well-formed email and rejects malformed values', () => {
  assert.equal(isValidEmail('user@example.com'), true);
  assert.equal(isValidEmail('user@localhost'), false);
  assert.equal(isValidEmail('x'.repeat(250) + '@example.com'), false);
});

test('requires a strong password between 10 and 128 characters', () => {
  assert.equal(isValidPassword('StrongPass123'), true);
  assert.equal(isValidPassword('weakpass123'), false);
  assert.equal(isValidPassword('Short1A'), false);
  assert.equal(isValidPassword('A1a'.padEnd(129, 'x')), false);
});