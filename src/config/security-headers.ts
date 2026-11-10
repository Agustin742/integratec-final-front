import type { PublicConfig } from './public-config.ts';

export const SECURITY_HEADER_NAMES = [
  'Content-Security-Policy',
  'Strict-Transport-Security',
  'X-Content-Type-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'X-Frame-Options',
] as const;

export type SecurityHeaderName = (typeof SECURITY_HEADER_NAMES)[number];
export type SecurityHeaders = Readonly<Record<SecurityHeaderName, string>>;

export const PERMISSIONS_POLICY_VALUE =
  'accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=()';

export const STRICT_TRANSPORT_SECURITY_VALUE =
  'max-age=63072000; includeSubDomains';

export class SecurityPolicyViolationError extends Error {
  readonly violations: readonly string[];

  constructor(violations: readonly string[]) {
    super(
      [
        'Security policy or build output verification failed:',
        ...violations.map((violation) => `  - ${violation}`),
      ].join('\n'),
    );
    this.name = 'SecurityPolicyViolationError';
    this.violations = Object.freeze([...violations]);
  }
}

function toOrigin(endpointUrl: string): string {
  const parsed = new URL(endpointUrl);
  return parsed.origin;
}

/**
 * Builds the strict Content-Security-Policy header value required by FD1.
 *
 * - Forbids inline scripts (`'unsafe-inline'` is absent from `script-src`) and JavaScript `'unsafe-eval'`.
 * - Allows `'wasm-unsafe-eval'` in `script-src` and `blob:` in `worker-src` so same-origin
 *   Three.js Draco/KTX2 WebAssembly decoders (#25 / F15) can compile without enabling JS `eval()`.
 * - Restricts `connect-src` to `'self'` plus the validated API and realtime origins from `PublicConfig`.
 */
