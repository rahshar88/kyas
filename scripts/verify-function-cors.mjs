#!/usr/bin/env node
/**
 * Every Edge Function must answer a browser's preflight.
 *
 * The mobile app is not a browser, so it never sends one — these functions ran for two
 * milestones without CORS and nothing noticed. The admin console is the first browser client,
 * and a POST carrying `Authorization` triggers an `OPTIONS` preflight. Answering it with a 400
 * and no CORS headers made Chrome block the real request before sending it, so a deployed,
 * working function reported as "did not answer". Nothing in the stack says "CORS" when that
 * happens.
 *
 * A static check rather than a test, because the failure is an omission: a new function is
 * written by copying an existing one, and the copy is only correct if the original was.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const FUNCTIONS = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'functions');

const failures = [];
let checked = 0;

for (const entry of readdirSync(FUNCTIONS, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith('_')) continue;

  const source = readFileSync(join(FUNCTIONS, entry.name, 'index.ts'), 'utf8');
  checked += 1;

  if (!source.includes('preflight(request)')) {
    failures.push(`${entry.name} does not answer the CORS preflight`);
    continue;
  }

  // It must come before the method check, or the OPTIONS request is rejected as "not POST".
  if (source.indexOf('preflight(request)') > source.indexOf("request.method !== 'POST'")) {
    failures.push(`${entry.name} checks the method before answering the preflight`);
  }
}

if (failures.length > 0) {
  console.error('\n✖ Edge Function CORS verification failed\n');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error('\nAdd: const p = preflight(request); if (p) return p;  — before anything else.\n');
  process.exit(1);
}

console.log(`✔ ${checked} Edge Function(s) answer the CORS preflight`);
