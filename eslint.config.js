const js = require('@eslint/js')
const tseslint = require('typescript-eslint')
const reactHooks = require('eslint-plugin-react-hooks')
const globals = require('globals')

module.exports = tseslint.config(
  { ignores: ['out', 'release', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.js'], languageOptions: { globals: globals.node }, rules: { '@typescript-eslint/no-require-imports': 'off' } },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'warn' }
  }
)
