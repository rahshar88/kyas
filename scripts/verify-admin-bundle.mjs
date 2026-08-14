#!/usr/bin/env node
/**
 * Proves the built admin console cannot escalate (spec §5.3, §13.1, §15.2).
 *
 * The console is a static bundle served to a browser, so anything inside it is readable by
 * anyone who opens it. It is allowed exactly one credential — the publishable key, which grants
 * nothing that Row Level Security does not already permit. A service-role key would bypass
 * every policy in the schema, and pasting one into `apps/admin/.env` is a single keystroke away
 * from being the worst mistake available in this repository.
 *
 * ## Why this is not a grep
 *
 * `supabase-js` contains the literal string `"sb_secret_"` in its own key-prefix detection:
 *
 *     i => i.startsWith("sb_publishable_") || i.startsWith("sb_secret_")
 *
 * A grep for that prefix therefore fails on a perfectly safe bundle, and a gate that cries
 * wolf gets switched off. This looks for a secret's *shape* — the prefix followed by actual key
 * material — and decodes any JWT it finds to read the role claim rather than pattern-matching
 * around it.
 *
 * Usage: pnpm run admin:build && node scripts/verify-admin-bundle.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'apps', 'admin', 'dist');

const failures = [];
const checks = [];

function check(name, condition, detail = '') {
  checks.push(name);
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

let files;
try {
  files = walk(DIST).filter((file) => /\.(js|html|css|json)$/.test(file));
} catch {
  console.error(`\n✖ ${DIST} does not exist. Run "pnpm run admin:build" first.\n`);
  process.exit(1);
}

check('the admin bundle was built', files.length > 0);

const sources = files.map((file) => ({ file, text: readFileSync(file, 'utf8') }));

/**
 * A Supabase secret key: the prefix followed by real key material. The library's own bare
 * `"sb_secret_"` literal has nothing after it and is correctly ignored.
 */
const SECRET_KEY = /sb_secret_[A-Za-z0-9_-]{8,}/;

for (const { file, text } of sources) {
  const match = SECRET_KEY.exec(text);
  check(
    `${shortName(file)} contains no Supabase secret key`,
    match === null,
    match === null ? '' : `found "${match[0].slice(0, 18)}…"`,
  );
}

/**
 * A service-role JWT. Older Supabase projects issue keys as JWTs whose payload names the role,
 * so the prefix check above would not see them at all — this decodes every JWT-shaped string
 * and reads the claim.
 */
const JWT = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;

for (const { file, text } of sources) {
  const offending = [];

  for (const token of text.match(JWT) ?? []) {
    const payload = token.split('.')[1];
    if (payload === undefined) continue;

    try {
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      if (decoded.role === 'service_role') offending.push(token.slice(0, 12));
    } catch {
      // Not a JWT after all — a hash or an identifier that happens to start with "eyJ".
    }
  }

  check(
    `${shortName(file)} contains no service-role JWT`,
    offending.length === 0,
    offending.join(', '),
  );
}

/**
 * The check that stops this whole script being theatre.
 *
 * If the bundle were built without an environment, it would contain no keys at all and every
 * assertion above would pass while proving nothing. Requiring the publishable key to be present
 * confirms the scanner is reading a real, configured build.
 */
const bundleText = sources.map(({ text }) => text).join('\n');

check(
  'the bundle carries a publishable key, so these checks are looking at a real build',
  /sb_publishable_[A-Za-z0-9_-]{8,}|eyJ/.test(bundleText),
  'built without an environment — the scan above would pass vacuously',
);

/** Named build-time secrets should never be referenced by a browser bundle at all. */
for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY', 'SUPABASE_SECRET']) {
  check(`no reference to ${name}`, !bundleText.includes(name));
}

function shortName(file) {
  return file.slice(DIST.length + 1);
}

if (failures.length > 0) {
  console.error('\n✖ admin bundle verification FAILED\n');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(
    '\nA browser bundle is public. A service-role key inside one bypasses every Row Level\n' +
      'Security policy in the schema for anyone who opens the page.\n',
  );
  process.exit(1);
}

console.log(`✔ admin bundle carries no privileged credential (${checks.length} checks)`);
