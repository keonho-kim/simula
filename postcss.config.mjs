/**
 * Purpose: Compile existing Tailwind styles in the Next.js browser build.
 * Pattern: Build Configuration.
 * Usage: Loaded by Next.js while compiling src/ui/index.css.
 * Related: src/ui/index.css, next.config.ts
 */
export default { plugins: { "@tailwindcss/postcss": {} } }