export function buildContentSecurityPolicy(config: PublicConfig): string {
  const connectOrigins = new Set<string>(["'self'"]);
  connectOrigins.add(toOrigin(config.apiBaseUrl));
  connectOrigins.add(toOrigin(config.realtimeUrl));

  const directives: readonly string[] = [
    "default-src 'none'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${Array.from(connectOrigins).join(' ')}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ];

  return directives.join('; ');
}

/**
 * Parses a semicolon-delimited CSP header into a map of directive -> token list.
 */
export function parseContentSecurityPolicy(
  csp: string,
): ReadonlyMap<string, readonly string[]> {
  const directives = new Map<string, readonly string[]>();

  for (const rawDirective of csp.split(';')) {
    const trimmed = rawDirective.trim();
    if (trimmed === '') {
      continue;
    }
    const parts = trimmed.split(/\s+/);
    const name = parts[0]?.toLowerCase();
    if (!name) {
      continue;
    }
    directives.set(name, Object.freeze(parts.slice(1)));
  }

  return directives;
}

/**
 * Builds the complete HTTP security response headers for AWS Amplify Hosting and Vite preview.
 */
export function buildSecurityHeaders(config: PublicConfig): SecurityHeaders {
  return Object.freeze({
    'Content-Security-Policy': buildContentSecurityPolicy(config),
    'Strict-Transport-Security': STRICT_TRANSPORT_SECURITY_VALUE,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': PERMISSIONS_POLICY_VALUE,
    'X-Frame-Options': 'DENY',
  });
}

function formatYamlString(value: string): string {
  if (value.includes("'")) {
    return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
  }
  return `'${value}'`;
}

/**
 * Renders AWS Amplify Hosting's `customHttp.yml` specification from the validated `PublicConfig`.
 */
export function renderCustomHttpYaml(config: PublicConfig): string {
  const headers = buildSecurityHeaders(config);
  const headerLines = SECURITY_HEADER_NAMES.flatMap((key) => [
    `      - key: ${key}`,
    `        value: ${formatYamlString(headers[key])}`,
  ]);

  return [
    '# AWS Amplify Hosting custom HTTP security headers (FD1 mitigation, issue #21).',
    '# Generated from the validated PublicConfig contract (src/config/security-headers.ts).',
    'customHeaders:',
    "  - pattern: '**/*'",
    '    headers:',
    ...headerLines,
    '',
  ].join('\n');
}

export interface ValidateBuiltHtmlAndHeadersOptions {
  readonly indexHtml: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly customHttpYaml?: string;
}

const SCRIPT_TAG_REGEX = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const SRC_ATTR_REGEX = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/i;
const INLINE_EVENT_HANDLER_REGEX =
  /<[a-zA-Z][^>]*\bon[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+)/i;
const JAVASCRIPT_URL_REGEX =
  /\b(?:href|src|action|formaction)\s*=\s*(?:"\s*javascript:|'\s*javascript:|javascript:)/i;

function validateIndexHtml(indexHtml: string, violations: string[]): void {
  if (indexHtml.trim() === '') {
    violations.push('Built index.html is empty.');
    return;
  }

  let scriptMatch: RegExpExecArray | null;
  SCRIPT_TAG_REGEX.lastIndex = 0;
  let scriptCount = 0;

  while ((scriptMatch = SCRIPT_TAG_REGEX.exec(indexHtml)) !== null) {
    scriptCount += 1;
    const attributes = scriptMatch[1] ?? '';
    const body = (scriptMatch[2] ?? '').trim();
    const srcMatch = SRC_ATTR_REGEX.exec(attributes);
    const srcValue = (
      srcMatch?.[1] ??
      srcMatch?.[2] ??
      srcMatch?.[3] ??
      ''
    ).trim();

    if (body !== '' || srcValue === '') {
      violations.push(
        'Built index.html contains an inline <script> tag; all scripts must be external same-origin modules.',
      );
      continue;
    }

    if (
      !srcValue.startsWith('/') ||
      srcValue.startsWith('//') ||
      /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(srcValue)
    ) {
      violations.push(
        `Built index.html contains an external or non-same-origin script src ("${srcValue}"); only root-relative same-origin paths are allowed.`,
      );
    }
  }

  if (scriptCount === 0) {
    violations.push(
      'Built index.html contains no <script> entrypoint tag for the application bundle.',
    );
  }

  if (INLINE_EVENT_HANDLER_REGEX.test(indexHtml)) {
    violations.push(
      'Built index.html contains an inline event handler attribute (on*); inline event handlers violate CSP.',
    );
  }

  if (JAVASCRIPT_URL_REGEX.test(indexHtml)) {
    violations.push(
      'Built index.html contains a javascript: URL attribute, which violates CSP.',
    );
  }
}

function validateHeaders(
  headers: Readonly<Record<string, string | undefined>>,
  violations: string[],
): void {
  const csp = headers['Content-Security-Policy'];
  if (!csp || csp.trim() === '') {
    violations.push('Missing Content-Security-Policy header.');
  } else {
    const directives = parseContentSecurityPolicy(csp);

    for (const [name, tokens] of directives.entries()) {
      if (tokens.includes("'unsafe-eval'")) {
        violations.push(
          `Content-Security-Policy directive "${name}" must not allow 'unsafe-eval'.`,
        );
      }
    }

    const defaultSrc = directives.get('default-src');
    if (!defaultSrc || !defaultSrc.includes("'none'")) {
      violations.push(
        "Content-Security-Policy must set default-src to 'none'.",
      );
    }

    const scriptSrc = directives.get('script-src');
    if (!scriptSrc || !scriptSrc.includes("'self'")) {
      violations.push(
        "Content-Security-Policy script-src must include 'self'.",
      );
    }
    if (scriptSrc?.includes("'unsafe-inline'")) {
      violations.push(
        "Content-Security-Policy script-src must not allow 'unsafe-inline'.",
      );
    }

    const connectSrc = directives.get('connect-src');
    if (!connectSrc || !connectSrc.includes("'self'")) {
      violations.push(
        "Content-Security-Policy connect-src must include 'self'.",
      );
    }
    if (connectSrc?.includes('*')) {
      violations.push(
        'Content-Security-Policy connect-src must not use wildcard (*) origins.',
      );
    }

    const requiredExactDirectives: ReadonlyArray<
      readonly [string, readonly string[]]
    > = [
      ['font-src', ["'self'"]],
      ['img-src', ["'self'", 'data:', 'blob:']],
      ['style-src', ["'self'", "'unsafe-inline'"]],
      ['worker-src', ["'self'", 'blob:']],
      ['frame-ancestors', ["'none'"]],
      ['base-uri', ["'self'"]],
      ['object-src', ["'none'"]],
    ];

    for (const [directiveName, expectedTokens] of requiredExactDirectives) {
      const actual = directives.get(directiveName);
      if (
        !actual ||
        actual.length !== expectedTokens.length ||
        expectedTokens.some((token, index) => actual[index] !== token)
      ) {
        violations.push(
          `Content-Security-Policy directive "${directiveName}" must be "${expectedTokens.join(' ')}".`,
        );
      }
    }
  }

  if (headers['X-Content-Type-Options'] !== 'nosniff') {
    violations.push('Header X-Content-Type-Options must be set to "nosniff".');
  }

  if (headers['Referrer-Policy'] !== 'strict-origin-when-cross-origin') {
    violations.push(
      'Header Referrer-Policy must be set to "strict-origin-when-cross-origin".',
    );
  }

  if (headers['Permissions-Policy'] !== PERMISSIONS_POLICY_VALUE) {
    violations.push(
      `Header Permissions-Policy must be set to "${PERMISSIONS_POLICY_VALUE}".`,
    );
  }

  if (headers['X-Frame-Options'] !== 'DENY') {
    violations.push('Header X-Frame-Options must be set to "DENY".');
  }

  if (
    headers['Strict-Transport-Security'] !== STRICT_TRANSPORT_SECURITY_VALUE
  ) {
    violations.push(
      `Header Strict-Transport-Security must be set to "${STRICT_TRANSPORT_SECURITY_VALUE}".`,
    );
  }
}

function validateCustomHttpYaml(
  customHttpYaml: string,
  headers: Readonly<Record<string, string | undefined>>,
  violations: string[],
): void {
  if (!customHttpYaml.includes('customHeaders:')) {
    violations.push(
      'customHttp.yml is missing the top-level "customHeaders:" key.',
    );
  }
  if (!customHttpYaml.includes("- pattern: '**/*'")) {
    violations.push('customHttp.yml must declare pattern "**/*".');
  }

  for (const key of SECURITY_HEADER_NAMES) {
    const expectedValue = headers[key];
    if (!expectedValue) {
      continue;
    }
    const expectedBlock = [
      `      - key: ${key}`,
      `        value: ${formatYamlString(expectedValue)}`,
    ].join('\n');

    if (!customHttpYaml.includes(expectedBlock)) {
      violations.push(
        `customHttp.yml is missing or out of sync for header "${key}".`,
      );
    }
  }
}

/**
 * Verifies that the built `index.html` contains no inline scripts or event handlers
 * and that the HTTP security headers and Amplify `customHttp.yml` satisfy FD1.
 */
export function validateBuiltHtmlAndHeaders(
  options: ValidateBuiltHtmlAndHeadersOptions,
): void {
  const violations: string[] = [];

  validateIndexHtml(options.indexHtml, violations);
  validateHeaders(options.headers, violations);

  if (options.customHttpYaml !== undefined) {
    validateCustomHttpYaml(options.customHttpYaml, options.headers, violations);
  }

  if (violations.length > 0) {
    throw new SecurityPolicyViolationError(violations);
  }
}
