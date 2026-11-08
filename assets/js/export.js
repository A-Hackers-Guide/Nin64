/* export.js — bundle this console's page into a single, offline-capable
 * standalone HTML. The exported file can be opened directly from disk.
 *
 * Strategy: convert each ES module to a tiny CJS-like function body,
 * concatenate them with a minimal require() loader, and inline the whole
 * thing as one non-module <script>. CSS <link>s are inlined as <style>.
 *
 * External CDN scripts (e.g. EmulatorJS loader) are left as-is so they
 * still work when online.
 */

async function fetchText(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`Fetch ${url} → ${r.status}`);
  return await r.text();
}

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* Convert ES-module source → function body that populates module.exports. */
function esmToCjs(code) {
  // Collect names that get exported inline so we can emit module.exports.x = x at the bottom
  const exports = new Set();

  // export function foo / export async function foo
  code = code.replace(/^(\s*)export\s+(async\s+)?function\s+(\w+)/gm, (_, sp, a, n) => {
    exports.add(n); return `${sp}${a || ''}function ${n}`;
  });

  // export class Foo
  code = code.replace(/^(\s*)export\s+class\s+(\w+)/gm, (_, sp, n) => {
    exports.add(n); return `${sp}class ${n}`;
  });

  // export const foo = ... / export let / export var
  code = code.replace(/^(\s*)export\s+(const|let|var)\s+(\w+)/gm, (_, sp, k, n) => {
    exports.add(n); return `${sp}${k} ${n}`;
  });

  // export { foo, bar as baz }
  code = code.replace(/^(\s*)export\s*\{\s*([^}]+?)\s*\}\s*;?/gm, (_, sp, names) => {
    const lines = [];
    for (const raw of names.split(',')) {
      const s = raw.trim();
      if (!s) continue;
      const m = s.match(/^(\w+)(?:\s+as\s+(\w+))?$/);
      if (!m) continue;
      exports.add(m[2] || m[1]);
      if (m[2] && m[2] !== m[1]) lines.push(`${sp}module.exports[${JSON.stringify(m[2])}] = ${m[1]};`);
      else lines.push(`${sp}module.exports[${JSON.stringify(m[1])}] = ${m[1]};`);
    }
    return lines.join('\n');
  });

  // Transform imports:
  // import { a, b as c } from "x";
  // import foo from "x";
  // import * as ns from "x";
  // import "x";
  code = code.replace(
    /^(\s*)import\s+(?:(\{[^}]+\})|(\*\s+as\s+\w+)|(\w+))?(?:\s*,\s*(\{[^}]+\}|\w+))?\s*(?:from\s+)?['"]([^'"]+)['"]\s*;?/gm,
    (_, sp, named, nsImport, defName, extraImport, path) => {
      const mod = `__m_${path.replace(/[^A-Za-z0-9]/g, '_')}`;
      const out = [`${sp}const ${mod} = require(${JSON.stringify(path)});`];
      function unpack(bindings) {
        for (const raw of bindings.slice(1, -1).split(',')) {
          const s = raw.trim(); if (!s) continue;
          const m = s.match(/^(\w+)(?:\s+as\s+(\w+))?$/);
          if (m) out.push(`${sp}const ${m[2] || m[1]} = ${mod}[${JSON.stringify(m[1])}];`);
        }
      }
      if (named) unpack(named);
      if (defName) out.push(`${sp}const ${defName} = ${mod}.default;`);
      if (nsImport) {
        const name = nsImport.match(/as\s+(\w+)/)[1];
        out.push(`${sp}const ${name} = ${mod};`);
      }
      if (extraImport) {
        if (extraImport.startsWith('{')) unpack(extraImport);
        else out.push(`${sp}const ${extraImport} = ${mod}.default;`);
      }
      return out.join('\n');
    }
  );

  // Emit `module.exports.foo = foo` at the end for every inline-exported name
  if (exports.size) {
    code += '\n' + [...exports].map(n => `module.exports[${JSON.stringify(n)}] = ${n};`).join('\n');
  }
  return code;
}

/* Build the inline bootstrap that holds all modules. */
function buildBootstrap(modules, entryName) {
  // modules: { canonicalName: { code: cjsCode, paths: [originalImportPaths] } }
  // We give require() a map from "any path a module might have written" → canonicalName.
  const pathAlias = {};
  for (const [name, mod] of Object.entries(modules)) {
    pathAlias[name] = name;
    for (const p of mod.paths) pathAlias[p] = name;
  }

  const moduleTable = Object.fromEntries(
    Object.entries(modules).map(([n, m]) => [n, m.code])
  );

  // We use a function constructor to compile each module body with its own
  // `module` + `require` scope.
  return `
<script>
(function() {
  var __modules = ${JSON.stringify(moduleTable)};
  var __alias   = ${JSON.stringify(pathAlias)};
  var __cache   = {};
  function require(path) {
    var canon = __alias[path] || path;
    if (__cache[canon]) return __cache[canon].exports;
    var mod = __cache[canon] = { exports: {} };
    var fn = new Function('require', 'module', 'exports', __modules[canon]);
    try { fn(require, mod, mod.exports); }
    catch (e) { console.error('Module', canon, 'failed:', e); throw e; }
    return mod.exports;
  }
  try { require(${JSON.stringify(entryName)}); }
  catch (e) { document.body && (document.body.innerHTML = '<pre style="padding:20px;color:#f66">Bundle failed: ' + e.message + '</pre>'); }
})();
</script>`;
}

/* Canonicalize: basename without .js extension. */
function canonicalize(url) {
  return url.split('/').pop().replace(/\.js$/, '');
}

export async function exportConsole({ title, htmlUrl, cssUrls = [], jsModules = [] }) {
  let html = await fetchText(htmlUrl);

  // Inline <link rel="stylesheet" href="..."> tags for passed CSS files
  for (const url of cssUrls) {
    const text = await fetchText(url);
    const re = new RegExp(`<link[^>]*href=["']${esc(url)}["'][^>]*/?>`, 'g');
    html = html.replace(re, `<style>\n${text}\n</style>`);
  }

  // Collect module sources
  const modulesOut = {};
  for (const url of jsModules) {
    const name = canonicalize(url);
    const code = await fetchText(url);
    // Collect its original paths (for alias map)
    const paths = [];
    code.replace(/(?:import|from)\s*['"]([^'"]+)['"]/g, (_, p) => { paths.push(p); });
    paths.push(url); // self
    modulesOut[name] = { code: esmToCjs(code), paths };
  }

  const entryName = canonicalize(jsModules[0]);

  // Replace the entry's <script type="module" src="..."> tag with the bootstrap
  const entryRe = new RegExp(`<script[^>]*type=["']module["'][^>]*src=["']${esc(jsModules[0])}["'][^>]*>\\s*</script>`, 'g');
  const bootstrap = buildBootstrap(modulesOut, entryName);
  html = html.replace(entryRe, bootstrap);

  // Watermark
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  html = html.replace('</head>', `<meta name="exported-from" content="Nin64 — https://github.com/A-Hackers-Guide/Nin64"></head>`);

  // Download
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  const safe = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  a.download = `${safe || 'console'}.html`;
  document.body.appendChild(a);
  a.click();
  requestAnimationFrame(() => { a.remove(); URL.revokeObjectURL(u); });
}
