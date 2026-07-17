// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'coverage/*'],
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      react: require('eslint-plugin-react'),
    },
    rules: {
      // Skill rule: rendering-no-falsy-and — empty string / 0 leaks to View → crash
      'react/jsx-no-leaked-render': ['error', { validStrategies: ['ternary', 'coerce'] }],
      // Be explicit about React imports; aligns with the skill code samples
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
]);