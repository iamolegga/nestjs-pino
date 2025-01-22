const { fixupConfigRules, fixupPluginRules } = require('@eslint/compat');
const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const typescriptEslintEslintPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const globals = require('globals');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = [
  {
    ignores: ['eslint.config.cjs'],
  },
  ...fixupConfigRules(
    compat.extends(
      'plugin:@typescript-eslint/recommended',
      'plugin:import/recommended',
      'plugin:import/typescript',
      'plugin:prettier/recommended',
    ),
  ),
  {
    plugins: {
      '@typescript-eslint': fixupPluginRules(typescriptEslintEslintPlugin),
    },

    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },

      parser: tsParser,
      ecmaVersion: 5,
      sourceType: 'module',

      parserOptions: {
        project: 'tsconfig.json',
      },
    },

    rules: {
      '@typescript-eslint/no-explicit-any': [
        'error',
        {
          fixToUnknown: true,
          ignoreRestArgs: false,
        },
      ],

      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          ignoreIIFE: true,
        },
      ],

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],

      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        {
          accessibility: 'no-public',
        },
      ],

      '@typescript-eslint/member-ordering': [
        'error',
        {
          default: [
            'public-static-field',
            'public-static-get',
            'public-static-set',
            'public-static-method',
            'protected-static-field',
            'protected-static-get',
            'protected-static-set',
            'protected-static-method',
            'private-static-field',
            'private-static-get',
            'private-static-set',
            'private-static-method',
            'signature',
            'public-abstract-field',
            'protected-abstract-field',
            'public-decorated-field',
            'public-instance-field',
            'protected-decorated-field',
            'protected-instance-field',
            'private-decorated-field',
            'private-instance-field',
            'public-constructor',
            'protected-constructor',
            'private-constructor',
            'public-abstract-get',
            'public-abstract-set',
            'public-abstract-method',
            'public-decorated-get',
            'public-instance-get',
            'public-decorated-set',
            'public-instance-set',
            'public-decorated-method',
            'public-instance-method',
            'protected-abstract-get',
            'protected-abstract-set',
            'protected-abstract-method',
            'protected-decorated-get',
            'protected-instance-get',
            'protected-decorated-set',
            'protected-instance-set',
            'protected-decorated-method',
            'protected-instance-method',
            'private-decorated-get',
            'private-instance-get',
            'private-decorated-set',
            'private-instance-set',
            'private-decorated-method',
            'private-instance-method',
          ],
        },
      ],

      'import/order': [
        'error',
        {
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },

          'newlines-between': 'always',
        },
      ],
    },
  },
];
