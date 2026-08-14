#!/usr/bin/env node
/**
 * Checks that the privacy disclosure still describes the database that exists.
 *
 * §18 requires that "app privacy answers match real SDK and data behaviour", and §16.4 makes a
 * mismatch a release blocker. Both are stated as things a person should check. Nobody checks
 * them, because the moment they go wrong is a migration adding one column to one table — an
 * entirely ordinary change that nothing connects to a form filled in months earlier in App
 * Store Connect.
 *
 * So the connection is made here. `docs/product/data-inventory.json` classifies every table and
 * every column; this compares it to the migrations. A new column fails the build until somebody
 * says what it holds and whether it is personal data. That is deliberately annoying: the point
 * is that widening what KyaScene knows about a student cannot happen quietly.
 *
 * An inaccurate privacy declaration is not a documentation defect. It is a false statement to a
 * regulator and to every person who read it before deciding to register.
 *
 * Usage: node scripts/verify-privacy-disclosure.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const MIGRATIONS = resolve(ROOT, 'supabase', 'migrations');
const INVENTORY = resolve(ROOT, 'docs', 'product', 'data-inventory.json');

/** Line starts that introduce a table constraint rather than a column. */
const NOT_A_COLUMN =
  /^(constraint|primary\s+key|unique|check|foreign\s+key|exclude|like|deferrable|initially)\b/i;

/**
 * Strips comments before parsing.
 *
 * The schema is heavily commented — deliberately — and several of those comments contain SQL
 * fragments as examples. Parsing without stripping them first invents columns that do not
 * exist, which produces a gate that fails for reasons nobody can act on.
 */
function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
}

function readSchema() {
  const files = readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const tables = new Map();

  for (const file of files) {
    const sql = stripComments(readFileSync(resolve(MIGRATIONS, file), 'utf8'));

    // Tables.
    const createRe = /create table (?:if not exists )?public\.(\w+)\s*\(([\s\S]*?)\n\);/g;
    let match;
    while ((match = createRe.exec(sql)) !== null) {
      const [, name, body] = match;
      const columns = new Set();

      let depth = 0;
      for (const rawLine of body.split('\n')) {
        const line = rawLine.trim();
        // Only lines at the top level of the parens list start a column.
        const before = depth;
        depth += (line.match(/\(/g) ?? []).length - (line.match(/\)/g) ?? []).length;
        if (before !== 0 || line === '' || NOT_A_COLUMN.test(line)) continue;

        const column = /^([a-z_][a-z0-9_]*)\s+\S/.exec(line);
        if (column) columns.add(column[1]);
      }

      tables.set(name, columns);
    }

    // Columns added later. §S13's display name and §S19's readable referral code both arrived
    // this way, which is exactly the case this gate exists to catch.
    const alterRe = /alter table public\.(\w+)\s+add column (?:if not exists )?(\w+)/g;
    while ((match = alterRe.exec(sql)) !== null) {
      const [, table, column] = match;
      tables.get(table)?.add(column);
    }
  }

  return tables;
}

const schema = readSchema();
const inventory = JSON.parse(readFileSync(INVENTORY, 'utf8'));
const failures = [];

/** Every classification a column may carry, and what each one asserts. */
const CLASSIFICATIONS = new Set([
  'identifier', // Links rows to a person: user ids, tokens.
  'personal', // Says something about the person. Declarable to Apple and Google.
  'sensitive', // Personal and higher-risk: free text they wrote, contact details.
  'reference', // Catalogue data. The same for everyone; says nothing about anybody.
  'operational', // Timestamps, sort orders, flags. Not about the person.
  'credential', // Secrets and digests. Never leaves the server.
]);

for (const [table, columns] of schema) {
  const declared = inventory.tables[table];

  if (declared === undefined) {
    failures.push(
      `table "${table}" exists in the migrations but not in data-inventory.json — ` +
        `say what it holds before it ships`,
    );
    continue;
  }

  if (typeof declared.purpose !== 'string' || declared.purpose.trim() === '') {
    failures.push(`table "${table}" has no stated purpose`);
  }

  for (const column of columns) {
    const classification = declared.columns?.[column];

    if (classification === undefined) {
      failures.push(
        `${table}.${column} is not classified — add it to data-inventory.json and, if it is ` +
          `personal data, check the App Store and Play answers still hold`,
      );
      continue;
    }

    if (!CLASSIFICATIONS.has(classification)) {
      failures.push(
        `${table}.${column} has an unknown classification "${classification}" ` +
          `(expected one of: ${[...CLASSIFICATIONS].join(', ')})`,
      );
    }
  }

  // The reverse direction: a column removed from the schema but still declared. Less serious —
  // it over-declares rather than under-declares — but it makes the document untrustworthy,
  // which is how the whole thing stops being read.
  for (const column of Object.keys(declared.columns ?? {})) {
    if (!columns.has(column)) {
      failures.push(`${table}.${column} is declared but no longer exists in the schema`);
    }
  }
}

for (const table of Object.keys(inventory.tables)) {
  if (!schema.has(table)) {
    failures.push(`table "${table}" is declared but no longer exists in the schema`);
  }
}

/**
 * §14.3's allowlist is the other half of the promise. The disclosure says which properties
 * reach a third-party analytics vendor; if a key is added to the type and not to the document,
 * the declaration is wrong in the direction that matters — data leaving without being declared.
 */
const propertiesSource = readFileSync(
  resolve(ROOT, 'packages', 'analytics', 'src', 'properties.ts'),
  'utf8',
);
const interfaceBody = /export interface AnalyticsProperties \{([\s\S]*?)\n\}/.exec(
  propertiesSource,
);

if (interfaceBody === null) {
  failures.push('could not read AnalyticsProperties — the analytics allowlist check is broken');
} else {
  const keys = [...stripComments(interfaceBody[1]).matchAll(/^\s{2}(\w+)\??:/gm)].map(
    (match) => match[1],
  );
  const declaredKeys = new Set(inventory.analyticsProperties ?? []);

  for (const key of keys) {
    if (!declaredKeys.has(key)) {
      failures.push(
        `analytics property "${key}" is sent to the analytics vendor but is not listed in ` +
          `data-inventory.json — widening that type is a privacy decision (§14.3)`,
      );
    }
  }
  for (const key of declaredKeys) {
    if (!keys.includes(key)) {
      failures.push(`analytics property "${key}" is declared but no longer exists`);
    }
  }
}

const columnCount = [...schema.values()].reduce((total, columns) => total + columns.size, 0);

if (failures.length > 0) {
  console.error('✖ privacy disclosure does not match the database\n');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(
    `\n  ${schema.size} tables, ${columnCount} columns checked against docs/product/data-inventory.json`,
  );
  console.error('  See docs/product/privacy-disclosures.md for what each answer commits us to.');
  process.exit(1);
}

console.log(
  `✔ privacy disclosure matches the schema (${schema.size} tables, ${columnCount} columns)`,
);
