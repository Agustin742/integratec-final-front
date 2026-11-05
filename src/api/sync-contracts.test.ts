// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BACKEND_ARTIFACT_PATHS,
  ContractSyncError,
  DEFAULT_BACKEND_BRANCH,
  DEFAULT_BACKEND_REPO,
  FRONTEND_OUTPUT_PATHS,
  GENERATED_HEADER,
  formatPulledTypeArtifact,
  parseAndValidateOpenApiDocument,
  parseSyncCliArgs,
  resolveArtifactSource,
  syncContracts,
} from '../../scripts/api-sync/sync-contracts.mjs';

const SAMPLE_OPENAPI = {
  openapi: '3.0.0',
  info: {
    title: 'Aula Virtual API',
    version: '0.1.0',
  },
  paths: {
    '/health': {
      get: {
        operationId: 'HealthController_getHealth',
        responses: {
          '200': {
            description: 'The API process is alive.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthStatus',
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      HealthStatus: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['ok', 'error'] },
          service: { type: 'string' },
          timestamp: { type: 'string', format: 'date-time' },
        },
        required: ['status', 'service', 'timestamp'],
      },
    },
  },
};

const SAMPLE_CONTRACTS_TS = [
  'export interface HealthStatus {',
  "  status: 'ok' | 'error';",
  '  service: string;',
  '  timestamp: string;',
  '}',
  '',
  "export type UserRole = 'TEACHER' | 'STUDENT' | 'PARENT' | 'SCHOOL_ADMIN';",
  '',
].join('\n');

