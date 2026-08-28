import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * pasco-ble 0.3.65 ships with unresolved `@/…` path aliases in BOTH its
 * published `dist/*.js` and `dist/*.d.ts`, and declares no `imports` map to
 * resolve them. Without this alias the package cannot be imported at all —
 * Node, esbuild and Rollup all fail with "Cannot find package '@/utils'".
 *
 * Every alias in that package is rooted at its own `dist/`, so mapping `@/*`
 * there fixes the package without affecting this sim (which never writes `@/`
 * imports of its own). Mirrored in vitest.config.ts, and as `paths` in
 * tsconfig.json / tsconfig.test.json for `npm run check`.
 *
 * TODO(pasco-ble): remove all four once pascoTS publishes a build that rewrites
 * its aliases (e.g. via tsc-alias or a bundler). Nothing else depends on it.
 */
const PASCO_BLE_DIST = fileURLToPath(new URL("./node_modules/pasco-ble/dist/", import.meta.url));
const pascoBleAlias = [{ find: /^@\/(.*)$/, replacement: `${PASCO_BLE_DIST}$1` }];

export default defineConfig({
  resolve: { alias: pascoBleAlias },
  test: {
    // happy-dom gives a lightweight DOM so SceneryStack code can import.
    environment: "happy-dom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    // --expose-gc lets us call global.gc() to force garbage collection
    execArgv: ["--expose-gc"],
    testTimeout: 30_000,
  },
});
