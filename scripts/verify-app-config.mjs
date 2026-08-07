#!/usr/bin/env node
/**
 * Asserts the resolved Expo config for a given environment matches spec §4.5 and §4.7.
 *
 * Runs before `expo prebuild`, so a wrong identifier is caught in a second rather than
 * after two native generations.
 *
 * Usage: node scripts/verify-app-config.mjs <config.json> <development|beta|production>
 */
import { readFileSync } from 'node:fs';

const [, , configPath, environment] = process.argv;

const EXPECTED = {
  development: { id: 'app.kyascene.beta', name: 'KyaScene Beta', links: false },
  beta: { id: 'app.kyascene.beta', name: 'KyaScene Beta', links: true },
  production: { id: 'app.kyascene', name: 'KyaScene', links: true },
};

if (!configPath || !Object.hasOwn(EXPECTED, environment)) {
  console.error(`usage: verify-app-config.mjs <config.json> <${Object.keys(EXPECTED).join('|')}>`);
  process.exit(2);
}

const expected = EXPECTED[environment];
const config = JSON.parse(readFileSync(configPath, 'utf8'));

const failures = [];
const checks = [];

function check(name, condition, detail = '') {
  checks.push(name);
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

// §4.5 — identity
check(`name is "${expected.name}"`, config.name === expected.name, `got "${config.name}"`);
check('slug is kyascene', config.slug === 'kyascene', `got "${config.slug}"`);
check('URL scheme is kyascene', config.scheme === 'kyascene', `got "${config.scheme}"`);
check(
  `iOS bundle identifier is ${expected.id}`,
  config.ios?.bundleIdentifier === expected.id,
  `got "${config.ios?.bundleIdentifier}"`,
);
check(
  `Android application id is ${expected.id}`,
  config.android?.package === expected.id,
  `got "${config.android?.package}"`,
);
check(
  'iOS and Android identifiers match',
  config.ios?.bundleIdentifier === config.android?.package,
);

// §4.5 — universal / app links
const associatedDomains = config.ios?.associatedDomains ?? [];
check(
  expected.links ? 'iOS associates applinks:kyascene.app' : 'development declares no applinks',
  associatedDomains.includes('applinks:kyascene.app') === expected.links,
  JSON.stringify(associatedDomains),
);
const intentFilters = config.android?.intentFilters ?? [];
check(
  expected.links ? 'Android declares a kyascene.app app link' : 'development declares no app link',
  intentFilters.length > 0 === expected.links,
);

// §4.7 — no consumer web application
check(
  'platforms are ios and android only',
  Array.isArray(config.platforms) &&
    config.platforms.length === 2 &&
    config.platforms.includes('ios') &&
    config.platforms.includes('android'),
  JSON.stringify(config.platforms),
);
check('no web configuration', config.web === undefined);

// §13.2 — data minimisation declared at config level
const blocked = config.android?.blockedPermissions ?? [];
for (const permission of [
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.READ_CONTACTS',
]) {
  check(`blocks ${permission.split('.').pop()}`, blocked.includes(permission));
}
check(
  'requests no Android permissions of its own',
  (config.android?.permissions ?? []).length === 0,
  JSON.stringify(config.android?.permissions),
);

// §19 — Android adaptive and monochrome icons
check('declares an adaptive icon', Boolean(config.android?.adaptiveIcon?.foregroundImage));
check('declares a monochrome icon', Boolean(config.android?.adaptiveIcon?.monochromeImage));

// §7.1 — brand
check(
  'splash and background use Scene Emerald',
  config.backgroundColor === '#032C24',
  `got "${config.backgroundColor}"`,
);
check('records the 1818 attribution', config.extra?.poweredBy === '1818');
check(`extra.environment is ${environment}`, config.extra?.environment === environment);

if (failures.length > 0) {
  console.error(`\n✖ app config verification failed for "${environment}"\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(`\n${checks.length - failures.length}/${checks.length} checks passed\n`);
  process.exit(1);
}

console.log(`✔ app config verified for "${environment}" (${checks.length} checks)`);
