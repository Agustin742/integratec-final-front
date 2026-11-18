import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AVATAR_GLB_MAX_BYTES,
  BUDGET_EXCEPTIONS,
  SCENE_GLB_MAX_BYTES,
  checkAssetBudgets,
  formatAssetBudgetReport,
  parseCliArgs,
} from '../../../scripts/assets/check-asset-budget.mjs';

describe('checkAssetBudgets', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  function makeTempModelsDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'assets-budget-test-'));
    tempDirs.push(dir);
    return dir;
  }

  it('passes when avatar and scene GLBs stay within FD8 budgets', () => {
    const dir = makeTempModelsDir();
    mkdirSync(join(dir, 'avatars'), { recursive: true });
    mkdirSync(join(dir, 'scenes'), { recursive: true });
    writeFileSync(join(dir, 'avatars', 'student.glb'), Buffer.alloc(1024));
    writeFileSync(join(dir, 'scenes', 'classroom.glb'), Buffer.alloc(4096));

    const result = checkAssetBudgets({ modelsDir: dir });
    expect(result.ok).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(formatAssetBudgetReport(result)).toContain('Passed: all 2 model(s)');
  });

  it('fails with a per-file report when an avatar GLB exceeds 1 MB', () => {
    const dir = makeTempModelsDir();
    mkdirSync(join(dir, 'avatars'), { recursive: true });
    writeFileSync(
      join(dir, 'avatars', 'heavy-body.glb'),
      Buffer.alloc(AVATAR_GLB_MAX_BYTES + 1),
    );

    const result = checkAssetBudgets({ modelsDir: dir });
    expect(result.ok).toBe(false);
    expect(result.items[0]?.ok).toBe(false);
    const report = formatAssetBudgetReport(result);
    expect(report).toContain('FAIL (avatar) avatars/heavy-body.glb');
  });

  it('fails with a per-file report when a classroom scene GLB exceeds 8 MB', () => {
    const dir = makeTempModelsDir();
    mkdirSync(join(dir, 'scenes'), { recursive: true });
    writeFileSync(
      join(dir, 'scenes', 'classroom-full.glb'),
      Buffer.alloc(SCENE_GLB_MAX_BYTES + 1),
    );

    const result = checkAssetBudgets({ modelsDir: dir });
    expect(result.ok).toBe(false);
    expect(result.sceneTotalOk).toBe(false);
    const report = formatAssetBudgetReport(result);
    expect(report).toContain('FAIL (scene) scenes/classroom-full.glb');
  });

  it('rejects missing directories and invalid CLI arguments', () => {
    expect(() =>
      checkAssetBudgets({
        modelsDir: join(tmpdir(), 'nonexistent-models-dir-25'),
      }),
    ).toThrow(/Models directory not found/);
    expect(() => parseCliArgs(['--dir'])).toThrow(/Missing value for --dir/);
    expect(() => parseCliArgs(['--unknown'])).toThrow(/Unknown argument/);
    expect(parseCliArgs(['--dir=custom/models'])).toEqual({
      modelsDir: 'custom/models',
    });
  });

  it('passes public/models with recorded #91 exceptions and zero unexempted failures', () => {
    const result = checkAssetBudgets();
    expect(result.ok).toBe(true);
    const exceptionItems = result.items.filter(
      (item) => item.status === 'EXCEPTION',
    );
    expect(exceptionItems.map((item) => item.path).sort()).toEqual(
      Object.keys(BUDGET_EXCEPTIONS).sort(),
    );

    const report = formatAssetBudgetReport(result);
    for (const exceptionPath of Object.keys(BUDGET_EXCEPTIONS)) {
      expect(report).toContain(
        `[assets:check] EXCEPTION (avatar) ${exceptionPath}:`,
      );
      expect(report).toContain('(tracked in #91)');
    }
  });

  it('fails if an exempted file grows past its recorded ceiling or exceptions are disabled', () => {
    const dir = makeTempModelsDir();
    mkdirSync(join(dir, 'avatars', 'female'), { recursive: true });
    writeFileSync(
      join(dir, 'avatars', 'female', 'body.glb'),
      Buffer.alloc(BUDGET_EXCEPTIONS['avatars/female/body.glb'].maxBytes + 1),
    );

    const bloatedResult = checkAssetBudgets({
      modelsDir: dir,
      exceptions: BUDGET_EXCEPTIONS,
    });
    expect(bloatedResult.ok).toBe(false);
    expect(bloatedResult.items[0]?.status).toBe('FAIL');
    expect(formatAssetBudgetReport(bloatedResult)).toContain(
      'FAIL (avatar) avatars/female/body.glb',
    );

    const unexemptedDefault = checkAssetBudgets({ exceptions: {} });
    expect(unexemptedDefault.ok).toBe(false);

    const customDirWithoutExceptions = makeTempModelsDir();
    mkdirSync(join(customDirWithoutExceptions, 'avatars', 'female'), {
      recursive: true,
    });
    writeFileSync(
      join(customDirWithoutExceptions, 'avatars', 'female', 'body.glb'),
      Buffer.alloc(AVATAR_GLB_MAX_BYTES + 1),
    );
    expect(
      checkAssetBudgets({ modelsDir: customDirWithoutExceptions }).ok,
    ).toBe(false);
  });
});
