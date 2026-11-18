export declare const AVATAR_GLB_MAX_BYTES: number;
export declare const SCENE_GLB_MAX_BYTES: number;

export interface AssetBudgetItem {
  readonly path: string;
  readonly category: 'avatar' | 'scene';
  readonly sizeBytes: number;
  readonly limitBytes: number;
  readonly ok: boolean;
}

export interface AssetBudgetResult {
  readonly modelsDir: string;
  readonly items: readonly AssetBudgetItem[];
  readonly sceneTotalBytes: number;
  readonly sceneMaxBytes: number;
  readonly sceneTotalOk: boolean;
  readonly ok: boolean;
}

export declare function checkAssetBudgets(options?: {
  readonly modelsDir?: string;
  readonly avatarMaxBytes?: number;
  readonly sceneMaxBytes?: number;
}): AssetBudgetResult;

export declare function formatAssetBudgetReport(
  result: AssetBudgetResult,
): string;

export declare function parseCliArgs(argv: readonly string[]): {
  readonly modelsDir: string | undefined;
};
