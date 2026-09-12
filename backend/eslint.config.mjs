import base from '../eslint.config.mjs';

const config = [
  ...base,
  {
    // Test doubles are async by contract, not by body; matcher helpers return `any`.
    files: ['specs/**'],
    rules: {
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
];

export default config;
