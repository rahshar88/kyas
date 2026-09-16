/**
 * Metro applies `babel-preset-expo` automatically, which is why the SDK 57 template ships
 * no babel config. Jest does not: `babel-jest` reads this file, and without it the Flow
 * type annotations inside `@react-native/jest-preset` fail to parse.
 */
module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
