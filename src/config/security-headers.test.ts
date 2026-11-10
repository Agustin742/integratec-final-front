import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import type { PublicConfig } from './public-config';
import {
  SecurityPolicyViolationError,
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  parseContentSecurityPolicy,
  renderCustomHttpYaml,
  validateBuiltHtmlAndHeaders,
} from './security-headers';

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

describe('buildSecurityHeaders and renderCustomHttpYaml', () => {
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

  test('renders deterministic Amplify Hosting customHttp.yml matching the built security headers', () => {
    const yaml = renderCustomHttpYaml(sampleDevConfig);

    expect(yaml).toContain('customHeaders:');
    expect(yaml).toContain("  - pattern: '**/*'");
    expect(yaml).toContain('      - key: Content-Security-Policy');
    expect(yaml).toContain('      - key: Strict-Transport-Security');
    expect(yaml).toContain('      - key: X-Content-Type-Options');
    expect(yaml).toContain('      - key: Referrer-Policy');
    expect(yaml).toContain('      - key: Permissions-Policy');
    expect(yaml).toContain('      - key: X-Frame-Options');
    expect(yaml).toContain(
      "connect-src 'self' http://localhost:3000 ws://localhost:2567",
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
      }),
    ).not.toThrow();
  });
});

describe('validateBuiltHtmlAndHeaders', () => {
  test('accepts a clean Vite production index.html and valid Amplify customHttp.yml', () => {
    const headers = buildSecurityHeaders(sampleProdConfig);
    const customHttpYaml = renderCustomHttpYaml(sampleProdConfig);

    expect(() =>
      validateBuiltHtmlAndHeaders({
        indexHtml: validBuiltIndexHtml,
        headers,
        customHttpYaml,
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
    ).toThrow(/script-src must not allow 'unsafe-inline'/i);
  });

  test('fails when required CSP directives or security headers are missing or customHttp.yml mismatches', () => {
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

    expect(() =>
      validateBuiltHtmlAndHeaders({
        indexHtml: validBuiltIndexHtml,
        headers: validHeaders,
        customHttpYaml:
          "customHeaders:\n  - pattern: '**/*'\n    headers: []\n",
      }),
    ).toThrow(/customHttp\.yml/i);
  });
});
