#!/usr/bin/env node
/**
 * Asserts the NATIVE output of `expo prebuild` for a given environment.
 *
 * Checking `expo config` alone proves the JavaScript object is right; it does not prove the
 * value survived into Info.plist, the Xcode project or AndroidManifest.xml. This checks the
 * generated files, so a config-plugin regression or an Expo upgrade that quietly stops
 * honouring a field fails CI instead of shipping.
 *
 * Usage: node scripts/verify-native-output.mjs <development|beta|production>
 * Requires `expo prebuild` to have been run for BOTH platforms in that environment.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MOBILE = resolve(HERE, '..', 'apps', 'mobile');

const environment = process.argv[2];
const IDENTIFIERS = {
  development: 'app.kyascene.beta',
  beta: 'app.kyascene.beta',
  production: 'app.kyascene',
};

if (!Object.hasOwn(IDENTIFIERS, environment)) {
  console.error(`usage: verify-native-output.mjs <${Object.keys(IDENTIFIERS).join('|')}>`);
  process.exit(2);
}

const bundleId = IDENTIFIERS[environment];
const expectsUniversalLinks = environment !== 'development';

/**
 * §13.2 data minimisation, asserted against the generated manifest rather than the config.
 * Every one of these has been contributed by a dependency at some point — the location and
 * contacts entries by expo-dev-client, RECORD_AUDIO and the storage pair by
 * expo-image-picker — so this list is a record of what has actually tried to get in.
 */
const FORBIDDEN_PERMISSIONS = [
  'ACCESS_FINE_LOCATION',
  'ACCESS_COARSE_LOCATION',
  'ACCESS_BACKGROUND_LOCATION',
  'READ_CONTACTS',
  'WRITE_CONTACTS',
  'RECORD_AUDIO',
  'READ_SMS',
];

/**
 * expo-dev-client puts SYSTEM_ALERT_WINDOW in the main manifest for its dev menu overlay.
 * Development needs it; anything that reaches Play must not carry it, or it becomes a
 * Data Safety disclosure (§19) for a capability the product does not use.
 */
const forbiddenPermissions =
  environment === 'development'
    ? FORBIDDEN_PERMISSIONS
    : [...FORBIDDEN_PERMISSIONS, 'SYSTEM_ALERT_WINDOW'];

const failures = [];
const checks = [];

function check(name, condition, detail = '') {
  checks.push(name);
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
}

function read(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : null;
}

function findFirst(dir, predicate) {
  if (!existsSync(dir)) return null;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFirst(full, predicate);
      if (found) return found;
    } else if (predicate(entry.name, full)) {
      return full;
    }
  }
  return null;
}

// ---------------------------------------------------------------- iOS
const iosDir = join(MOBILE, 'ios');
check('ios/ was generated', existsSync(iosDir));

