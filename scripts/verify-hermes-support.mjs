#!/usr/bin/env node
/**
 * Refuses JavaScript APIs that Node has and Hermes does not.
 *
 * ## The bug this exists for
 *
 * `StudentAvatar` used `Intl.Segmenter` to take the first letter of a name. It is the correct
 * API for the job — a string index would cut a Devanagari cluster in half — and **Hermes does
 * not implement it**. Jest runs on Node, which does. So 514 tests passed, CI was green, and the
 * app crashed on launch the first time an account had a name.
 *
 * It hid even longer than that because the call sat behind an early return for an empty name.
 * Every account in testing had a null `display_name`, so the line was unreachable and the app
 * worked perfectly. Setting one real name in the database broke it — and a full rebuild could
 * not fix it, because the data had changed rather than the code.
 *
 * ## Why a grep and not a lint rule
 *
 * The failure is not "this API is wrong". It is "this API is absent on the engine we ship,
 * and the environment we test in hides that". No type-checker or test can see that difference,
 * because both run on Node. Something has to hold the list.
 *
 * A match is not automatically a defect: feature-detecting the API and falling back is exactly
 * right, which is what `StudentAvatar` does now. So a call site may opt out with a comment
 * saying how it is guarded, on the line before.
 *
 * Usage: node scripts/verify-hermes-support.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

/** Where code that runs on a phone lives. The admin console is a browser and exempt. */
const SEARCH_ROOTS = [
  resolve(ROOT, 'apps', 'mobile', 'src'),
  resolve(ROOT, 'apps', 'mobile', 'app'),
  resolve(ROOT, 'packages', 'ui', 'src'),
  resolve(ROOT, 'packages', 'domain', 'src'),
  resolve(ROOT, 'packages', 'analytics', 'src'),
  resolve(ROOT, 'packages', 'observability', 'src'),
];

/**
 * Present in Node, absent or unreliable in Hermes.
 *
 * Deliberately short. A list nobody trusts gets suppressed wholesale, so this holds only
 * things that are genuinely missing on the engine this app ships with, each with the reason a
 * reader would need to decide what to do instead.
 */
const UNSUPPORTED = [
  {
    pattern: /\bIntl\.Segmenter\b/,
    name: 'Intl.Segmenter',
    instead: 'feature-detect it and fall back to Array.from, which splits by code point',
  },
  {
    pattern: /\bIntl\.DisplayNames\b/,
    name: 'Intl.DisplayNames',
    instead: 'ship the display strings yourself — the catalogues already do this',
  },
  {
    pattern: /\bIntl\.ListFormat\b/,
    name: 'Intl.ListFormat',
    instead: 'join with ", " and a translated final conjunction',
  },
  {
    pattern: /\bIntl\.RelativeTimeFormat\b/,
    name: 'Intl.RelativeTimeFormat',
    instead: 'format the handful of cases this app needs directly',
  },
  {
    pattern: /\bnew FinalizationRegistry\b|\bnew WeakRef\b/,
    name: 'WeakRef / FinalizationRegistry',
    instead: 'hold the reference explicitly and release it when the screen unmounts',
  },
];

/** Opt-out for a guarded call site, on the line above. */
const ALLOW = /hermes-ok:/i;

function sourceFiles(dir) {
  const found = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return found;
  }

  for (const entry of entries) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue;
      found.push(...sourceFiles(path));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      found.push(path);
    }
  }
  return found;
}

const failures = [];
let scanned = 0;

for (const root of SEARCH_ROOTS) {
  for (const file of sourceFiles(root)) {
    scanned += 1;
    const lines = readFileSync(file, 'utf8').split('\n');

    lines.forEach((line, index) => {
      // A mention in a comment is documentation, not a call. `typeof` is the feature test.
      const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
      if (code.trim().startsWith('*')) return;

      for (const { pattern, name, instead } of UNSUPPORTED) {
        if (!pattern.test(code)) continue;
        if (ALLOW.test(lines[index - 1] ?? '')) continue;
        // `typeof X === 'function'` and `(Intl as {...}).Segmenter` are the guard itself.
        if (/typeof\s|\bas\s*\{/.test(code)) continue;

        failures.push({
          file: relative(ROOT, file),
          line: index + 1,
          name,
          instead,
          source: line.trim(),
        });
      }
    });
  }
}

if (failures.length > 0) {
  console.error('✖ APIs that Node has and Hermes does not\n');
  for (const failure of failures) {
    console.error(`  ${failure.file}:${failure.line}`);
    console.error(`    ${failure.source}`);
    console.error(`    ${failure.name} is absent on Hermes — ${failure.instead}`);
    console.error(
      `    If it is already feature-detected, put "hermes-ok: <why>" on the line above.\n`,
    );
  }
  console.error(
    '  Jest runs on Node, which has these. A green suite says nothing about the device.',
  );
  process.exit(1);
}

console.log(`✔ no Hermes-unsupported APIs reached for unguarded (${scanned} files)`);
