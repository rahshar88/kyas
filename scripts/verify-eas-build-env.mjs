#!/usr/bin/env node
/**
 * Resolves the Expo config exactly as an EAS build server would, for every buildable profile.
 *
 * `verify-eas-config.mjs` checks the profile's variables against the schema. This goes one
 * step further and actually runs `expo config`, which is what the build server's "Read app
 * config" phase does — so it catches anything the schema cannot see: a config plugin that
 * throws, a bad `updates` block, a module that fails to resolve under the profile's
 * environment.
 *
 * The fidelity comes from two things:
 *
 *   1. `KYASCENE_IGNORE_DOTENV=1` — a build server has no `.env` (it is gitignored, so it is
 *      not in the archive EAS uploads). Without this, a developer's local `.env` fills the
 *      gaps and the check passes on a profile that cannot possibly build.
 *   2. Every inherited `EXPO_PUBLIC_*` is stripped from the child process, so the profile's
 *      own `env` block is the entire environment — again, as on the server.
 *
 * Usage:
 *   node scripts/verify-eas-build-env.mjs                  every profile with a complete env
 *   node scripts/verify-eas-build-env.mjs --profile beta   that profile only, must succeed
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MOBILE = resolve(HERE, '..', 'apps', 'mobile');
const eas = JSON.parse(readFileSync(resolve(MOBILE, 'eas.json'), 'utf8'));

const BUILDABLE = ['development', 'preview', 'beta', 'production'];

const argProfile = process.argv.includes('--profile')
  ? process.argv[process.argv.indexOf('--profile') + 1]
  : undefined;

if (argProfile !== undefined && !BUILDABLE.includes(argProfile)) {
  console.error(`unknown profile "${argProfile}" — expected one of ${BUILDABLE.join(', ')}`);
  process.exit(2);
}

/** Resolves a profile's `env` through its `extends` chain, the way EAS merges it. */
function resolveEnv(name, seen = new Set()) {
  const profile = eas.build?.[name];
  if (profile === undefined || seen.has(name)) return {};
  seen.add(name);
  const inherited = profile.extends ? resolveEnv(profile.extends, seen) : {};
  return { ...inherited, ...(profile.env ?? {}) };
}

const targets = argProfile ? [argProfile] : BUILDABLE;
const failures = [];
let verified = 0;

for (const profile of targets) {
  const profileEnv = resolveEnv(profile);

  // A profile with nothing but the environment name is one we know is not configured yet;
  // verify-eas-config.mjs reports that. Skip it here unless it was asked for by name.
  if (argProfile === undefined && Object.keys(profileEnv).length <= 1) {
    console.log(`  … skipping "${profile}" — environment not configured yet`);
    continue;
  }

  const childEnv = { ...process.env, KYASCENE_IGNORE_DOTENV: '1', EXPO_NO_DOTENV: '1' };
  for (const key of Object.keys(childEnv)) {
    if (key.startsWith('EXPO_PUBLIC_')) delete childEnv[key];
  }
  Object.assign(childEnv, profileEnv);

  try {
    const output = execFileSync('npx', ['expo', 'config', '--type', 'public', '--json'], {
      cwd: MOBILE,
      env: childEnv,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const config = JSON.parse(output);

    if (config.extra?.environment !== profileEnv.EXPO_PUBLIC_ENVIRONMENT) {
      failures.push(
        `"${profile}" resolved to environment "${config.extra?.environment}", ` +
          `expected "${profileEnv.EXPO_PUBLIC_ENVIRONMENT}"`,
      );
      continue;
    }

    verified += 1;
    console.log(`  ✔ "${profile}" reads its config on a clean checkout (${config.name})`);
  } catch (error) {
    const detail = [error.stderr, error.stdout].filter(Boolean).join('\n').trim();
    failures.push(`"${profile}" cannot read its app config:\n${detail || error.message}`);
  }
}

if (failures.length > 0) {
  console.error('\n✖ EAS build environment verification failed\n');
  for (const failure of failures) console.error(`  - ${failure}\n`);
  console.error(
    "A build server has no .env — the profile's own env block in apps/mobile/eas.json\n" +
      'is the entire environment. Add the missing publishable values there.\n',
  );
  process.exit(1);
}

console.log(`✔ ${verified} EAS build profile(s) resolve their config on a clean checkout`);