if (existsSync(iosDir)) {
  const pbxproj = findFirst(iosDir, (name) => name === 'project.pbxproj');
  const pbx = pbxproj ? read(pbxproj) : null;
  check('ios: project.pbxproj exists', pbx !== null);
  // Xcode quotes identifiers containing dots, so accept both forms.
  check(
    `ios: bundle identifier is ${bundleId}`,
    (pbx?.includes(`PRODUCT_BUNDLE_IDENTIFIER = ${bundleId};`) ||
      pbx?.includes(`PRODUCT_BUNDLE_IDENTIFIER = "${bundleId}";`)) ??
      false,
  );

  const plistPath = findFirst(
    iosDir,
    (name, full) => name === 'Info.plist' && !full.includes('Pods') && !full.includes('Tests'),
  );
  const plist = plistPath ? read(plistPath) : null;
  check('ios: Info.plist exists', plist !== null);
  check('ios: URL scheme is kyascene', plist?.includes('<string>kyascene</string>') ?? false);
  check(
    'ios: declares no non-exempt encryption',
    plist?.includes('ITSAppUsesNonExemptEncryption') ?? false,
  );
  /**
   * §S13 and §18. This assertion was inverted until Milestone 2: with no screen requesting a
   * permission, a usage description was pure liability, so the check forbade them. S13 now
   * asks for camera and photo access, which flips the requirement — a permission with a
   * missing or default string is an App Store rejection and, worse, a system dialog that
   * gives the user nothing to decide on.
   */
  for (const [key, subject] of [
    ['NSCameraUsageDescription', 'camera'],
    ['NSPhotoLibraryUsageDescription', 'photo library'],
  ]) {
    const value = new RegExp(`<key>${key}</key>\\s*<string>([^<]*)</string>`).exec(plist ?? '');

    check(
      `ios: explains why it wants the ${subject}`,
      value !== null && (value[1] ?? '').trim().length > 30,
      value === null ? 'no usage description at all' : `too short: "${value[1]}"`,
    );
    check(
      `ios: the ${subject} explanation names KyaScene`,
      (value?.[1] ?? '').includes('KyaScene'),
      'a generic string tells the user nothing about who is asking',
    );
  }

  /**
   * expo-image-picker adds a microphone string by default because it can also capture video.
   * S13 takes a still photograph, so this would be a permission — and a Data Safety
   * declaration (§19) — for a capability the product does not have.
   */
  check(
    'ios: requests no microphone access',
    !(plist ?? '').includes('NSMicrophoneUsageDescription'),
    'a dependency reintroduced it; disable it in the expo-image-picker plugin options',
  );

  check(
    'ios: declares no location usage',
    !(plist ?? '').includes('NSLocationWhenInUseUsageDescription') &&
      !(plist ?? '').includes('NSLocationAlwaysAndWhenInUseUsageDescription'),
  );

  /**
   * Over-the-air updates, checked in the generated native project rather than the JS config.
   *
   * This is the file the installed binary actually reads. A regression here produces an app
   * that builds, signs, installs and runs perfectly — and silently never checks for an update,
   * so `eas update` reports success while every phone stays on old code. Nothing in the JS
   * config or the test suite would notice.
   *
   * Skipped when no project id is configured, so a fork without an Expo account still passes.
   */
  const expoPlistPath = findFirst(
    iosDir,
    (name, full) => name === 'Expo.plist' && !full.includes('Pods'),
  );
  const expoPlist = expoPlistPath ? read(expoPlistPath) : null;
  const projectId = process.env.EAS_PROJECT_ID ?? 'd1f7b10c-c114-4d66-8f34-fe0892d0bec9';

  if (projectId === '') {
    console.log('  (no EAS project id configured — skipping update checks)');
  } else {
    check('ios: Expo.plist exists', expoPlist !== null);
    check(
      'ios: updates are enabled',
      expoPlist?.includes('<key>EXUpdatesEnabled</key>\n    <true/>') ?? false,
    );
    check(
      'ios: update URL matches the EAS project',
      expoPlist?.includes(`https://u.expo.dev/${projectId}`) ?? false,
      'the installed binary would fetch updates from the wrong project, or none at all',
    );
    check(
      'ios: runtime version uses the fingerprint policy',
      expoPlist?.includes('<string>file:fingerprint</string>') ?? false,
      'without it, an update can reach a binary whose native code cannot run it',
    );
    check(
      'ios: checks for updates on launch',
      expoPlist?.includes('<string>ALWAYS</string>') ?? false,
    );
  }

  const entitlementsPath = findFirst(iosDir, (name) => name.endsWith('.entitlements'));
  const entitlements = entitlementsPath ? read(entitlementsPath) : '';
  const hasApplinks = (entitlements ?? '').includes('applinks:kyascene.app');
  check(
    expectsUniversalLinks
      ? 'ios: universal links point at kyascene.app'
      : 'ios: development declares no universal links',
    hasApplinks === expectsUniversalLinks,
  );
}

// ------------------------------------------------------------ Android
const androidDir = join(MOBILE, 'android');
check('android/ was generated', existsSync(androidDir));

if (existsSync(androidDir)) {
  const gradle = read(join(androidDir, 'app', 'build.gradle'));
  check('android: app/build.gradle exists', gradle !== null);
  check(
    `android: applicationId is ${bundleId}`,
    (gradle ?? '').includes(`applicationId '${bundleId}'`) ||
      (gradle ?? '').includes(`applicationId "${bundleId}"`),
  );

  const manifest = read(join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml'));
  check('android: AndroidManifest.xml exists', manifest !== null);

  const manifestText = manifest ?? '';
  const hasIntentFilter =
    manifestText.includes('android:host="kyascene.app"') &&
    manifestText.includes('android:autoVerify="true"');
  check(
    expectsUniversalLinks
      ? 'android: app links verify kyascene.app'
      : 'android: development declares no app links',
    hasIntentFilter === expectsUniversalLinks,
  );

  /* The §13.2 gate. `blockedPermissions` does not delete the entry — it emits
     `tools:node="remove"`, which the Gradle manifest merger applies at build time. So a
     permission passes if it is absent OR carries that directive; it fails if some
     transitive dependency has reintroduced it as a live request. */
  for (const permission of forbiddenPermissions) {
    const entry = new RegExp(
      `<uses-permission[^>]*android:name="android\\.permission\\.${permission}"[^>]*/>`,
    ).exec(manifestText);
    check(
      `android: does not request ${permission}`,
      entry === null || entry[0].includes('tools:node="remove"'),
      'spec §13.2 forbids this in P0 — a dependency has reintroduced it as a live request',
    );
  }
}

// ---------------------------------------------------------------- report
if (failures.length > 0) {
  console.error(`\n✖ native output verification failed for "${environment}"\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(`\n${checks.length - failures.length}/${checks.length} checks passed\n`);
  process.exit(1);
}

console.log(`✔ native output verified for "${environment}" (${checks.length} checks)`);
