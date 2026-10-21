import js from '@eslint/js'
import pluginQuery from '@tanstack/eslint-plugin-query'
import pluginRouter from '@tanstack/eslint-plugin-router'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/**
 * ESLint flat config. `npm run lint` runs this plus `prettier --check`.
 *
 * The important part is `recommendedTypeChecked`: it runs the real TypeScript program,
 * which is what catches unhandled promises. In an app that's async end to end — drizzle
 * queries, pg-boss handlers, fetches — a forgotten `await` is the bug class most likely
 * to bite, and it's invisible to a syntax-only linter.
 *
 * Formatting is Prettier's job alone; `prettier` must stay LAST so it switches off any
 * stylistic rules that would fight it.
 */
export default tseslint.config(
  {
    // Generated or vendored — never our problem to lint.
    ignores: ['dist/**', 'drizzle/**', 'src/web/routeTree.gen.ts', 'node_modules/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        // Type-aware linting needs to know which tsconfig describes each file.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Unused args are often deliberate (middleware signatures); allow _-prefixed.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Make the async-safety rules errors rather than warnings — they're the reason
      // we're paying for type-aware linting at all.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // `any` defeats the point of the end-to-end types.
      '@typescript-eslint/no-explicit-any': 'error',
      // Off deliberately: it fires on every method of an in-memory repository or test
      // fake, where `async` exists to satisfy a Promise-returning interface rather than
      // to await anything. The rule is right in general and wrong for this codebase's
      // central pattern, and a fake peppered with eslint-disable comments is worse.
      '@typescript-eslint/require-await': 'off',
    },
  },

  // ---- Server ----
  {
    files: ['src/server/**/*.ts', 'src/shared/**/*.ts', 'test/**/*.ts', '*.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },

  // ---- Frontend ----
  {
    files: ['src/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // TanStack's own plugins catch mistakes the type system can't: unstable query keys,
  // missing deps in queryFn, incorrect Link usage.
  ...pluginQuery.configs['flat/recommended'],
  ...pluginRouter.configs['flat/recommended'],

  // ---- File-based route modules ----
  {
    files: ['src/web/routes/**/*.tsx'],
    rules: {
      // `throw redirect({ ... })` is TanStack Router's documented control-flow API, and
      // a redirect isn't an Error subclass.
      '@typescript-eslint/only-throw-error': 'off',
      // A route module always exports both `Route` and its component — that's the
      // file-based convention, not an accident.
      'react-refresh/only-export-components': 'off',
    },
  },

  // ---- Scripts that are allowed to talk to a human ----
  {
    files: ['src/server/db/migrate.ts', 'src/server/db/seed.ts'],
    rules: { 'no-console': 'off' },
  },

  // ---- Config files aren't part of the typed program ----
  {
    files: ['**/*.config.{js,ts}', 'eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },

  prettier,
)
