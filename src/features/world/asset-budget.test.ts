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

  it('passes public/models within FD8 limits and zero exceptions', () => {
    const result = checkAssetBudgets();
    expect(result.ok).toBe(true);
    expect(Object.keys(BUDGET_EXCEPTIONS)).toHaveLength(0);
    const exceptionItems = result.items.filter(
      (item) => item.status === 'EXCEPTION',
    );
    expect(exceptionItems).toHaveLength(0);

    const report = formatAssetBudgetReport(result);
    expect(report).toContain('within FD8 limits.');
  });

  it('fails if an exempted file grows past its recorded ceiling or exceptions are disabled', () => {
    const dir = makeTempModelsDir();
    mkdirSync(join(dir, 'avatars', 'female'), { recursive: true });
    const ceiling = AVATAR_GLB_MAX_BYTES + 256;
    const syntheticExceptions = {
      'avatars/female/body.glb': {
        path: 'avatars/female/body.glb',
        issue: '#91',
        maxBytes: ceiling,
      },
    };
    writeFileSync(
      join(dir, 'avatars', 'female', 'body.glb'),
      Buffer.alloc(ceiling + 1),
    );

    const bloatedResult = checkAssetBudgets({
      modelsDir: dir,
      exceptions: syntheticExceptions,
    });
    expect(bloatedResult.ok).toBe(false);
    expect(bloatedResult.items[0]?.status).toBe('FAIL');
    expect(formatAssetBudgetReport(bloatedResult)).toContain(
      'FAIL (avatar) avatars/female/body.glb',
    );

    const withinException = checkAssetBudgets({
      modelsDir: dir,
      exceptions: syntheticExceptions,
    });
    // Still fails above ceiling; verify a size at exact ceiling passes with EXCEPTION
    writeFileSync(
      join(dir, 'avatars', 'female', 'body.glb'),
      Buffer.alloc(ceiling),
    );
    const exempted = checkAssetBudgets({
      modelsDir: dir,
      exceptions: syntheticExceptions,
    });
    expect(exempted.ok).toBe(true);
    expect(exempted.items[0]?.status).toBe('EXCEPTION');
    expect(formatAssetBudgetReport(exempted)).toContain('(tracked in #91)');

    const unexempted = checkAssetBudgets({ modelsDir: dir, exceptions: {} });
    expect(unexempted.ok).toBe(false);
    expect(withinException.ok).toBe(false);
  });
});
