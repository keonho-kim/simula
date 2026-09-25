/**
 * Purpose: Apply repository lint rules while excluding generated build output.
 * Pattern: Tool configuration.
 * Usage: Loaded by bun run lint.
 * Related: tsconfig.json, package.json
 */
import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  globalIgnores([
    "node_modules",
    ".next",
    "dist",
    "apps/web/dist",
    "runs",
    "output",
    "output.samples",
    "test-results",
    "**/dist",
    "**/*.d.ts",
    ".agents",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        Bun: "readonly",
      },
    },
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-refresh/only-export-components": "off",
    },
  },
])
