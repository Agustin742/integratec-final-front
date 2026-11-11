import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import {
  runSecurityBuildCheck,
  syncCustomHttpFiles,
} from '../../scripts/security/check-security-build.mjs';
import type { PublicConfig } from './public-config.ts';
import {
  SecurityPolicyViolationError,
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  parseContentSecurityPolicy,
  parseCustomHttpYaml,
  renderCustomHttpYaml,
  validateBuiltHtmlAndHeaders,
} from './security-headers.ts';

const sampleProdConfig: PublicConfig = {
  appEnv: 'production',
  apiBaseUrl: 'https://api.example.invalid/v1',
  realtimeUrl: 'wss://realtime.example.invalid/rooms',
};

const sampleDevConfig: PublicConfig = {
  appEnv: 'development',
  apiBaseUrl: 'http://localhost:3000',
  realtimeUrl: 'ws://localhost:2567',
};

const validBuiltIndexHtml = `<!doctype html>
<html lang="es-AR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>IntegrarTec</title>
    <script type="module" crossorigin src="/assets/index-QBAcKKnT.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-C06kXbQN.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

describe('buildContentSecurityPolicy', () => {
  test('builds a strict CSP with same-origin scripts, wasm-unsafe-eval, and normalized connect-src origins', () => {
    const csp = buildContentSecurityPolicy(sampleProdConfig);
    const directives = parseContentSecurityPolicy(csp);

    expect(directives.get('default-src')).toEqual(["'none'"]);
    expect(directives.get('script-src')).toEqual([
      "'self'",
      "'wasm-unsafe-eval'",
    ]);
    expect(directives.get('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directives.get('img-src')).toEqual(["'self'", 'data:', 'blob:']);
    expect(directives.get('font-src')).toEqual(["'self'"]);
    expect(directives.get('connect-src')).toEqual([
      "'self'",
      'https://api.example.invalid',
      'wss://realtime.example.invalid',
    ]);
    expect(directives.get('worker-src')).toEqual(["'self'", 'blob:']);
    expect(directives.get('manifest-src')).toEqual(["'self'"]);
    expect(directives.get('form-action')).toEqual(["'self'"]);
    expect(directives.get('frame-ancestors')).toEqual(["'none'"]);
    expect(directives.get('base-uri')).toEqual(["'self'"]);
    expect(directives.get('object-src')).toEqual(["'none'"]);

    expect(csp).not.toContain("'unsafe-eval'");
  });

  test('deduplicates connect-src origins when API and realtime share an origin or match self', () => {
    const csp = buildContentSecurityPolicy({
      appEnv: 'development',
      apiBaseUrl: 'http://localhost:3000',
      realtimeUrl: 'http://localhost:3000',
    });
    const directives = parseContentSecurityPolicy(csp);

    expect(directives.get('connect-src')).toEqual([
      "'self'",
      'http://localhost:3000',
    ]);
  });
});

describe('buildSecurityHeaders, renderCustomHttpYaml, and parseCustomHttpYaml', () => {
  test('returns CSP and mandatory security headers including HSTS, Referrer-Policy, X-Content-Type-Options, Permissions-Policy, and X-Frame-Options', () => {
    const headers = buildSecurityHeaders(sampleProdConfig);

    expect(headers['Content-Security-Policy']).toBe(
      buildContentSecurityPolicy(sampleProdConfig),
    );
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toBe(
      'accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=()',
    );
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Strict-Transport-Security']).toBe(
      'max-age=63072000; includeSubDomains',
    );
  });

  test('renders deterministic Amplify Hosting customHttp.yml and parses it back losslessly', () => {
    const yaml = renderCustomHttpYaml(sampleDevConfig);
    const parsed = parseCustomHttpYaml(yaml);

    expect(parsed.customHeaders).toHaveLength(1);
    expect(parsed.customHeaders[0]?.pattern).toBe('**/*');
    expect(parsed.customHeaders[0]?.headers).toEqual(
      Object.entries(buildSecurityHeaders(sampleDevConfig)).map(
        ([key, value]) => ({ key, value }),
      ),
    );
  });

  test('committed root customHttp.yml matches the canonical template and passes validation', () => {
    const rootCustomHttpPath = resolve(process.cwd(), 'customHttp.yml');
    const committedYaml = readFileSync(rootCustomHttpPath, 'utf8').replaceAll(
      '\r\n',
      '\n',
    );
    const templateConfig: PublicConfig = {
      appEnv: 'test',
      apiBaseUrl: 'https://api.example.invalid',
      realtimeUrl: 'wss://realtime.example.invalid',
    };

    expect(committedYaml).toBe(renderCustomHttpYaml(templateConfig));
    expect(() =>
      validateBuiltHtmlAndHeaders({
        indexHtml: validBuiltIndexHtml,
        headers: buildSecurityHeaders(templateConfig),
        customHttpYaml: committedYaml,
        expectedConfig: templateConfig,
      }),
    ).not.toThrow();
  });
});

describe('validateBuiltHtmlAndHeaders', () => {
  test('accepts a clean Vite production index.html and valid Amplify customHttp.yml matching expectedConfig', () => {
    const headers = buildSecurityHeaders(sampleProdConfig);
    const customHttpYaml = renderCustomHttpYaml(sampleProdConfig);

    expect(() =>
      validateBuiltHtmlAndHeaders({
        indexHtml: validBuiltIndexHtml,
        headers,
        customHttpYaml,
        expectedConfig: sampleProdConfig,
      }),
    ).not.toThrow();
  });

  test('fails when index.html contains an inline script body', () => {
    const headers = buildSecurityHeaders(sampleProdConfig);
    const htmlWithInlineScript = validBuiltIndexHtml.replace(
      '</body>',
      '  <script>window.__BOOT__ = 1;</script>\n  </body>',
    );

    expect(() =>
      validateBuiltHtmlAndHeaders({
        indexHtml: htmlWithInlineScript,
        headers,
      }),
    ).toThrow(SecurityPolicyViolationError);
    expect(() =>
      validateBuiltHtmlAndHeaders({
        indexHtml: htmlWithInlineScript,
        headers,
      }),
    ).toThrow(/inline <script>/i);
  });

  test('fails when index.html contains a script tag without src attribute', () => {
    const headers = buildSecurityHeaders(sampleProdConfig);
    const htmlWithEmptyScript = validBuiltIndexHtml.replace(
      '</body>',
      '  <script type="module"></script>\n  </body>',
    );

    expect(() =>
      validateBuiltHtmlAndHeaders({
        indexHtml: htmlWithEmptyScript,
        headers,
      }),
    ).toThrow(/inline <script>/i);
  });

  test('fails when index.html loads a third-party external script src', () => {
    const headers = buildSecurityHeaders(sampleProdConfig);
    const htmlWithExternalScript = validBuiltIndexHtml.replace(
      '</body>',
      '  <script src="https://cdn.example.invalid/tracker.js"></script>\n  </body>',
    );

    expect(() =>
      validateBuiltHtmlAndHeaders({
        indexHtml: htmlWithExternalScript,
        headers,
      }),
    ).toThrow(/external or non-same-origin script src/i);
  });

  test('fails when index.html contains inline DOM event handlers or javascript: URLs', () => {
    const headers = buildSecurityHeaders(sampleProdConfig);
    const htmlWithOnclick = validBuiltIndexHtml.replace(
      '<div id="root"></div>',
      '<div id="root" onclick="alert(1)"></div>',
    );
    const htmlWithJavascriptHref = validBuiltIndexHtml.replace(
      '<div id="root"></div>',
      '<a href="javascript:alert(1)">Link</a>',
    );

    expect(() =>
      validateBuiltHtmlAndHeaders({
        indexHtml: htmlWithOnclick,
        headers,
      }),
    ).toThrow(/inline event handler/i);

    expect(() =>
      validateBuiltHtmlAndHeaders({
        indexHtml: htmlWithJavascriptHref,
        headers,
      }),
    ).toThrow(/javascript: URL/i);
  });

  test('fails when Content-Security-Policy allows unsafe-eval or unsafe-inline in script-src', () => {
    const validHeaders = buildSecurityHeaders(sampleProdConfig);

    expect(() =>
      validateBuiltHtmlAndHeaders({
        indexHtml: validBuiltIndexHtml,
        headers: {
          ...validHeaders,
          'Content-Security-Policy': validHeaders[
            'Content-Security-Policy'
          ].replace("'wasm-unsafe-eval'", "'unsafe-eval'"),
        },
      }),
    ).toThrow(/unsafe-eval/i);

    expect(() =>
      validateBuiltHtmlAndHeaders({
        indexHtml: validBuiltIndexHtml,
        headers: {
          ...validHeaders,
          'Content-Security-Policy': validHeaders[
            'Content-Security-Policy'
          ].replace(
            "script-src 'self' 'wasm-unsafe-eval'",
            "script-src 'self' 'unsafe-inline'",
          ),
        },
      }),
    ).toThrow(/script-src/i);
  });

  test('fails when Content-Security-Policy appends script-src-elem or script-src-attr overrides', () => {
    const validHeaders = buildSecurityHeaders(sampleProdConfig);

    expect(() =>
      validateBuiltHtmlAndHeaders({
        indexHtml: validBuiltIndexHtml,
        headers: {
          ...validHeaders,
          'Content-Security-Policy': `${validHeaders['Content-Security-Policy']}; script-src-elem 'self' 'unsafe-inline'`,
        },
      }),
    ).toThrow(/script-src-elem/i);

    expect(() =>
      validateBuiltHtmlAndHeaders({
        indexHtml: validBuiltIndexHtml,
        headers: {
          ...validHeaders,
          'Content-Security-Policy': `${validHeaders['Content-Security-Policy']}; script-src-attr 'unsafe-inline'`,
        },
      }),
    ).toThrow(/script-src-attr/i);
  });

  test('fails when connect-src uses scheme-only tokens (such as https:) or mismatches configured origins', () => {
    const validHeaders = buildSecurityHeaders(sampleProdConfig);

    expect(() =>
      validateBuiltHtmlAndHeaders({
        indexHtml: validBuiltIndexHtml,
        headers: {
          ...validHeaders,
          'Content-Security-Policy': validHeaders[
            'Content-Security-Policy'
          ].replace(
            "connect-src 'self' https://api.example.invalid wss://realtime.example.invalid",
            "connect-src 'self' https:",
          ),
        },
      }),
    ).toThrow(/connect-src/i);

    expect(() =>
      validateBuiltHtmlAndHeaders({
        indexHtml: validBuiltIndexHtml,
        headers: validHeaders,
        expectedConfig: {
          appEnv: 'production',
          apiBaseUrl: 'https://api.prod.school.edu.ar',
          realtimeUrl: 'wss://rt.prod.school.edu.ar',
        },
      }),
    ).toThrow(/connect-src/i);
  });

  test('fails when customHttp.yml has malformed YAML syntax (such as trailing broken: [) or structural errors', () => {
    const validHeaders = buildSecurityHeaders(sampleProdConfig);
    const validYaml = renderCustomHttpYaml(sampleProdConfig);

    expect(() =>
      validateBuiltHtmlAndHeaders({
        indexHtml: validBuiltIndexHtml,
        headers: validHeaders,
        customHttpYaml: `${validYaml}broken: [\n`,
      }),
    ).toThrow(/customHttp\.yml/i);

    expect(() =>
      validateBuiltHtmlAndHeaders({
        indexHtml: validBuiltIndexHtml,
        headers: validHeaders,
        customHttpYaml:
          "customHeaders:\n  - pattern: '**/*'\n    headers: []\n",
      }),
    ).toThrow(/customHttp\.yml/i);
  });

  test('fails when required security headers are missing or invalid', () => {
    const validHeaders = buildSecurityHeaders(sampleProdConfig);

    expect(() =>
      validateBuiltHtmlAndHeaders({
        indexHtml: validBuiltIndexHtml,
        headers: {
          ...validHeaders,
          'X-Content-Type-Options': 'invalid',
        },
      }),
    ).toThrow(/X-Content-Type-Options/i);
  });
});

describe('Amplify customHttp.yml environment handoff (syncCustomHttpFiles + runSecurityBuildCheck)', () => {
  test('propagates non-placeholder environment origins into root customHttp.yml and verifies parity', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'integratec-csp-handoff-'));
    try {
      const distDir = join(tempRoot, 'dist');
      mkdirSync(distDir, { recursive: true });
      writeFileSync(join(distDir, 'index.html'), validBuiltIndexHtml, 'utf8');

      // Start with the placeholder template in root customHttp.yml
      const placeholderYaml = renderCustomHttpYaml({
        appEnv: 'test',
        apiBaseUrl: 'https://api.example.invalid',
        realtimeUrl: 'wss://realtime.example.invalid',
      });
      writeFileSync(join(tempRoot, 'customHttp.yml'), placeholderYaml, 'utf8');

      const deployEnv = {
        MODE: 'production',
        VITE_APP_ENV: 'production',
        VITE_API_BASE_URL: 'https://api.prod.integratec.edu.ar/v1',
        VITE_REALTIME_URL: 'wss://rt.prod.integratec.edu.ar/rooms',
      };

      // Emit dist/customHttp.yml as vite build does
      const deployConfig: PublicConfig = {
        appEnv: 'production',
        apiBaseUrl: deployEnv.VITE_API_BASE_URL,
        realtimeUrl: deployEnv.VITE_REALTIME_URL,
      };
      writeFileSync(
        join(distDir, 'customHttp.yml'),
        renderCustomHttpYaml(deployConfig),
        'utf8',
      );

      // Before running syncCustomHttpFiles, requiring root match fails because root still has placeholder origins
      expect(() =>
        runSecurityBuildCheck({
          root: tempRoot,
          env: deployEnv,
          requireRootMatchActiveConfig: true,
        }),
      ).toThrow(/connect-src|does not match/i);

      // Run the Amplify handoff synchronization step (`pnpm security:sync`)
      syncCustomHttpFiles({ root: tempRoot, env: deployEnv });

      const syncedRootYaml = readFileSync(
        join(tempRoot, 'customHttp.yml'),
        'utf8',
      );
      const parsedRoot = parseCustomHttpYaml(syncedRootYaml);
      const cspHeader = parsedRoot.customHeaders[0]?.headers.find(
        (header) => header.key === 'Content-Security-Policy',
      );

      expect(cspHeader?.value).toContain(
        "connect-src 'self' https://api.prod.integratec.edu.ar wss://rt.prod.integratec.edu.ar",
      );
      expect(cspHeader?.value).not.toContain('api.example.invalid');

      // Now runSecurityBuildCheck with requireRootMatchActiveConfig passes
      expect(() =>
        runSecurityBuildCheck({
          root: tempRoot,
          env: deployEnv,
          requireRootMatchActiveConfig: true,
        }),
      ).not.toThrow();
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
