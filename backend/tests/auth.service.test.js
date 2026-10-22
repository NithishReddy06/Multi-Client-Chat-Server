import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgresql://placeholder:placeholder@localhost:5432/placeholder";
process.env.CLIENT_URL ??= "http://localhost:5173";

const {
  csrfTokenMatches,
  normalizeUsername,
  tokenFromCookieHeader,
  validatePassword,
  validateUsername,
} = await import("../services/auth.service.js");

test("username validation normalizes case and rejects malformed names", () => {
  assert.equal(normalizeUsername("  Alex_7 "), "alex_7");
  assert.equal(validateUsername("Alex_7"), null);
  assert.notEqual(validateUsername("ab"), null);
  assert.notEqual(validateUsername("invalid name"), null);
});

test("password validation enforces bcrypt's byte limit and minimum length", () => {
  assert.equal(validatePassword("long-enough-password"), null);
  assert.notEqual(validatePassword("short"), null);
  assert.notEqual(validatePassword("é".repeat(37)), null);
});

test("session cookie parsing and CSRF comparison reject invalid values", () => {
  assert.equal(tokenFromCookieHeader("other=x; chat_session=abc123"), "abc123");
  assert.equal(tokenFromCookieHeader("chat_session=%E0%A4%A"), null);
  assert.equal(csrfTokenMatches("csrf-secret", "csrf-secret"), true);
  assert.equal(csrfTokenMatches("csrf-secret", "wrong-secret"), false);
  assert.equal(csrfTokenMatches("csrf-secret", undefined), false);
});
