import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { build } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

/** Collects every file under `dir` recursively. */
function walkFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

/** Collects all 3D models and Draco decoder files required by the pitch deck. */
function collectEmbeddedAssets() {
  const classroomGlbs = [
    '/models/scenes/classroom/furniture/board.glb',
    '/models/scenes/classroom/interactive/bulletin-board.glb',
    '/models/scenes/classroom/furniture/teacher-desk.glb',
    '/models/scenes/classroom/furniture/bookshelf.glb',
    '/models/scenes/classroom/interactive/trophy-shelf.glb',
    '/models/scenes/classroom/interactive/report-card-stand.glb',
    '/models/scenes/classroom/interactive/shop-kiosk.glb',
    '/models/scenes/classroom/interactive/arcade-console.glb',
    '/models/scenes/classroom/decoration/garlands.glb',
    '/models/scenes/classroom/themes/space.glb',
    '/models/scenes/classroom/furniture/student-desk.glb',
    '/models/scenes/classroom/furniture/student-chair.glb',
    '/models/scenes/classroom/decoration/plants-and-pots.glb',
    '/models/scenes/classroom/decoration/globe.glb',
  ];

  const decoderFiles = [
    '/decoders/draco/draco_wasm_wrapper.js',
    '/decoders/draco/draco_decoder.wasm',
    '/decoders/draco/draco_decoder.js',
  ];

  // Collect all avatar GLBs referenced in pitch-script.ts + body GLBs
  const pitchScriptSource = fs.readFileSync(
    path.join(ROOT, 'src/features/pitch/pitch-script.ts'),
    'utf8',
  );

  const avatarsDir = path.join(ROOT, 'public/models/avatars');
  const allAvatarFiles = walkFiles(avatarsDir).map(
    (full) =>
      '/' +
      path.relative(path.join(ROOT, 'public'), full).replaceAll('\\', '/'),
  );

  const usedAvatarGlbs = allAvatarFiles.filter((relUrl) => {
    const base = path.basename(relUrl, '.glb'); // e.g. body, hair-long-wavy, top-hoodie, head-crown
    if (base === 'body') return true;
    const withoutPrefix = base.replace(/^(hair|top|head|face|back)-/, '');
    const underscoreCode = base.replaceAll('-', '_');
    return (
      pitchScriptSource.includes(`'${withoutPrefix}'`) ||
      pitchScriptSource.includes(`'${underscoreCode}'`) ||
      withoutPrefix === 'afro-with-headband'
    );
  });

  const urls = [
    ...new Set([...decoderFiles, ...classroomGlbs, ...usedAvatarGlbs]),
  ];
  const assetMap = {};
  let totalBytes = 0;

  for (const url of urls) {
    const fullPath = path.join(ROOT, 'public', url.replace(/^\//, ''));
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Missing required asset: ${fullPath}`);
    }
    const buf = fs.readFileSync(fullPath);
    totalBytes += buf.byteLength;
    assetMap[url] = buf.toString('base64');
  }

  console.log(
    `Embedded ${urls.length} 3D/decoder assets (${(totalBytes / 1024 / 1024).toFixed(2)} MB raw).`,
  );
  return assetMap;
}

async function main() {
  const assetMap = collectEmbeddedAssets();

  const result = await build({
    root: ROOT,
    configFile: false,
    logLevel: 'warn',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(ROOT, 'src'),
      },
    },
    define: {
      'import.meta.env.VITE_APP_ENV': JSON.stringify('development'),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
        'http://localhost:3000',
      ),
      'import.meta.env.VITE_REALTIME_URL': JSON.stringify(
        'ws://localhost:2567',
      ),
    },
    build: {
      write: false,
      assetsInlineLimit: 100 * 1024 * 1024,
      cssCodeSplit: false,
      rollupOptions: {
        input: path.join(ROOT, 'src/features/pitch/pitch-standalone.tsx'),
        output: {
          format: 'iife',
          name: 'BankitoPitch',
          inlineDynamicImports: true,
        },
      },
    },
  });

  const outputs = Array.isArray(result) ? result[0].output : result.output;
  let jsCode = '';
  let cssCode = '';

  for (const chunk of outputs) {
    if (chunk.type === 'chunk' && chunk.isEntry) {
      jsCode = chunk.code;
    } else if (chunk.type === 'asset' && chunk.fileName.endsWith('.css')) {
      cssCode +=
        typeof chunk.source === 'string'
          ? chunk.source
          : Buffer.from(chunk.source).toString('utf8');
    }
  }

  // Safely escape closing script tags inside JS bundle
  const safeJsCode = jsCode.replace(/<\/script>/gi, '<\\/script>');
  const safeAssetsJson = JSON.stringify(assetMap);

  const html = `<!doctype html>
<html lang="es-AR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Presentación · Bankito · Aula Virtual 3D</title>
    <style>${cssCode}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>
      (function () {
        var ASSETS = ${safeAssetsJson};
        function normalizeAssetKey(input) {
          var str = typeof input === 'string' ? input : (input && input.url) || String(input);
          try {
            var u = new URL(str, 'http://localhost');
            str = u.pathname;
          } catch (_e) {}
          var modelsIdx = str.indexOf('/models/');
          if (modelsIdx >= 0) return str.slice(modelsIdx);
          var decIdx = str.indexOf('/decoders/');
          if (decIdx >= 0) return str.slice(decIdx);
          return str;
        }
        function decodeBase64(b64) {
          var bin = atob(b64);
          var len = bin.length;
          var bytes = new Uint8Array(len);
          for (var i = 0; i < len; i++) {
            bytes[i] = bin.charCodeAt(i);
          }
          return bytes;
        }
        function mimeFor(key) {
          if (key.endsWith('.wasm')) return 'application/wasm';
          if (key.endsWith('.js')) return 'application/javascript';
          if (key.endsWith('.glb')) return 'model/gltf-binary';
          return 'application/octet-stream';
        }
        var origFetch = window.fetch ? window.fetch.bind(window) : null;
        window.fetch = function (input, init) {
          var key = normalizeAssetKey(input);
          var b64 = ASSETS[key];
          if (b64) {
            var bytes = decodeBase64(b64);
            return Promise.resolve(
              new Response(bytes.buffer, {
                status: 200,
                headers: {
                  'Content-Type': mimeFor(key),
                  'Content-Length': String(bytes.byteLength),
                },
              }),
            );
          }
          if (origFetch) return origFetch(input, init);
          return Promise.reject(new Error('Asset not found: ' + key));
        };
      })();
    </script>
    <script>${safeJsCode}</script>
  </body>
</html>
`;

  const cleanHtml = html.replace(/[ \t]+$/gm, '');
  const outDocs = path.join(ROOT, 'docs/pitch/presentacion-aula-virtual.html');
  fs.writeFileSync(outDocs, cleanHtml, 'utf8');

  console.log(
    `Written self-contained HTML (${(Buffer.byteLength(cleanHtml) / 1024 / 1024).toFixed(2)} MB):\n  - ${outDocs}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
