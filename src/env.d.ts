/// <reference types="vite/client" />

// SFC module shim so plain TypeScript files (router, stores) can import
// .vue single-file components under `strict` mode without vue-tsc.
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
