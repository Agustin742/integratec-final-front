export const DEFAULT_BACKEND_REPO: string;
export const DEFAULT_BACKEND_BRANCH: string;

export const BACKEND_ARTIFACT_PATHS: Readonly<{
  openapi: string;
  contracts: string;
  realtimeState: string;
}>;

export const FRONTEND_OUTPUT_PATHS: Readonly<{
  openapi: string;
  contracts: string;
  realtimeState: string;
}>;

export const GENERATED_HEADER: string;

export type ContractSyncErrorCode =
  | 'CLI_ARG_ERROR'
  | 'ARTIFACT_MISSING'
  | 'NETWORK_ERROR'
  | 'INVALID_JSON'
  | 'INVALID_OPENAPI';

export class ContractSyncError extends Error {
  readonly code: ContractSyncErrorCode;
  readonly artifactPath?: string;
  readonly sourceLocation?: string;
  constructor(
    message: string,
    details: {
      code: ContractSyncErrorCode;
      artifactPath?: string;
      sourceLocation?: string;
      cause?: unknown;
    },
  );
}

export interface ArtifactSource {
  mode: 'local' | 'remote';
  artifactPath: string;
  location: string;
}

export function normalizeLineEndings(content: string): string;
export function buildGeneratedFileBanner(artifactPath: string): string;

export function resolveArtifactSource(
  artifactPath: string,
  options?: {
    backendDir?: string;
    repo?: string;
    branch?: string;
  },
): ArtifactSource;

export function parseSyncCliArgs(
  argv: readonly string[],
  env?: Record<string, string | undefined>,
): {
  backendDir?: string;
  repo: string;
  branch: string;
};

export function readArtifactContent(
  source: ArtifactSource,
  options?: { fetchImpl?: typeof fetch },
): Promise<
  | { found: true; content: string; source: ArtifactSource }
  | { found: false; source: ArtifactSource }
>;

export function parseAndValidateOpenApiDocument(
  rawText: string,
  source: { artifactPath: string; location: string },
): Record<string, unknown>;

export function generateOpenApiTypes(
  openApiDocument: Record<string, unknown>,
  artifactPath?: string,
): Promise<string>;

export function formatPulledTypeArtifact(
  rawSource: string,
  artifactPath: string,
): string;

export interface SyncedFileRecord {
  kind: string;
  source: string;
  outputPath: string;
  relativeOutputPath: string;
}

export function syncContracts(options?: {
  backendDir?: string;
  repo?: string;
  branch?: string;
  rootDir?: string;
  artifactPaths?: Partial<typeof BACKEND_ARTIFACT_PATHS>;
  outputPaths?: Partial<typeof FRONTEND_OUTPUT_PATHS>;
  fetchImpl?: typeof fetch;
  logger?: {
    info?: (msg: string) => void;
    warn?: (msg: string) => void;
  };
}): Promise<{
  syncedFiles: SyncedFileRecord[];
  warnings: string[];
}>;
