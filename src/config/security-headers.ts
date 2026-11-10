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

export const ALLOWED_CSP_DIRECTIVE_NAMES = [
  'default-src',
  'script-src',
  'style-src',
  'img-src',
  'font-src',
  'connect-src',
  'worker-src',
  'manifest-src',
  'form-action',
  'frame-ancestors',
  'base-uri',
  'object-src',
] as const;

const ALLOWED_CSP_DIRECTIVE_SET = new Set<string>(ALLOWED_CSP_DIRECTIVE_NAMES);

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
 * Returns the expected `connect-src` token list (`'self'` plus deduplicated API and realtime origins)
 * for a validated `PublicConfig`.
 */
export function getExpectedConnectSrcTokens(
  config: PublicConfig,
): readonly string[] {
  const connectOrigins = new Set<string>(["'self'"]);
  connectOrigins.add(toOrigin(config.apiBaseUrl));
  connectOrigins.add(toOrigin(config.realtimeUrl));
  return Object.freeze(Array.from(connectOrigins));
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
  const connectTokens = getExpectedConnectSrcTokens(config);

  const directives: readonly string[] = [
    "default-src 'none'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectTokens.join(' ')}`,
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

export interface CustomHttpHeaderEntry {
  readonly key: string;
  readonly value: string;
}

export interface CustomHttpRule {
  readonly pattern: string;
  readonly headers: readonly CustomHttpHeaderEntry[];
}

export interface CustomHttpConfig {
  readonly customHeaders: readonly CustomHttpRule[];
}

function parseYamlScalar(raw: string, lineNumber: number): string {
  const trimmed = raw.trim();
  if (trimmed === '') {
    throw new Error(`customHttp.yml line ${lineNumber}: empty scalar value.`);
  }
  if (trimmed.startsWith('"')) {
    if (!trimmed.endsWith('"') || trimmed.length < 2) {
      throw new Error(
        `customHttp.yml line ${lineNumber}: unterminated double-quoted string.`,
      );
    }
    const inner = trimmed.slice(1, -1);
    let result = '';
    for (let index = 0; index < inner.length; index += 1) {
      const char = inner[index];
      if (char === '\\') {
        const next = inner[index + 1];
        if (next === '"' || next === '\\') {
          result += next;
          index += 1;
          continue;
        }
        throw new Error(
          `customHttp.yml line ${lineNumber}: unsupported escape sequence "\\${next ?? ''}".`,
        );
      }
      if (char === '"') {
        throw new Error(
          `customHttp.yml line ${lineNumber}: unescaped double quote inside string.`,
        );
      }
      result += char;
    }
    return result;
  }

  if (trimmed.startsWith("'")) {
    if (!trimmed.endsWith("'") || trimmed.length < 2) {
      throw new Error(
        `customHttp.yml line ${lineNumber}: unterminated single-quoted string.`,
      );
    }
    const inner = trimmed.slice(1, -1);
    let result = '';
    for (let index = 0; index < inner.length; index += 1) {
      const char = inner[index];
      if (char === "'") {
        if (inner[index + 1] === "'") {
          result += "'";
          index += 1;
          continue;
        }
        throw new Error(
          `customHttp.yml line ${lineNumber}: unescaped single quote inside string.`,
        );
      }
      result += char;
    }
    return result;
  }

  if (/[:[\]{}#&*!|>'"%@`]/.test(trimmed)) {
    throw new Error(
      `customHttp.yml line ${lineNumber}: unquoted scalar "${trimmed}" contains reserved YAML syntax characters.`,
    );
  }
  return trimmed;
}

/**
 * Strictly parses the AWS Amplify Hosting `customHttp.yml` grammar.
 * Rejects any unknown keys, invalid indentation, unclosed quotes, or trailing syntax errors.
 */
export function parseCustomHttpYaml(yamlText: string): CustomHttpConfig {
  const normalized = yamlText.replaceAll('\r\n', '\n');
  const lines = normalized.split('\n');

  let state:
    | 'before_root'
    | 'after_custom_headers'
    | 'after_pattern'
    | 'in_headers'
    | 'expect_value' = 'before_root';

  const rules: { pattern: string; headers: CustomHttpHeaderEntry[] }[] = [];
  let currentRule: {
    pattern: string;
    headers: CustomHttpHeaderEntry[];
  } | null = null;
  let pendingHeaderKey: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index] ?? '';
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    if (state === 'before_root') {
      if (line !== 'customHeaders:') {
        throw new Error(
          `customHttp.yml line ${lineNumber}: expected top-level "customHeaders:", got "${line}".`,
        );
      }
      state = 'after_custom_headers';
      continue;
    }

    if (state === 'expect_value') {
      const valueMatch = /^ {8}value:\s*(.+)$/.exec(line);
      if (!valueMatch || pendingHeaderKey === null || currentRule === null) {
        throw new Error(
          `customHttp.yml line ${lineNumber}: expected "        value: <string>" for header "${pendingHeaderKey ?? ''}", got "${line}".`,
        );
      }
      const parsedValue = parseYamlScalar(valueMatch[1] ?? '', lineNumber);
      currentRule.headers.push({
        key: pendingHeaderKey,
        value: parsedValue,
      });
      pendingHeaderKey = null;
      state = 'in_headers';
      continue;
    }

    if (state === 'after_custom_headers' || state === 'in_headers') {
      const patternMatch = /^ {2}- pattern:\s*(.+)$/.exec(line);
      if (patternMatch) {
        const patternValue = parseYamlScalar(patternMatch[1] ?? '', lineNumber);
        currentRule = { pattern: patternValue, headers: [] };
        rules.push(currentRule);
        state = 'after_pattern';
        continue;
      }
    }

    if (state === 'after_pattern') {
      if (line !== '    headers:') {
        throw new Error(
          `customHttp.yml line ${lineNumber}: expected "    headers:" after pattern, got "${line}".`,
        );
      }
      state = 'in_headers';
      continue;
    }

    if (state === 'in_headers') {
      const keyMatch = /^ {6}- key:\s*(.+)$/.exec(line);
      if (keyMatch) {
        pendingHeaderKey = parseYamlScalar(keyMatch[1] ?? '', lineNumber);
        state = 'expect_value';
        continue;
      }
    }

    throw new Error(
      `customHttp.yml line ${lineNumber}: unexpected or malformed YAML line "${line}".`,
    );
  }

  if (state === 'before_root' || rules.length === 0) {
    throw new Error(
      'customHttp.yml must define at least one customHeaders rule.',
    );
  }

  if (state === 'expect_value' || state === 'after_pattern') {
    throw new Error(
      'customHttp.yml ended unexpectedly with an incomplete header entry.',
    );
  }

  return Object.freeze({
    customHeaders: Object.freeze(
      rules.map((rule) =>
        Object.freeze({
          pattern: rule.pattern,
          headers: Object.freeze([...rule.headers]),
        }),
      ),
    ),
  });
}

export interface ValidateBuiltHtmlAndHeadersOptions {
  readonly indexHtml: string;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly customHttpYaml?: string;
  readonly expectedConfig?: PublicConfig;
}

const SCRIPT_TAG_REGEX = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const SRC_ATTR_REGEX = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/i;
const INLINE_EVENT_HANDLER_REGEX =
  /<[a-zA-Z][^>]*\bon[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+)/i;
const JAVASCRIPT_URL_REGEX =
  /\b(?:href|src|action|formaction)\s*=\s*(?:"\s*javascript:|'\s*javascript:|javascript:)/i;

function isValidConnectOriginToken(token: string): boolean {
  if (token === "'self'") {
    return true;
  }
  try {
    const parsed = new URL(token);
    return (
      ['http:', 'https:', 'ws:', 'wss:'].includes(parsed.protocol) &&
      parsed.hostname !== '' &&
      parsed.origin === token &&
      parsed.pathname === '/' &&
      parsed.search === '' &&
      parsed.hash === ''
    );
  } catch {
    return false;
  }
}

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
  expectedConfig: PublicConfig | undefined,
  violations: string[],
): void {
  const csp = headers['Content-Security-Policy'];
  if (!csp || csp.trim() === '') {
    violations.push('Missing Content-Security-Policy header.');
  } else {
    const rawDirectives = csp
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part !== '');
    const seenDirectives = new Set<string>();

    for (const rawDirective of rawDirectives) {
      const name = rawDirective.split(/\s+/)[0]?.toLowerCase() ?? '';
      if (seenDirectives.has(name)) {
        violations.push(
          `Content-Security-Policy contains duplicate directive "${name}".`,
        );
      }
      seenDirectives.add(name);
      if (!ALLOWED_CSP_DIRECTIVE_SET.has(name)) {
        violations.push(
          `Content-Security-Policy contains disallowed or override directive "${name}" (only ${ALLOWED_CSP_DIRECTIVE_NAMES.join(', ')} are permitted).`,
        );
      }
    }

    const directives = parseContentSecurityPolicy(csp);

    for (const [name, tokens] of directives.entries()) {
      if (tokens.includes("'unsafe-eval'")) {
        violations.push(
          `Content-Security-Policy directive "${name}" must not allow 'unsafe-eval'.`,
        );
      }
    }

    const requiredExactDirectives: ReadonlyArray<
      readonly [string, readonly string[]]
    > = [
      ['default-src', ["'none'"]],
      ['script-src', ["'self'", "'wasm-unsafe-eval'"]],
      ['style-src', ["'self'", "'unsafe-inline'"]],
      ['img-src', ["'self'", 'data:', 'blob:']],
      ['font-src', ["'self'"]],
      ['worker-src', ["'self'", 'blob:']],
      ['manifest-src', ["'self'"]],
      ['form-action', ["'self'"]],
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
        if (
          directiveName === 'script-src' &&
          actual?.includes("'unsafe-inline'")
        ) {
          violations.push(
            "Content-Security-Policy script-src must not allow 'unsafe-inline'.",
          );
        }
        violations.push(
          `Content-Security-Policy directive "${directiveName}" must be "${expectedTokens.join(' ')}".`,
        );
      }
    }

    const connectSrc = directives.get('connect-src');
    if (!connectSrc || !connectSrc.includes("'self'")) {
      violations.push(
        "Content-Security-Policy connect-src must include 'self'.",
      );
    } else {
      for (const token of connectSrc) {
        if (!isValidConnectOriginToken(token)) {
          violations.push(
            `Content-Security-Policy connect-src contains invalid or overly broad source "${token}"; only "'self'" and explicit http(s)/ws(s) origins are allowed.`,
          );
        }
      }
      if (expectedConfig !== undefined) {
        const expectedConnect = getExpectedConnectSrcTokens(expectedConfig);
        if (
          connectSrc.length !== expectedConnect.length ||
          expectedConnect.some((token, index) => connectSrc[index] !== token)
        ) {
          violations.push(
            `Content-Security-Policy connect-src ("${connectSrc.join(' ')}") does not match expected configured origins ("${expectedConnect.join(' ')}").`,
          );
        }
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
  let parsed: CustomHttpConfig;
  try {
    parsed = parseCustomHttpYaml(customHttpYaml);
  } catch (error) {
    violations.push(error instanceof Error ? error.message : String(error));
    return;
  }

  if (parsed.customHeaders.length !== 1) {
    violations.push(
      `customHttp.yml must contain exactly 1 customHeaders rule (got ${parsed.customHeaders.length}).`,
    );
    return;
  }

  const rule = parsed.customHeaders[0];
  if (!rule || rule.pattern !== '**/*') {
    violations.push('customHttp.yml rule must declare pattern "**/*".');
    return;
  }

  const seenKeys = new Set<string>();
  for (const entry of rule.headers) {
    if (seenKeys.has(entry.key)) {
      violations.push(
        `customHttp.yml contains duplicate header key "${entry.key}".`,
      );
    }
    seenKeys.add(entry.key);
  }

  for (const key of SECURITY_HEADER_NAMES) {
    const expectedValue = headers[key];
    const matchingEntry = rule.headers.find((entry) => entry.key === key);
    if (!matchingEntry) {
      violations.push(`customHttp.yml is missing required header "${key}".`);
      continue;
    }
    if (expectedValue !== undefined && matchingEntry.value !== expectedValue) {
      violations.push(
        `customHttp.yml value for header "${key}" does not match the active security policy.`,
      );
    }
  }

  if (rule.headers.length !== SECURITY_HEADER_NAMES.length) {
    violations.push(
      `customHttp.yml contains unexpected headers (expected ${SECURITY_HEADER_NAMES.length}, got ${rule.headers.length}).`,
    );
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
  validateHeaders(options.headers, options.expectedConfig, violations);

  if (options.customHttpYaml !== undefined) {
    validateCustomHttpYaml(options.customHttpYaml, options.headers, violations);
  }

  if (violations.length > 0) {
    throw new SecurityPolicyViolationError(violations);
  }
}
