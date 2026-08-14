#!/usr/bin/env node
/**
 * Ships an over-the-air update whose configuration matches the build it lands on.
 *
 * ## The bug this exists to make impossible
 *
 * `eas build --profile preview` reads the `env` block of the `preview` profile in `eas.json`.
 * `eas update` does not. Build profiles are a build concept; an update is bundled from
 * whatever `process.env` and `.env` the machine running it happens to have.
 *
 * So a correct build could be silently downgraded by the next update. `.env` is gitignored,
 * which is what makes this so quiet: the file differs per machine by design, nobody reviews
 * it, and a stale project URL in it fails at DNS — which surfaces in the app as
 * "Network request failed", classified as NETWORK_UNAVAILABLE, and shown to a tester as
 * "We couldn't reach KyaScene". A configuration mistake wearing a connectivity error's
 * clothes, for a server that was answering fine the whole time. It cost most of a day.
 *
 * The fix is to give both commands one source of truth. This resolves the build profile's
 * env exactly as EAS merges it — `extends` chain included — and injects it into the child
 * process, which Metro's transformer then inlines.
 *
 * ## And why it clears the cache
 *
 * `babel-preset-expo` inlines `process.env.EXPO_PUBLIC_*` **at transform time**, and Metro
 * caches transformed modules. Change a variable without clearing that cache and the next
 * bundle keeps the previous value — silently, with no warning anywhere.
 *
 * That is not theoretical. Exporting this app with CI placeholder values and then again with
 * the real ones produced a second bundle still containing
 * `https://ci-placeholder.supabase.co`. A bundle can therefore be published pointing at a
 * project that does not exist, or missing a value entirely — and a missing one throws at
 * launch, because `env.ts` validates at module scope. `--clear-cache` costs about a minute
 * and removes the whole class.
 *
 * A conflict is still reported, because a `.env` disagreeing with `eas.json` means somebody's
 * mental model is wrong even when the outcome is now correct.
 *
 * Usage: node scripts/eas-update.mjs [--profile preview] [--branch preview]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MOBILE = resolve(HERE, '..', 'apps', 'mobile');

const arg = (flag, fallback) => {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
};

const profileName = arg('--profile', 'preview');
const eas = JSON.parse(readFileSync(resolve(MOBILE, 'eas.json'), 'utf8'));

/** The branch an update is published to must be the channel the build subscribes to. */
const channel = eas.build?.[profileName]?.channel;
if (channel === undefined) {
  console.error(`✖ build profile "${profileName}" has no channel in eas.json.`);
  process.exit(1);
}
const branch = arg('--branch', channel);

function resolveEnv(name, seen = new Set()) {
  const profile = eas.build?.[name];
  if (profile === undefined || seen.has(name)) return {};
  seen.add(name);
  return { ...(profile.extends ? resolveEnv(profile.extends, seen) : {}), ...(profile.env ?? {}) };
}

const profileEnv = resolveEnv(profileName);
if (Object.keys(profileEnv).length === 0) {
  console.error(`✖ build profile "${profileName}" resolves to an empty env.`);
  process.exit(1);
}

/**
 * Report where `.env` disagrees, without printing values — one of these variables is a
 * publishable key today, but this file should not be the reason a future one leaks into a
 * terminal transcript or a screenshot.
 */
const dotEnvPath = resolve(MOBILE, '.env');
if (existsSync(dotEnvPath)) {
  const local = Object.fromEntries(
    readFileSync(dotEnvPath, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .map((line) => {
        const at = line.indexOf('=');
        return [
          line.slice(0, at).trim(),
          line
            .slice(at + 1)
            .trim()
            .replace(/^["']|["']$/g, ''),
        ];
      }),
  );

  const conflicts = Object.keys(profileEnv).filter(
    (key) => local[key] !== undefined && local[key] !== profileEnv[key],
  );

  if (conflicts.length > 0) {
    console.warn(
      `! apps/mobile/.env disagrees with the "${profileName}" profile on: ${conflicts.join(', ')}`,
    );
    console.warn('  eas.json wins, so this update matches the build. Worth reconciling.');
  }
}

/**
 * The commit subject, so the update list in the Expo dashboard reads as a history. It was
 * previously a string hard-coded in package.json, which meant every update after the first
 * was labelled with the name of an unrelated old fix.
 */
const subject =
  arg('--message', undefined) ??
  spawnSync('git', ['log', '-1', '--pretty=%s'], { encoding: 'utf8' }).stdout.trim() ??
  'update';

console.log(`→ ${profileName} → branch "${branch}" with env from eas.json`);
for (const key of Object.keys(profileEnv).sort()) console.log(`    ${key}`);
console.log('  (clearing the Metro cache — a stale transform keeps the previous env values)');

const result = spawnSync(
  'npx',
  [
    'eas-cli@latest',
    'update',
    '--clear-cache',
    '--branch',
    branch,
    '--environment',
    profileEnv.EXPO_PUBLIC_ENVIRONMENT ?? 'development',
    '--message',
    subject,
  ],
  { cwd: MOBILE, stdio: 'inherit', env: { ...process.env, ...profileEnv } },
);

process.exit(result.status ?? 1);
