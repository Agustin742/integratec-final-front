# Content Security Policy and Security Headers

[Issue #21](https://github.com/Agustin742/integratec-final-front/issues/21) implements the mandatory browser-side XSS mitigations required by [decision FD1](technical-justification.md#fd1-token-storage) (`sessionStorage` token storage), [Authentication and session](../rules/authentication-and-session.md#token-storage-and-transport), and [Security](../rules/security.md#input-transport-and-failures).

## Quick path

1. Build the production bundle and emit `dist/customHttp.yml`:
   ```sh
   pnpm build
   ```
2. Verify that `dist/index.html` contains no inline scripts or event handlers and that `customHttp.yml` enforces the strict policy:
   ```sh
   pnpm security:check
   ```
3. Run the browser smoke suite against `vite preview` (which serves the same security headers locally):
   ```sh
   PLAYWRIGHT_BROWSERS_PATH=0 pnpm e2e
   ```

## Content-Security-Policy directives

[`src/config/security-headers.ts`](../src/config/security-headers.ts) (`buildContentSecurityPolicy`) constructs the `Content-Security-Policy` header from the validated [`PublicConfig`](../src/config/public-config.ts) (`VITE_APP_ENV`, `VITE_API_BASE_URL`, `VITE_REALTIME_URL`).

| Directive         | Value                                   | Why each source is allowed                                                                                                                                                                                                                                                                                                                                                                         |
| ----------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default-src`     | `'none'`                                | Deny-by-default fallback; every resource class must be allowlisted explicitly.                                                                                                                                                                                                                                                                                                                     |
| `script-src`      | `'self' 'wasm-unsafe-eval'`             | `'self'` allows the external Vite ES module bundles under `/assets/`. `'wasm-unsafe-eval'` permits WebAssembly module compilation for Three.js Draco/meshopt/KTX2 decoders (F15 / [#25](https://github.com/Agustin742/integratec-final-front/issues/25)) without enabling JavaScript `eval()` or `new Function()` (`'unsafe-eval'`). Inline `<script>` blocks and `'unsafe-inline'` are forbidden. |
| `style-src`       | `'self' 'unsafe-inline'`                | `'self'` allows the bundled stylesheet under `/assets/`. `'unsafe-inline'` is required by Radix UI overlay positioning (`Dialog`, `Sheet`) and Sonner toast transforms, which apply runtime `style` attributes to DOM elements.                                                                                                                                                                    |
| `img-src`         | `'self' data: blob:`                    | `'self'` serves static images and icons; `data:` and `blob:` support inline SVG data URIs, canvas/WebGL texture blobs, and local file previews before upload.                                                                                                                                                                                                                                      |
| `font-src`        | `'self'`                                | Self-hosted `@fontsource-variable/fredoka` and `@fontsource-variable/figtree` `.woff2` font files are bundled under `/assets/`; no third-party font CDNs are used.                                                                                                                                                                                                                                 |
| `connect-src`     | `'self' <API origin> <Realtime origin>` | `'self'` allows fetching same-origin static assets and decoder WASM binaries. `<API origin>` is derived from `new URL(config.apiBaseUrl).origin` (NestJS REST API) and `<Realtime origin>` from `new URL(config.realtimeUrl).origin` (Colyseus WebSocket server).                                                                                                                                  |
| `worker-src`      | `'self' blob:`                          | Allows same-origin and `blob:` Web Workers used by Three.js Draco/KTX2 asset decoders (#25).                                                                                                                                                                                                                                                                                                       |
| `manifest-src`    | `'self'`                                | Restricts web app manifests to the application's own origin.                                                                                                                                                                                                                                                                                                                                       |
| `form-action`     | `'self'`                                | Prevents HTML `<form>` submissions from exfiltrating data to external origins.                                                                                                                                                                                                                                                                                                                     |
| `frame-ancestors` | `'none'`                                | Forbids embedding the application inside `<frame>`, `<iframe>`, `<embed>`, or `<object>` (clickjacking protection).                                                                                                                                                                                                                                                                                |
| `base-uri`        | `'self'`                                | Prevents `<base>` tag injection attacks from hijacking relative URL resolution.                                                                                                                                                                                                                                                                                                                    |
| `object-src`      | `'none'`                                | Blocks legacy plugin execution (`<object>`, `<embed>`, `<applet>`).                                                                                                                                                                                                                                                                                                                                |

## Companion HTTP security headers

[`buildSecurityHeaders`](../src/config/security-headers.ts) pairs `Content-Security-Policy` with five standard defense-in-depth headers:

| Header                      | Value                                                                                                                                                     | Purpose                                                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains`                                                                                                                     | Enforces HTTPS connections for two years (HSTS) across the domain and subdomains when served over TLS.                                                     |
| `X-Content-Type-Options`    | `nosniff`                                                                                                                                                 | Prevents browsers from MIME-sniffing responses away from their declared `Content-Type`.                                                                    |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                                                                                                                         | Sends the full path only on same-origin requests and strips paths/queries when navigating cross-origin (protecting invitation tokens or route parameters). |
| `Permissions-Policy`        | `accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=()` | Disables sensitive browser hardware and sensor APIs by default.                                                                                            |
| `X-Frame-Options`           | `DENY`                                                                                                                                                    | Legacy clickjacking fallback complementing `frame-ancestors 'none'`.                                                                                       |

## AWS Amplify Hosting (`customHttp.yml`) and F12 coordination

AWS Amplify Hosting ([issue #22](https://github.com/Agustin742/integratec-final-front/issues/22), `us-east-2` per FD5) reads response headers from [`customHttp.yml`](../customHttp.yml):

- **Committed root [`customHttp.yml`](../customHttp.yml):** Tracked at the repository root with the safe test placeholder origins (`https://api.example.invalid` and `wss://realtime.example.invalid`) so the header schema is versioned and reviewable in Git.
- **Build-time output (`dist/customHttp.yml`):** During `pnpm build`, the `validate-public-config-and-security-headers` plugin in [`vite.config.ts`](../vite.config.ts) renders `dist/customHttp.yml` using the active environment's validated `VITE_API_BASE_URL` and `VITE_REALTIME_URL` origins and runs `validateBuiltHtmlAndHeaders` before the build succeeds.

## WebAssembly decoder directive (F15 coordination)

[Issue #25](https://github.com/Agustin742/integratec-final-front/issues/25) (F15 GLB asset pipeline) uses Draco/meshopt geometry and KTX2 texture decoders compiled to WebAssembly:

- **Recorded directive:** `script-src 'self' 'wasm-unsafe-eval'` and `worker-src 'self' blob:`.
- **Constraint for F15:** Decoder `.wasm` and worker `.js` files **must** be served same-origin (`'self'`, e.g., from `public/` or bundled assets) and must never be fetched from an external CDN or require JavaScript `'unsafe-eval'`.

## Production (`vite build` / `vite preview`) vs development (`vite dev`)

| Mode                             | Script tags in HTML                                                                                                                      | Security headers                                                                                                                                       | Why                                                                                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm build` (`dist/index.html`) | External `<script type="module" crossorigin src="/assets/index-*.js"></script>` only; zero inline scripts.                               | Validated at build time and written to `dist/customHttp.yml`.                                                                                          | Production bundles require no inline scripts; `validateBuiltHtmlAndHeaders` fails the build if any inline `<script>`, `on*` event handler, or `javascript:` URL is present.  |
| `pnpm preview` (`vite preview`)  | Serves `dist/index.html`.                                                                                                                | Full strict `Content-Security-Policy` and companion headers injected via `configurePreviewServer` middleware in [`vite.config.ts`](../vite.config.ts). | Allows local inspection and `pnpm e2e` (Playwright) to verify zero CSP violations against the production bundle.                                                             |
| `pnpm dev` (`vite dev`)          | Vite's dev server injects `/@vite/client` and an inline `<script type="module">` preamble for `@vitejs/plugin-react` Fast Refresh (HMR). | Strict no-inline-script CSP is not applied to the dev server's HMR transform.                                                                          | Fast Refresh requires an inline module preamble during development only; `pnpm build`, `pnpm security:check`, and `pnpm e2e` enforce the production no-inline-script policy. |

## DOM XSS and `unsafe-eval` prevention (`dangerouslySetInnerHTML` and Zod `jitless`)

Per [FD1](technical-justification.md#fd1-token-storage) and [Security](../rules/security.md#input-transport-and-failures), rendering unsanitized HTML and evaluating strings as code are forbidden:

- [`eslint.config.js`](../eslint.config.js) enforces a `no-restricted-syntax` error on `JSXAttribute[name.name='dangerouslySetInnerHTML']` across all source files (`src/**/*.{ts,tsx}`).
- [`src/config/eslint-security.test.ts`](../src/config/eslint-security.test.ts) verifies that ESLint rejects any component using `dangerouslySetInnerHTML`.
- [`src/config/public-config.ts`](../src/config/public-config.ts) and [`src/components/forms/form-primitives.tsx`](../src/components/forms/form-primitives.tsx) enable `z.config({ jitless: true })` so Zod v4 never probes `new Function("")` at runtime under `script-src 'self' 'wasm-unsafe-eval'`.
