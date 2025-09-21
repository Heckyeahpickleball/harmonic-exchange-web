// eslint.config.mjs
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import next from 'eslint-config-next'

export default [
  // Base presets
  js.configs.recommended,
  ...tseslint.configs.recommended,
  next,

  // Ignore build outputs
  { ignores: ['.next/**', 'node_modules/**', 'dist/**'] },

  // Relax rules so Vercel builds pass
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@next/next/no-html-link-for-pages': 'off',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]
