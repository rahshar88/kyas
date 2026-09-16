#!/usr/bin/env node
/**
 * Proves an over-the-air update actually carries its configuration, by looking in the bundle.
 *
 * ## The failure this exists for
 *
 * `apps/mobile/src/config/env.ts` ends with `export const env = parseEnv(rawEnv)` at module
 * scope, and `app/_layout.tsx` imports it before the first render. That is deliberate: a
 * misconfigured **build** fails at EAS's "Read app config" phase with the missing keys named,
 * which is how a whole class of problem was caught in August.
 *
 * An **update** has no such phase. Nothing reads the config; the bundle is transformed,
 * uploaded, and the throw lands on a phone as a process that dies before drawing anything. The
 * same defence, on a path with no check in front of it, becomes a crash with no message.
 *
 * It stayed invisible because every update before 14 August was published for a runtime version
 * no installed binary had, so none was ever delivered. The first one that reached a device
 * closed the app instantly.
 *
 * ## Why this greps the bundle rather than checking the environment
 *
 * `babel-preset-expo` inlines `process.env.EXPO_PUBLIC_X` at transform time. So the only
 * question that matters is whether the value ended up **in the JavaScript** — not whether some
 * tool believes the variable was set.
 *
 * Those are different questions, and this check found out how different. Exporting with CI
 * placeholder values and then again with the real ones produced a second bundle still
 * containing `https://ci-placeholder.supabase.co`: Metro caches transformed modules, and a
 * transform holds whatever the environment was when it ran. Every tool involved reported
 * success. `--clear` below is not tidiness — without it this verifier would check a cache
 * rather than a bundle.
 *
 * Usage: node scripts/verify-update-bundle.mjs [--profile preview]
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const MOBILE = resolve(ROOT, 'apps', 'mobile');

const arg = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
};

const profileName = arg('--profile', 'preview');
const eas = JSON.parse(readFileSync(resolve(MOBILE, 'eas.json'), 'utf8'));

function resolveEnv(name, seen = new Set()) {
  const profile = eas.build?.[name];
  if (profile === undefined || seen.has(name)) return {};
  seen.add(name);
  return { ...(profile.extends ? resolveEnv(profile.extends, seen) : {}), ...(profile.env ?? {}) };
}

const profileEnv = resolveEnv(profileName);

/**
 * The values whose absence is fatal at launch, because `parseEnv` requires them in every
 * environment. The optional ones — Sentry, analytics — are absent by design in development and
 * asserting them would fail for the wrong reason.
 */
const MUST_BE_INLINED = [
  'EXPO_PUBLIC_ENVIRONMENT',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
];

const missingFromProfile = MUST_BE_INLINED.filter((key) => !profileEnv[key]);
if (missingFromProfile.length > 0) {
  console.error(`✖ the "${profileName}" profile does not define: ${missingFromProfile.join(', ')}`);
  process.exit(1);
}

const outputDir = mkdtempSync(join(tmpdir(), 'kyascene-update-'));

console.log(`→ exporting the ${profileName} bundle to check its configuration survived`);

/**
 * `EXPO_NO_DOTENV` is not used here on purpose — see `app.config.ts`. The loader keys on
 * KYASCENE_IGNORE_DOTENV instead, because EAS CLI sets EXPO_NO_DOTENV itself.
 *
 * A local `.env` is deliberately ignored: it exists on a developer machine and not on anyone
 * else's, so a bundle that only works because of it is a bundle that works only here.
 */
const result = spawnSync(
  'npx',
  ['--yes', 'expo', 'export', '--platform', 'ios', '--clear', '--output-dir', outputDir],
  {
    cwd: MOBILE,
    encoding: 'utf8',
    env: { ...process.env, ...profileEnv, KYASCENE_IGNORE_DOTENV: '1' },
  },
);

if (result.status !== 0) {
  console.error('✖ the bundle could not be exported, so it must not be published\n');
  console.error(result.stderr || result.stdout);
  rmSync(outputDir, { recursive: true, force: true });
  process.exit(1);
}

/** Every JavaScript artefact the export produced, whatever Metro chose to name it. */
function bundleFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...bundleFiles(path));
    } else if (/\.(js|hbc)$/.test(entry)) {
      found.push(path);
    }
  }
  return found;
}

const files = bundleFiles(outputDir);
if (files.length === 0) {
  console.error('✖ the export produced no JavaScript at all');
  rmSync(outputDir, { recursive: true, force: true });
  process.exit(1);
}

const contents = files.map((file) => readFileSync(file, 'latin1')).join('\n');
const failures = [];

for (const key of MUST_BE_INLINED) {
  const value = profileEnv[key];
  if (!contents.includes(value)) {
    failures.push(`${key} — "${value}" is not in the bundle`);
  }
}

rmSync(outputDir, { recursive: true, force: true });

if (failures.length > 0) {
  console.error('✖ this update would close the app on launch\n');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(
    '\n  env.ts calls parseEnv at module scope and _layout.tsx imports it before the first\n' +
      '  render, so a missing value throws before anything can be drawn. On a build EAS\n' +
      '  reports this at "Read app config"; an update has no such phase, which is why this\n' +
      '  check exists.',
  );
  process.exit(1);
}

console.log(
  `✔ update bundle carries its configuration (${MUST_BE_INLINED.length} values, ${files.length} file(s))`,
);
