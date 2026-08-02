import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  "src/components/admin/AdminPanelBar.tsx",
  "utf8",
);
const brandSource = readFileSync(
  "src/components/KomariLiteBrand.tsx",
  "utf8",
);

test("admin branding keeps Lite smaller and green on desktop and mobile", () => {
  assert.match(source, /<KomariLiteBrand size=\{isMobile \? "sm" : "md"\} \/>/);
  assert.match(brandSource, /text-\[var\(--green-9\)\]/);
  assert.doesNotMatch(brandSource, /bg-\[var\(--green-a3\)\]/);
  assert.match(brandSource, /lite: "text-\[13px\]"/);
  assert.match(brandSource, /lite: "text-base"/);
});

test("desktop version moves from the top bar to the sidebar footer", () => {
  assert.match(source, /data-testid="desktop-sidebar-version"/);
  assert.match(source, /<Github size=\{16\}/);
  assert.match(source, /truncate font-mono text-base/);
  assert.match(source, /text-\[var\(--gray-12\)\]/);
  assert.doesNotMatch(source, />\s*v\{formatVersion\(/);
  assert.match(
    source,
    /github\.com\/nuomiiiii\/komari\/releases\/tag\/\$\{encodeURIComponent\(currentVersion\)\}/,
  );
  assert.match(source, /target="_blank"/);
  assert.match(source, /\{!isMobile &&/);
  assert.doesNotMatch(source, /hidden=\{isMobile\}/);
  assert.doesNotMatch(source, /data-testid="desktop-sidebar-version"[\s\S]{0,120}border-t/);
});

test("desktop update dialog gives release notes enough space", () => {
  assert.match(source, /min\(920px, calc\(100vw - 3rem\)\)/);
  assert.match(source, /max-h-\[min\(62dvh,620px\)\] overflow-y-auto/);
});

test("update dialog keeps its title, release body, and actions separated", () => {
  assert.match(source, /<header className="border-b/);
  assert.match(source, /<div className="divide-y text-sm">/);
  assert.match(source, /<footer className="flex items-center justify-end gap-2 border-t/);
});

test("release notes render GitHub-flavored Markdown", () => {
  assert.match(source, /<ReactMarkdown/);
  assert.match(source, /remarkPlugins=\{\[remarkGfm\]\}/);
  assert.match(source, /overflow-x-auto rounded-md border/);
  assert.doesNotMatch(source, /whitespace-pre-wrap/);
});