describe('sync-contracts', () => {
  const tempDirs: string[] = [];

  async function createTempDir(prefix: string): Promise<string> {
    const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(async () => {
    await Promise.all(
      tempDirs
        .splice(0)
        .map((dir) => rm(dir, { recursive: true, force: true })),
    );
  });

  describe('resolveArtifactSource & parseSyncCliArgs', () => {
    it('resolves raw GitHub URLs on the default backend repo and develop branch when no local checkout is passed', () => {
      const resolved = resolveArtifactSource(BACKEND_ARTIFACT_PATHS.openapi);

      expect(resolved).toEqual({
        mode: 'remote',
        artifactPath: 'apps/api/openapi.json',
        location: `https://raw.githubusercontent.com/${DEFAULT_BACKEND_REPO}/${DEFAULT_BACKEND_BRANCH}/apps/api/openapi.json`,
      });
    });

    it('resolves a local filesystem path when --backend-dir is provided', () => {
      const backendDir = path.resolve('/tmp/integratec-final-back');
      const resolved = resolveArtifactSource(BACKEND_ARTIFACT_PATHS.openapi, {
        backendDir,
      });

      expect(resolved).toEqual({
        mode: 'local',
        artifactPath: 'apps/api/openapi.json',
        location: path.resolve(backendDir, 'apps/api/openapi.json'),
      });
    });

    it('parses CLI flags (--backend-dir, --branch, --repo) and environment defaults', () => {
      expect(parseSyncCliArgs([], {})).toEqual({
        repo: DEFAULT_BACKEND_REPO,
        branch: DEFAULT_BACKEND_BRANCH,
      });

      expect(
        parseSyncCliArgs(
          [
            '--backend-dir',
            '../integratec-final-back',
            '--branch',
            'feat/contracts',
            '--repo=org/custom-back',
          ],
          {},
        ),
      ).toEqual({
        backendDir: '../integratec-final-back',
        branch: 'feat/contracts',
        repo: 'org/custom-back',
      });

      expect(
        parseSyncCliArgs([], {
          BACKEND_CHECKOUT_DIR: '/work/backend',
          BACKEND_BRANCH: 'main',
        }),
      ).toEqual({
        backendDir: '/work/backend',
        branch: 'main',
        repo: DEFAULT_BACKEND_REPO,
      });
    });

    it('rejects unknown CLI flags or missing flag values with ContractSyncError', () => {
      expect(() => parseSyncCliArgs(['--backend-dir'], {})).toThrowError(
        ContractSyncError,
      );
      expect(() => parseSyncCliArgs(['--unknown-flag'], {})).toThrow(
        /Unknown argument "--unknown-flag"/,
      );
    });
  });

  describe('deterministic local checkout synchronization', () => {
    it('regenerates src/api/ and src/realtime/ deterministically with zero diff on a second run and tolerates missing room-state artifacts', async () => {
      const backendDir = await createTempDir('backend-checkout-');
      const frontendDir = await createTempDir('frontend-checkout-');

      const openApiFile = path.join(backendDir, BACKEND_ARTIFACT_PATHS.openapi);
      const contractsFile = path.join(
        backendDir,
        BACKEND_ARTIFACT_PATHS.contracts,
      );

      await mkdir(path.dirname(openApiFile), { recursive: true });
      await mkdir(path.dirname(contractsFile), { recursive: true });
      await writeFile(openApiFile, JSON.stringify(SAMPLE_OPENAPI, null, 2));
      await writeFile(contractsFile, SAMPLE_CONTRACTS_TS);

      const warningsFirstRun: string[] = [];
      const firstResult = await syncContracts({
        backendDir,
        rootDir: frontendDir,
        logger: {
          warn: (msg) => warningsFirstRun.push(msg),
        },
      });

      expect(
        firstResult.syncedFiles.map((item) => item.relativeOutputPath),
      ).toEqual([
        FRONTEND_OUTPUT_PATHS.openapi,
        FRONTEND_OUTPUT_PATHS.contracts,
      ]);
      expect(firstResult.warnings).toHaveLength(1);
      expect(firstResult.warnings[0]).toContain(
        BACKEND_ARTIFACT_PATHS.realtimeState,
      );
      expect(firstResult.warnings[0]).toContain('not yet published');
      expect(warningsFirstRun).toEqual(firstResult.warnings);

      const generatedOpenApiFirst = await readFile(
        path.join(frontendDir, FRONTEND_OUTPUT_PATHS.openapi),
        'utf8',
      );
      const generatedContractsFirst = await readFile(
        path.join(frontendDir, FRONTEND_OUTPUT_PATHS.contracts),
        'utf8',
      );

      expect(generatedOpenApiFirst.startsWith(GENERATED_HEADER)).toBe(true);
      expect(generatedOpenApiFirst).toContain('HealthController_getHealth');
      expect(generatedOpenApiFirst).toContain('HealthStatus');
      expect(generatedOpenApiFirst).not.toContain('\r\n');

      expect(generatedContractsFirst.startsWith(GENERATED_HEADER)).toBe(true);
      expect(generatedContractsFirst).toContain('export type UserRole');
      expect(generatedContractsFirst).not.toContain('\r\n');

      // Second consecutive run against the same checkout must produce identical bytes (zero diff)
      await syncContracts({
        backendDir,
        rootDir: frontendDir,
      });

      const generatedOpenApiSecond = await readFile(
        path.join(frontendDir, FRONTEND_OUTPUT_PATHS.openapi),
        'utf8',
      );
      const generatedContractsSecond = await readFile(
        path.join(frontendDir, FRONTEND_OUTPUT_PATHS.contracts),
        'utf8',
      );

      expect(generatedOpenApiSecond).toBe(generatedOpenApiFirst);
      expect(generatedContractsSecond).toBe(generatedContractsFirst);
    });

    it('syncs Colyseus room-state artifacts when published in the backend checkout', async () => {
      const backendDir = await createTempDir('backend-with-realtime-');
      const frontendDir = await createTempDir('frontend-with-realtime-');

      const openApiFile = path.join(backendDir, BACKEND_ARTIFACT_PATHS.openapi);
      const contractsFile = path.join(
        backendDir,
        BACKEND_ARTIFACT_PATHS.contracts,
      );
      const realtimeStateFile = path.join(
        backendDir,
        BACKEND_ARTIFACT_PATHS.realtimeState,
      );

      await mkdir(path.dirname(openApiFile), { recursive: true });
      await mkdir(path.dirname(contractsFile), { recursive: true });
      await mkdir(path.dirname(realtimeStateFile), { recursive: true });

      await writeFile(openApiFile, JSON.stringify(SAMPLE_OPENAPI));
      await writeFile(contractsFile, SAMPLE_CONTRACTS_TS);
      await writeFile(
        realtimeStateFile,
        'export interface ClassroomRoomState {\n  roomId: string;\n}\n',
      );

      const result = await syncContracts({
        backendDir,
        rootDir: frontendDir,
      });

      expect(result.warnings).toEqual([]);
      expect(result.syncedFiles.map((item) => item.relativeOutputPath)).toEqual(
        [
          FRONTEND_OUTPUT_PATHS.openapi,
          FRONTEND_OUTPUT_PATHS.contracts,
          FRONTEND_OUTPUT_PATHS.realtimeState,
        ],
      );

      const syncedRoomState = await readFile(
        path.join(frontendDir, FRONTEND_OUTPUT_PATHS.realtimeState),
        'utf8',
      );
      expect(syncedRoomState.startsWith(GENERATED_HEADER)).toBe(true);
      expect(syncedRoomState).toContain('export interface ClassroomRoomState');
    });
  });

  describe('failure diagnostics (offline, missing file, invalid JSON, non-OpenAPI JSON)', () => {
    it('fails with a clear message when the backend OpenAPI artifact is missing locally (ENOENT)', async () => {
      const emptyBackendDir = await createTempDir('empty-backend-');
      const frontendDir = await createTempDir('frontend-missing-');

      await expect(
        syncContracts({
          backendDir: emptyBackendDir,
          rootDir: frontendDir,
        }),
      ).rejects.toThrowError(
        expect.objectContaining({
          name: 'ContractSyncError',
          code: 'ARTIFACT_MISSING',
          message: expect.stringContaining(
            'Backend OpenAPI artifact is not yet published or could not be found at "apps/api/openapi.json"',
          ),
        }),
      );
    });

    it('fails with a clear message when the backend OpenAPI artifact returns HTTP 404 remotely', async () => {
      const frontendDir = await createTempDir('frontend-404-');
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response('Not Found', { status: 404, statusText: 'Not Found' }),
        );

      await expect(
        syncContracts({
          rootDir: frontendDir,
          fetchImpl: fetchMock,
        }),
      ).rejects.toThrowError(
        expect.objectContaining({
          name: 'ContractSyncError',
          code: 'ARTIFACT_MISSING',
          message: expect.stringContaining(
            `https://raw.githubusercontent.com/${DEFAULT_BACKEND_REPO}/${DEFAULT_BACKEND_BRANCH}/apps/api/openapi.json`,
          ),
        }),
      );
    });

    it('fails with a clear network/offline error message and suggests --backend-dir when fetch rejects', async () => {
      const frontendDir = await createTempDir('frontend-offline-');
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockRejectedValue(
          new TypeError('fetch failed: ENOTFOUND raw.githubusercontent.com'),
        );

      await expect(
        syncContracts({
          rootDir: frontendDir,
          fetchImpl: fetchMock,
        }),
      ).rejects.toThrowError(
        expect.objectContaining({
          name: 'ContractSyncError',
          code: 'NETWORK_ERROR',
          message: expect.stringMatching(
            /network or offline error.*--backend-dir <path>/,
          ),
        }),
      );
    });

    it('fails with a clear message when openapi.json contains malformed JSON', async () => {
      const backendDir = await createTempDir('backend-bad-json-');
      const frontendDir = await createTempDir('frontend-bad-json-');
      const openApiFile = path.join(backendDir, BACKEND_ARTIFACT_PATHS.openapi);

      await mkdir(path.dirname(openApiFile), { recursive: true });
      await writeFile(openApiFile, '{ "openapi": "3.0.0", invalid json ');

      await expect(
        syncContracts({
          backendDir,
          rootDir: frontendDir,
        }),
      ).rejects.toThrowError(
        expect.objectContaining({
          name: 'ContractSyncError',
          code: 'INVALID_JSON',
          message: expect.stringContaining(
            'Invalid JSON in backend OpenAPI artifact "apps/api/openapi.json"',
          ),
        }),
      );
    });

    it('fails with a clear message when JSON is valid but not an OpenAPI 3.x specification', () => {
      expect(() =>
        parseAndValidateOpenApiDocument(JSON.stringify({ hello: 'world' }), {
          artifactPath: 'apps/api/openapi.json',
          location: '/tmp/openapi.json',
        }),
      ).toThrowError(
        expect.objectContaining({
          name: 'ContractSyncError',
          code: 'INVALID_OPENAPI',
          message: expect.stringContaining(
            'not a valid OpenAPI 3.x specification',
          ),
        }),
      );
    });

    it(' avoids duplicating the generated banner when formatting an already-bannered contract file', () => {
      const once = formatPulledTypeArtifact(
        SAMPLE_CONTRACTS_TS,
        BACKEND_ARTIFACT_PATHS.contracts,
      );
      const twice = formatPulledTypeArtifact(
        once,
        BACKEND_ARTIFACT_PATHS.contracts,
      );

      expect(twice).toBe(once);
    });
  });
});
