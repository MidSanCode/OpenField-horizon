/**
 * Resolve hook for the `audit_*.ts` check scripts.
 *
 * The app imports across directories with the Vite `@/` alias, which plain
 * Node cannot resolve. The check scripts run under `node
 * --experimental-strip-types` with no bundler, so without this hook any check
 * that touches a module importing `@/…` fails with ERR_MODULE_NOT_FOUND.
 *
 * Registered with `node --import ./audit_alias_hooks.mjs …`; see the
 * `check:*` scripts in package.json.
 */
import { registerHooks } from 'node:module'
import { statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src')

function isFile(candidate) {
  try {
    return statSync(candidate).isFile()
  } catch {
    return false
  }
}

/** Resolves an aliased path the way Vite would: exact, then .ts, then index.ts. */
function resolveAlias(rest) {
  const base = path.join(srcDir, rest)
  for (const candidate of [base, `${base}.ts`, path.join(base, 'index.ts')]) {
    if (isFile(candidate)) return candidate
  }
  return null
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const resolved = resolveAlias(specifier.slice(2))
      if (resolved) return nextResolve(pathToFileURL(resolved).href, context)
    }
    return nextResolve(specifier, context)
  },
})
