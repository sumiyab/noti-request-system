import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import preferArrow from 'eslint-plugin-prefer-arrow-functions';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/',
      '**/.next/',
      '**/out/',
      '**/.serverless/',
      '**/coverage/',
      '**/dist/',
      '.omc/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['*.mjs'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { 'unused-imports': unusedImports, 'prefer-arrow-functions': preferArrow },
    rules: {
      // Files stay small enough to read in one sitting.
      'max-lines': ['error', { max: 160, skipBlankLines: true, skipComments: true }],

      // One function style: `const fn = () => …`.
      'func-style': ['error', 'expression'],
      'prefer-arrow-callback': ['error', { allowNamedFunctions: false }],
      'prefer-arrow-functions/prefer-arrow-functions': [
        'error',
        { classPropertiesAllowed: true, disallowPrototype: true, returnStyle: 'unchanged' },
      ],

      // Unused imports, variables, functions, and parameters are errors; imports are auto-removed by --fix.
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
        },
      ],
    },
  },
  {
    // Config and script files are plain JS; type-aware rules do not apply.
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  prettier,
);
