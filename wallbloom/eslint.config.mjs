import js from '@eslint/js';
import globals from 'globals';

// Catches real mistakes (undefined names, unreachable code, duplicate keys).
// Style is not enforced, so the existing compact code stays as it is.
export default [
  {ignores: ['node_modules/**', 'dist/**', 'data/**', 'work/**']},
  js.configs.recommended,
  {
    files: ['**/*.mjs', '**/*.cjs'],
    languageOptions: {ecmaVersion: 'latest', globals: {...globals.node}},
  },
  {files: ['**/*.cjs'], languageOptions: {sourceType: 'commonjs'}},
  {files: ['desktop/preload.cjs'], languageOptions: {globals: {...globals.node, ...globals.browser}}},
  // UI checks pass callbacks to the browser (Playwright page.evaluate).
  {files: ['tools/**', '*.test.mjs'], languageOptions: {globals: {...globals.node, ...globals.browser}}, rules: {'no-useless-assignment': 'off'}},
  {
    files: ['public/**/*.js'],
    languageOptions: {ecmaVersion: 'latest', sourceType: 'module', globals: {...globals.browser}},
  },
  {
    rules: {
      'no-empty': ['error', {allowEmptyCatch: true}],
      // Control characters are matched on purpose to strip them from user input.
      'no-control-regex': 'off',
      'no-useless-escape': 'off',
      'preserve-caught-error': 'off',
      'no-unused-vars': ['warn', {args: 'none', caughtErrors: 'none'}],
    },
  },
];
