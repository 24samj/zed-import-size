# zed-import-size

Displays minified + gzipped npm import sizes as inlay hints in Zed for JS/TS files.

## What It Does

- Measures npm package imports only (skips relative imports).
- Shows inlay hint at end of import line:
  - `// 8.2 kb`
  - `// 242.1 kb ⚠` (for >100kb)
- Uses an in-memory package-size cache per LSP session.

## Local Development

Requirements:
- Node.js 18+
- Rust toolchain with `wasm32-wasip1` target

Build:

```bash
cd lsp-server
npm install
npm run build

cd ..
cargo build --target wasm32-wasip1
```

Install in Zed:

1. Open command palette.
2. Run `zed: install dev extension`.
3. Select this repository root.

## Publish Readiness Notes

For public release, ensure:

1. Build artifacts exist:
   - `lsp-server/dist/server.js`
   - `lsp-server/node_modules`
2. Prepare a release folder with runtime files:

```bash
node scripts/prepare-release.mjs
```

This outputs:

`release/import-size`

including:
- extension manifest + Rust shim source
- LSP `dist/server.js`
- LSP runtime `node_modules`

3. Install/test from the generated `release/import-size` directory in a clean Zed profile.
4. LSP launch uses stdio (`--stdio`) and should start cleanly without local symlink hacks.

## Troubleshooting

No hints shown:
- Ensure Zed inlay hints are enabled.
- Open a project with `node_modules` available.
- Confirm imports are npm imports (not `./` or `../`).

Hints show `0.0 kb`:
- Rebuild `lsp-server`.
- Restart Zed to clear stale LSP session cache.
