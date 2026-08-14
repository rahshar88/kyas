// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so edits in packages/* trigger a reload.
config.watchFolders = [workspaceRoot];

// Resolve from the app first, then the hoisted workspace root. `.npmrc` sets
// node-linker=hoisted, so the second entry is where nearly everything actually lives.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Deliberately NOT setting `resolver.disableHierarchicalLookup`. That flag belongs to the
// isolated (symlinked) pnpm layout; with node-linker=hoisted every dependency already
// resolves through the two paths above, and `expo-doctor` flags the override as a risky
// deviation from expo/metro-config's defaults.

module.exports = config;
