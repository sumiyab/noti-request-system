import { globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import base from '../eslint.config.mjs';

const config = [
  ...base,
  ...nextVitals,
  globalIgnores(['.next/**', 'out/**', 'next-env.d.ts']),
  {
    // shadcn/ui components are generated code; they use function declarations by convention.
    files: ['src/components/ui/**'],
    rules: {
      'max-lines': 'off',
      'func-style': 'off',
      'prefer-arrow-functions/prefer-arrow-functions': 'off',
      'prefer-arrow-callback': 'off',
    },
  },
];

export default config;
