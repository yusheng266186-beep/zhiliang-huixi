import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the quality insight dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>质量慧析｜高中考试质量分析系统<\/title>/);
  assert.match(html, /年级驾驶舱/);
  assert.match(html, /导入Excel/);
  assert.match(html, /一本/);
  assert.match(html, /本科/);
  assert.match(html, /og:image/);
  assert.doesNotMatch(html, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("keeps privacy, export, accessibility, and visual semantics in the product source", async () => {
  const [page, layout, css, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /parseGradeWorkbook/);
  assert.match(page, /saveLatestDataset/);
  assert.match(page, /导出Word/);
  assert.match(page, /导出PDF/);
  assert.match(page, /TIER_COLORS/);
  assert.match(layout, /质量慧析｜高中考试质量分析系统/);
  assert.match(layout, /\/og\.png/);
  assert.match(layout, /\/favicon\.svg/);
  assert.match(css, /--top:\s*#f59e0b/i);
  assert.match(css, /--undergraduate:\s*#10b981/i);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
