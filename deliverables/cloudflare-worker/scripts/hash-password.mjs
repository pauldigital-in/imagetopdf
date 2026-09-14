#!/usr/bin/env node
/**
 * Generate a PBKDF2 password hash + salt for the Admin login.
 *
 * Usage:
 *   node scripts/hash-password.mjs "YourStrongPassword"
 *
 * Then set the printed values as Cloudflare secrets:
 *   npx wrangler secret put ADMIN_PASSWORD_HASH
 *   npx wrangler secret put ADMIN_PASSWORD_SALT
 *   npx wrangler secret put ADMIN_SESSION_SECRET   (a long random string)
 *   npx wrangler secret put ADMIN_EMAIL            (your login email)
 *
 * This keeps your password OUT of source code, the app, and GitHub.
 */
import { webcrypto as crypto } from "node:crypto";

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "YourStrongPassword"');
  process.exit(1);
}

const enc = new TextEncoder();
const saltBytes = crypto.getRandomValues(new Uint8Array(16));
const saltHex = [...saltBytes].map((b) => b.toString(16).padStart(2, "0")).join("");

const keyMaterial = await crypto.subtle.importKey(
  "raw",
  enc.encode(password),
  { name: "PBKDF2" },
  false,
  ["deriveBits"],
);
const bits = await crypto.subtle.deriveBits(
  { name: "PBKDF2", salt: saltBytes, iterations: 100000, hash: "SHA-256" },
  keyMaterial,
  256,
);
const hashHex = [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");

const sessionSecret = [...crypto.getRandomValues(new Uint8Array(32))]
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");

console.log("\nSet these as Cloudflare Worker secrets:\n");
console.log("ADMIN_PASSWORD_HASH  =", hashHex);
console.log("ADMIN_PASSWORD_SALT  =", saltHex);
console.log("ADMIN_SESSION_SECRET =", sessionSecret, "(or supply your own long random string)");
console.log("\nRemember to also set ADMIN_EMAIL to your login email.\n");
