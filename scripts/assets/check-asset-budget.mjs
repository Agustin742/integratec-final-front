import { readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const AVATAR_GLB_MAX_BYTES = 1024 * 1024; // 1 MiB (FD8)
export const SCENE_GLB_MAX_BYTES = 8 * 1024 * 1024; // 8 MiB (FD8)

function isModelFile(filename) {
  const lower = filename.toLowerCase();
  return lower.endsWith('.glb') || lower.endsWith('.gltf');
}

function collectModelFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectModelFiles(fullPath));
    } else if (entry.isFile() && isModelFile(entry.name)) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

function isSceneAsset(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase();
  return (
    normalized.startsWith('scenes/') ||
    normalized.includes('/scenes/') ||
    normalized.includes('classroom') ||
    normalized.includes('scene')
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function checkAssetBudgets(options = {}) {
  const modelsDir = resolve(options.modelsDir ?? 'public/models');
  const avatarMaxBytes = options.avatarMaxBytes ?? AVATAR_GLB_MAX_BYTES;
  const sceneMaxBytes = options.sceneMaxBytes ?? SCENE_GLB_MAX_BYTES;

  const files = collectModelFiles(modelsDir);
  const items = [];
  let sceneTotalBytes = 0;

  for (const filePath of files) {
    const relPath = relative(modelsDir, filePath).replace(/\\/g, '/');
    const sizeBytes = statSync(filePath).size;
    const category = isSceneAsset(relPath) ? 'scene' : 'avatar';
    const limitBytes = category === 'scene' ? sceneMaxBytes : avatarMaxBytes;
    if (category === 'scene') {
      sceneTotalBytes += sizeBytes;
    }
    items.push({
      path: relPath,
      category,
      sizeBytes,
      limitBytes,
      ok: sizeBytes <= limitBytes,
    });
  }

  const sceneTotalOk = sceneTotalBytes <= sceneMaxBytes;
  const ok = items.every((item) => item.ok) && sceneTotalOk;

  return {
    modelsDir,
    items,
    sceneTotalBytes,
    sceneMaxBytes,
    sceneTotalOk,
    ok,
  };
}

export function formatAssetBudgetReport(result) {
  const lines = [];
  if (result.items.length === 0) {
    lines.push(
      `[assets:check] No .glb/.gltf files found under ${result.modelsDir}.`,
    );
    return lines.join('\n');
  }

  for (const item of result.items) {
    const status = item.ok ? 'PASS' : 'FAIL';
    lines.push(
      `[assets:check] ${status} (${item.category}) ${item.path}: ${formatSize(item.sizeBytes)} / ${formatSize(item.limitBytes)}`,
    );
  }

  if (result.sceneTotalBytes > 0) {
    const sceneStatus = result.sceneTotalOk ? 'PASS' : 'FAIL';
    lines.push(
      `[assets:check] ${sceneStatus} (scene-total): ${formatSize(result.sceneTotalBytes)} / ${formatSize(result.sceneMaxBytes)}`,
    );
  }

  if (!result.ok) {
    const failedCount =
      result.items.filter((item) => !item.ok).length +
      (result.sceneTotalOk ? 0 : 1);
    lines.push(
      `[assets:check] Failed: ${failedCount} asset budget check(s) exceeded FD8 limits.`,
    );
  } else {
    lines.push(
      `[assets:check] Passed: all ${result.items.length} model(s) within FD8 limits.`,
    );
  }

  return lines.join('\n');
}

function parseCliArgs(argv) {
  let modelsDir;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dir' && argv[i + 1]) {
      modelsDir = argv[i + 1];
      i += 1;
    }
  }
  return { modelsDir };
}

const isEntrypoint =
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isEntrypoint) {
  const { modelsDir } = parseCliArgs(process.argv.slice(2));
  const result = checkAssetBudgets({ modelsDir });
  const report = formatAssetBudgetReport(result);
  if (result.ok) {
    console.log(report);
  } else {
    console.error(report);
    process.exitCode = 1;
  }
}
