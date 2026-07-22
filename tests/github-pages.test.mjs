import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("GitHub Pages contains the full static application instead of a redirect", async () => {
  const html = await readFile(new URL("../docs/index.html", import.meta.url), "utf8");
  const assets = await readdir(new URL("../docs/assets/", import.meta.url));
  const og = await stat(new URL("../docs/og.png", import.meta.url));

  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /\/zhiliang-huixi\/assets\/[^"']+\.js/);
  assert.match(html, /\/zhiliang-huixi\/assets\/[^"']+\.css/);
  assert.doesNotMatch(html, /chatgpt\.site|location\.replace|http-equiv=["']refresh/i);
  assert.ok(assets.some((name) => name.endsWith(".js")));
  assert.ok(assets.some((name) => name.endsWith(".css")));
  assert.ok(og.size > 100_000);
});

test("GitHub Pages source uses a repository-relative base path", async () => {
  const [config, entry] = await Promise.all([
    readFile(new URL("../vite.github-pages.config.ts", import.meta.url), "utf8"),
    readFile(new URL("../github-pages/main.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(config, /base:\s*["']\/zhiliang-huixi\/["']/);
  assert.match(config, /outDir:\s*["']\.\.\/docs["']/);
  assert.match(entry, /import Home from ["']\.\.\/app\/page["']/);
  assert.match(entry, /import ["']\.\.\/app\/globals\.css["']/);
  await stat(new URL("public/.nojekyll", projectRoot));
});
